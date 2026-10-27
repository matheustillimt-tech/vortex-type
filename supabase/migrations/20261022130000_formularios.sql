-- Formulários em conversa (a agenda entra numa migração mais adiante).
--   formularios  cada formulário: aparência, perguntas (jsonb), textos, pixels
--   respostas    cada pessoa que respondeu (parcial no meio, completo/desqualificado no fim)
--   eventos      passos do funil (abriu, começou, respondeu cada pergunta, concluiu)
-- A página pública só fala com o banco pelas funções abaixo (security definer, liberadas pro anon).
-- O painel lê e grava direto, com RLS: quem está em `membros`.

create table public.formularios (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,59}$'),
  nome            text not null,
  ativo           boolean not null default true,
  titulo_pagina   text,
  descricao       text,
  logo_url        text,
  avatar_url      text,
  cores           jsonb not null default '{}'::jsonb,
  perguntas       jsonb not null default '[]'::jsonb check (jsonb_typeof(perguntas) = 'array'),
  textos          jsonb not null default '{}'::jsonb,
  privacidade_url text,
  termos_url      text,
  pixels          jsonb not null default '{}'::jsonb,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

create table public.respostas (
  id              uuid primary key,
  formulario_id   uuid not null references public.formularios (id) on delete cascade,
  formulario_slug text not null,
  status          text not null default 'parcial' check (status in ('parcial', 'completo', 'desqualificado')),
  nome            text,
  whatsapp        text,
  email           text,
  empresa         text,
  respostas       jsonb not null default '[]'::jsonb,
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  utm_content     text,
  utm_term        text,
  origem          jsonb not null default '{}'::jsonb,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  concluido_em    timestamptz
);
create index respostas_formulario_idx on public.respostas (formulario_id, criado_em desc);
create index respostas_criado_idx on public.respostas (criado_em desc);

create table public.eventos (
  id              bigint generated always as identity primary key,
  formulario_slug text not null,
  anon_id         text not null,
  resposta_id     uuid,
  evento          text not null,
  meta            jsonb not null default '{}'::jsonb,
  criado_em       timestamptz not null default now()
);
create index eventos_formulario_idx on public.eventos (formulario_slug, criado_em desc);

do $$
declare t text;
begin
  foreach t in array array['formularios', 'respostas', 'eventos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy membro_gerencia on public.%I for all to authenticated using (public.eh_membro()) with check (public.eh_membro())', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- O que a página pública precisa. Sem as regras de desqualificação (ficam só no banco).
create or replace function public.formulario_publico(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', f.id, 'slug', f.slug, 'nome', f.nome, 'titulo_pagina', f.titulo_pagina, 'descricao', f.descricao,
    'logo_url', f.logo_url, 'avatar_url', f.avatar_url, 'cores', f.cores, 'textos', f.textos,
    'perguntas', coalesce((select jsonb_agg(p - 'desqualifica' order by ord) from jsonb_array_elements(f.perguntas) with ordinality as x(p, ord)), '[]'::jsonb),
    'privacidade_url', f.privacidade_url, 'termos_url', f.termos_url, 'pixels', f.pixels)
  from public.formularios f
  where f.slug = p_slug and f.ativo;
$$;

-- Grava a resposta. A página chama no meio (parcial, pra recuperar quem abandona) e no fim (final = true).
-- O id vem do navegador. Resposta concluída não volta pra parcial. (Os webhooks entram numa migração mais adiante.)
create or replace function public.resposta_salvar(p_slug text, p_id uuid, p_dados jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  f     public.formularios;
  r     public.respostas;
  final boolean := coalesce((p_dados ->> 'final')::boolean, false);
  resp  jsonb := coalesce(p_dados -> 'respostas', '[]'::jsonb);
  desq  boolean := false;
  o     jsonb := coalesce(p_dados -> 'origem', '{}'::jsonb);
begin
  select * into f from public.formularios where slug = p_slug and ativo;
  if not found then raise exception 'formulário não encontrado' using errcode = 'P0002'; end if;
  if p_id is null then raise exception 'sem id' using errcode = '22023'; end if;
  if length(p_dados::text) > 30000 or jsonb_typeof(resp) <> 'array' then
    raise exception 'respostas grandes demais' using errcode = '22001';
  end if;

  if final then
    select exists (
      select 1
        from jsonb_array_elements(f.perguntas) q
        join jsonb_array_elements(resp) a on a ->> 'slug' = q ->> 'slug'
       where jsonb_typeof(q -> 'desqualifica') = 'array'
         and (q -> 'desqualifica') ? (a ->> 'a')
    ) into desq;
  end if;

  insert into public.respostas as t (
    id, formulario_id, formulario_slug, status, nome, whatsapp, email, empresa, respostas,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term, origem, concluido_em)
  values (
    p_id, f.id, f.slug,
    case when not final then 'parcial' when desq then 'desqualificado' else 'completo' end,
    left(p_dados ->> 'nome', 120), left(p_dados ->> 'whatsapp', 20), left(lower(p_dados ->> 'email'), 160),
    left(p_dados ->> 'empresa', 160), resp,
    left(o ->> 'utm_source', 200), left(o ->> 'utm_medium', 200), left(o ->> 'utm_campaign', 300),
    left(o ->> 'utm_content', 300), left(o ->> 'utm_term', 200), o - 'utm_source' - 'utm_medium' - 'utm_campaign' - 'utm_content' - 'utm_term',
    case when final then now() end)
  on conflict (id) do update set
    nome = coalesce(excluded.nome, t.nome),
    whatsapp = coalesce(excluded.whatsapp, t.whatsapp),
    email = coalesce(excluded.email, t.email),
    empresa = coalesce(excluded.empresa, t.empresa),
    respostas = case when jsonb_array_length(excluded.respostas) >= jsonb_array_length(t.respostas) then excluded.respostas else t.respostas end,
    status = case when t.status = 'parcial' then excluded.status else t.status end,
    concluido_em = coalesce(t.concluido_em, excluded.concluido_em),
    atualizado_em = now()
  where t.formulario_id = f.id
  returning * into r;

  if r.id is null then raise exception 'resposta de outro formulário' using errcode = '42501'; end if;
  return jsonb_build_object('id', r.id, 'status', r.status, 'desqualificado', r.status = 'desqualificado');
end $$;

create or replace function public.evento_registrar(p_slug text, p_anon text, p_evento text, p_resposta uuid, p_meta jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_evento not in ('abriu', 'comecou', 'respondeu', 'concluiu', 'desqualificado')
     or coalesce(length(p_anon), 0) not between 8 and 80
     or not exists (select 1 from public.formularios where slug = p_slug) then
    return;
  end if;
  insert into public.eventos (formulario_slug, anon_id, resposta_id, evento, meta)
  values (p_slug, p_anon, p_resposta, p_evento, case when length(coalesce(p_meta, '{}')::text) < 2000 then coalesce(p_meta, '{}') else '{}' end);
end $$;

revoke all on function public.formulario_publico(text), public.resposta_salvar(text, uuid, jsonb),
  public.evento_registrar(text, text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.formulario_publico(text), public.resposta_salvar(text, uuid, jsonb),
  public.evento_registrar(text, text, text, uuid, jsonb) to anon, authenticated;

-- Logo, avatar e imagens das perguntas: bucket público; só membro sobe, troca ou apaga.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('formularios', 'formularios', true, 2097152, array['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp', 'image/gif'])
on conflict (id) do nothing;
create policy formularios_membro_le on storage.objects for select to authenticated using (bucket_id = 'formularios' and public.eh_membro());
create policy formularios_membro_sobe on storage.objects for insert to authenticated with check (bucket_id = 'formularios' and public.eh_membro());
create policy formularios_membro_troca on storage.objects for update to authenticated using (bucket_id = 'formularios' and public.eh_membro());
create policy formularios_membro_apaga on storage.objects for delete to authenticated using (bucket_id = 'formularios' and public.eh_membro());
