-- Ajustes das integrações:
--   1. chave_ip: IPv6 agrupado pelo /64 (um celular troca de endereço dentro do mesmo /64), IPv4 como vem.
--   2. respostas_limitar: salvar de novo um lead que já existe (parcial → final) não conta no limite; o limite
--      por formulário sobe pra 3000/min (campanha grande não pode travar visitante de verdade).
--   3. eventos_limitar: mesma chave de IP.
--   4. webhooks_enfileirar_resposta: só enfileira resposta da página pública (chamada anônima). Importação
--      ou gravação feita pelo servidor (service role) não dispara webhook.

create or replace function public.chave_ip(p_ip text) returns text language plpgsql immutable set search_path = public as $$
declare
  t text := btrim(coalesce(p_ip, ''), ' []');
  v inet;
begin
  if t = '' then return null; end if;
  begin
    v := t::inet;
  exception when others then
    return left(t, 100); -- não é IP (cabeçalho estranho): usa o texto como veio
  end;
  if family(v) = 4 then return host(v); end if;
  -- IPv4 mapeado em IPv6 (::ffff:a.b.c.d) é uma pessoa só: volta pro IPv4, senão caía tudo num /64.
  if v << '::ffff:0:0/96'::inet then return host('0.0.0.0'::inet + (host(v)::inet - '::ffff:0:0'::inet)); end if;
  return network(set_masklen(v, 64))::text;
end $$;

create or replace function public.respostas_limitar() returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_ip text;
begin
  if not public.chamada_anonima() then return new; end if;
  -- O insert vai virar update de um lead que já existe (ex.: o envio final de quem já tinha parcial): sem limite.
  if exists (select 1 from public.respostas where id = new.id) then return new; end if;
  v_ip := public.chave_ip(public.ip_da_requisicao());
  if (v_ip is not null and public.limite_estourou('resposta:ip:' || v_ip, 20))
     or public.limite_estourou('resposta:formulario:' || new.formulario_id, 3000) then
    raise exception 'muitos envios, tente de novo em instantes' using errcode = 'VT429';
  end if;
  return new;
end $$;

create or replace function public.eventos_limitar() returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_ip text;
begin
  if public.chamada_anonima() then
    v_ip := public.chave_ip(public.ip_da_requisicao());
    if v_ip is not null and public.limite_estourou('evento:ip:' || v_ip, 300) then
      return null;
    end if;
  end if;
  return new;
end $$;

create or replace function public.webhooks_enfileirar_resposta() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.chamada_anonima() then return new; end if;
  if new.status in ('completo', 'desqualificado') and (tg_op = 'INSERT' or old.status = 'parcial') then
    insert into public.webhook_entregas (webhook_id, resposta_id)
    select w.id, new.id from public.webhooks w
     where w.ativo and (w.formularios is null or new.formulario_id = any (w.formularios));
  end if;
  return new;
end $$;

revoke execute on function public.chave_ip(text) from public, anon, authenticated;
revoke execute on function public.respostas_limitar(), public.eventos_limitar(), public.webhooks_enfileirar_resposta() from public, anon, authenticated;
