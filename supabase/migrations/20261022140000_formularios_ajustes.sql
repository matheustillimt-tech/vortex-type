-- Ajustes dos formulários:
--   eventos ganham formulario_id (filtro do painel por id; apagar o formulário apaga os eventos dele)
--   resposta_salvar limpa o array de respostas no servidor e não mexe mais em resposta concluída
--   evento_registrar ignora formulário desligado

-- 1. eventos.formulario_id (backfill pelo slug; evento sem formulário não tem dono e sai)
alter table public.eventos add column formulario_id uuid references public.formularios (id) on delete cascade;
update public.eventos e set formulario_id = f.id from public.formularios f where f.slug = e.formulario_slug and e.formulario_id is null;
delete from public.eventos where formulario_id is null;
alter table public.eventos alter column formulario_id set not null;
drop index if exists public.eventos_formulario_idx;
create index eventos_formulario_id_idx on public.eventos (formulario_id, criado_em desc);

-- 2. Grava a resposta. A página chama no meio (parcial, pra recuperar quem abandona) e no fim (final = true).
-- O id vem do navegador. Resposta concluída não muda mais (devolve o estado dela).
-- O array guardado sai das perguntas do formulário: só itens objeto com slug que existe, `a` texto (até 600),
-- um por pergunta (o primeiro válido), na ordem do formulário; `q` e `papel` vêm do formulário, não do navegador.
create or replace function public.resposta_salvar(p_slug text, p_id uuid, p_dados jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  f       public.formularios;
  r       public.respostas;
  final   boolean := coalesce((p_dados ->> 'final')::boolean, false);
  cliente jsonb := coalesce(p_dados -> 'respostas', '[]'::jsonb);
  resp    jsonb;
  desq    boolean := false;
  o       jsonb := coalesce(p_dados -> 'origem', '{}'::jsonb);
begin
  select * into f from public.formularios where slug = p_slug and ativo;
  if not found then raise exception 'formulário não encontrado' using errcode = 'P0002'; end if;
  if p_id is null then raise exception 'sem id' using errcode = '22023'; end if;
  if length(p_dados::text) > 30000 or jsonb_typeof(cliente) <> 'array' then
    raise exception 'respostas grandes demais' using errcode = '22001';
  end if;
  if jsonb_typeof(o) <> 'object' then o := '{}'::jsonb; end if;

  -- já existe: de outro formulário é erro; concluída não muda
  select * into r from public.respostas where id = p_id;
  if found then
    if r.formulario_id <> f.id then raise exception 'resposta de outro formulário' using errcode = '42501'; end if;
    if r.status <> 'parcial' then
      return jsonb_build_object('id', r.id, 'status', r.status, 'desqualificado', r.status = 'desqualificado');
    end if;
  end if;

  with c as (
    select x.item, x.ord
      from jsonb_array_elements(cliente) with ordinality as x(item, ord)
     where jsonb_typeof(x.item) = 'object' and jsonb_typeof(x.item -> 'a') = 'string'
  ), p as (
    select distinct on (y.p ->> 'slug') y.p, y.ord
      from jsonb_array_elements(f.perguntas) with ordinality as y(p, ord)
     where jsonb_typeof(y.p) = 'object' and y.p ->> 'slug' is not null
     order by y.p ->> 'slug', y.ord
  ), m as (
    select distinct on (p.ord) p.ord, p.p, c.item
      from p join c on c.item ->> 'slug' = p.p ->> 'slug'
     order by p.ord, c.ord
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'slug', m.p ->> 'slug', 'q', m.p ->> 'texto', 'a', left(m.item ->> 'a', 600), 'papel', m.p -> 'papel')
           order by m.ord), '[]'::jsonb)
    into resp from m;

  if final then
    select exists (
      select 1
        from jsonb_array_elements(f.perguntas) q
        join jsonb_array_elements(resp) a on a ->> 'slug' = q ->> 'slug'
       where jsonb_typeof(q -> 'desqualifica') = 'array'
         and (q -> 'desqualifica') ? (a ->> 'a')
    ) into desq;
  end if;

  r := null;
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
    status = excluded.status,
    concluido_em = excluded.concluido_em,
    atualizado_em = now()
  where t.formulario_id = f.id and t.status = 'parcial'
  returning * into r;

  -- corrida: outra chamada concluiu entre a leitura e o insert
  if r.id is null then
    select * into r from public.respostas where id = p_id;
    if not found or r.formulario_id <> f.id then raise exception 'resposta de outro formulário' using errcode = '42501'; end if;
  end if;
  return jsonb_build_object('id', r.id, 'status', r.status, 'desqualificado', r.status = 'desqualificado');
end $$;

-- 3. Evento do funil: só de formulário ligado; guarda o id (o slug fica de referência).
create or replace function public.evento_registrar(p_slug text, p_anon text, p_evento text, p_resposta uuid, p_meta jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  fid uuid;
begin
  if p_evento not in ('abriu', 'comecou', 'respondeu', 'concluiu', 'desqualificado')
     or coalesce(length(p_anon), 0) not between 8 and 80 then
    return;
  end if;
  select id into fid from public.formularios where slug = p_slug and ativo;
  if fid is null then return; end if;
  insert into public.eventos (formulario_id, formulario_slug, anon_id, resposta_id, evento, meta)
  values (fid, p_slug, p_anon, p_resposta, p_evento, case when length(coalesce(p_meta, '{}')::text) < 2000 then coalesce(p_meta, '{}') else '{}' end);
end $$;

revoke all on function public.resposta_salvar(text, uuid, jsonb), public.evento_registrar(text, text, text, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.resposta_salvar(text, uuid, jsonb), public.evento_registrar(text, text, text, uuid, jsonb)
  to anon, authenticated;
