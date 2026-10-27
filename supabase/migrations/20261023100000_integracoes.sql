-- Integrações: webhooks (fila + gatilho), chaves de API e MCP, domínios próprios e limite de envios da página pública.

-- 1. Webhooks ----------------------------------------------------------------------------------------------
create table public.webhooks (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null check (char_length(nome) between 1 and 60),
  url           text not null check (url ~ '^https://' and char_length(url) <= 500),
  segredo       text not null,
  ativo         boolean not null default true,
  formularios   uuid[],  -- null = todos os formulários
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.webhook_entregas (
  id            bigint generated always as identity primary key,
  webhook_id    uuid not null references public.webhooks (id) on delete cascade,
  resposta_id   uuid references public.respostas (id) on delete cascade,
  teste         boolean not null default false,
  evento        text not null default 'resposta.concluida',
  status        text not null default 'pendente' check (status in ('pendente', 'enviado', 'falhou')),
  tentativas    int not null default 0,
  proxima_em    timestamptz not null default now(),
  ultimo_status int,
  ultimo_erro   text,
  criado_em     timestamptz not null default now(),
  enviado_em    timestamptz
);
create index webhook_entregas_fila_idx on public.webhook_entregas (proxima_em) where status = 'pendente';
create index webhook_entregas_webhook_idx on public.webhook_entregas (webhook_id, criado_em desc);

-- Resposta acabou de terminar (nova já concluída ou parcial → concluída): uma entrega por webhook ligado que casa.
create or replace function public.webhooks_enfileirar_resposta() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('completo', 'desqualificado') and (tg_op = 'INSERT' or old.status = 'parcial') then
    insert into public.webhook_entregas (webhook_id, resposta_id)
    select w.id, new.id from public.webhooks w
     where w.ativo and (w.formularios is null or new.formulario_id = any (w.formularios));
  end if;
  return new;
end $$;
create trigger respostas_webhooks after insert or update of status on public.respostas
  for each row execute function public.webhooks_enfileirar_resposta();

-- O cron reserva um lote (empurra a próxima tentativa 2 min pra frente): dois crons nunca pegam a mesma entrega.
create or replace function public.webhook_entregas_reservar(p_limite int) returns setof public.webhook_entregas
language sql security definer set search_path = public as $$
  update public.webhook_entregas e set proxima_em = now() + interval '2 minutes'
   where e.id in (
     select id from public.webhook_entregas
      where status = 'pendente' and proxima_em <= now()
      order by proxima_em
      limit greatest(1, least(p_limite, 500))
      for update skip locked)
  returning e.*;
$$;

-- 2. Chaves de API e MCP (só o servidor mexe, com a service role) --------------------------------------------
create table public.chaves_api (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null check (char_length(nome) between 1 and 60),
  permissao   text not null check (permissao in ('leitura', 'escrita')),
  prefixo     text not null,
  hash        text not null unique,
  criada_por  uuid references auth.users (id) on delete set null,
  ultimo_uso  timestamptz,
  revogada_em timestamptz,
  criado_em   timestamptz not null default now()
);

create table public.api_uso (
  chave_id uuid not null references public.chaves_api (id) on delete cascade,
  minuto   timestamptz not null,
  chamadas integer not null default 0 check (chamadas >= 0),
  primary key (chave_id, minuto)
);

-- Soma uma chamada no minuto da chave e devolve o total do minuto; marca o último uso e limpa minutos velhos.
create or replace function public.api_registrar_uso(p_chave uuid) returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  v_total integer;
begin
  insert into public.api_uso (chave_id, minuto, chamadas)
  values (p_chave, date_trunc('minute', now()), 1)
  on conflict (chave_id, minuto) do update set chamadas = public.api_uso.chamadas + 1
  returning chamadas into v_total;
  update public.chaves_api set ultimo_uso = now() where id = p_chave;
  delete from public.api_uso where chave_id = p_chave and minuto < now() - interval '1 hour';
  return v_total;
end $$;

-- 3. Domínios próprios -----------------------------------------------------------------------------------------
create table public.dominios (
  id            uuid primary key default gen_random_uuid(),
  host          text not null unique check (host = lower(host) and char_length(host) <= 253
                  and host ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'),
  formulario_id uuid not null references public.formularios (id) on delete cascade,
  status        text not null default 'pendente' check (status in ('pendente', 'ativo', 'erro')),
  verificado_em timestamptz,
  criado_em     timestamptz not null default now()
);

-- O middleware pergunta (com a chave pública) qual formulário abre naquele domínio.
create or replace function public.formulario_do_dominio(p_host text) returns text
language sql stable security definer set search_path = public as $$
  select f.slug from public.dominios d join public.formularios f on f.id = d.formulario_id
   where d.host = lower(btrim(p_host)) and d.status = 'ativo' and f.ativo;
$$;

-- 4. Limite de envios da página pública (só chamadas anônimas; servidor e scripts não contam) ------------------
create table public.limite_envios (
  chave  text not null,
  minuto timestamptz not null,
  n      int not null default 0,
  primary key (chave, minuto)
);

create or replace function public.limite_estourou(p_chave text, p_maximo int) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v int;
begin
  insert into public.limite_envios (chave, minuto, n) values (p_chave, date_trunc('minute', now()), 1)
  on conflict (chave, minuto) do update set n = public.limite_envios.n + 1
  returning n into v;
  if random() < 0.01 then delete from public.limite_envios where minuto < now() - interval '10 minutes'; end if;
  return v > p_maximo;
end $$;

create or replace function public.chamada_anonima() returns boolean language sql stable set search_path = public as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role', '') = 'anon';
$$;

-- IP de quem chamou (Cloudflare ou o primeiro do x-forwarded-for do gateway do Supabase).
create or replace function public.ip_da_requisicao() returns text language sql stable set search_path = public as $$
  select nullif(btrim(split_part(coalesce(
    nullif(current_setting('request.headers', true), '')::json ->> 'cf-connecting-ip',
    nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for',
    ''), ',', 1)), '');
$$;

create or replace function public.respostas_limitar() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.chamada_anonima() then return new; end if;
  if public.limite_estourou('resposta:ip:' || coalesce(public.ip_da_requisicao(), 'sem-ip'), 20)
     or public.limite_estourou('resposta:formulario:' || new.formulario_id, 600) then
    raise exception 'muitos envios, tente de novo em instantes' using errcode = 'VT429';
  end if;
  return new;
end $$;
create trigger respostas_limite before insert on public.respostas for each row execute function public.respostas_limitar();

create or replace function public.eventos_limitar() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.chamada_anonima() and public.limite_estourou('evento:ip:' || coalesce(public.ip_da_requisicao(), 'sem-ip'), 300) then
    return null;
  end if;
  return new;
end $$;
create trigger eventos_limite before insert on public.eventos for each row execute function public.eventos_limitar();

-- 5. Acesso --------------------------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['webhooks', 'webhook_entregas', 'dominios'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy admin_gerencia on public.%I for all to authenticated using (public.eh_admin()) with check (public.eh_admin())', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
  foreach t in array array['chaves_api', 'api_uso', 'limite_envios'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

revoke execute on function public.webhooks_enfileirar_resposta(), public.webhook_entregas_reservar(int),
  public.api_registrar_uso(uuid), public.limite_estourou(text, int), public.respostas_limitar(),
  public.eventos_limitar(), public.formulario_do_dominio(text) from public, anon, authenticated;
grant execute on function public.webhook_entregas_reservar(int), public.api_registrar_uso(uuid) to service_role;
grant execute on function public.formulario_do_dominio(text) to anon, authenticated, service_role;
