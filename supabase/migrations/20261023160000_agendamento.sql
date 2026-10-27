-- Agendamento no Vórtex Call (ou outro sistema de agenda com a mesma API) no fim do formulário.
--   formularios.agendamento  jsonb, nulo = desligado: { agenda, whatsapp, mensagemWhatsapp, textos }
--   formulario_publico       devolve o agendamento (a página pública fala direto com a API do Call)
--   evento_registrar         aceita abriu_agenda (cartão com horários) e agendou (meta.resultado)

alter table public.formularios
  add column agendamento jsonb check (agendamento is null or jsonb_typeof(agendamento) = 'object');

create or replace function public.formulario_publico(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', f.id, 'slug', f.slug, 'nome', f.nome, 'titulo_pagina', f.titulo_pagina, 'descricao', f.descricao,
    'logo_url', f.logo_url, 'avatar_url', f.avatar_url, 'cores', f.cores, 'textos', f.textos,
    'perguntas', coalesce((select jsonb_agg(p - 'desqualifica' order by ord) from jsonb_array_elements(f.perguntas) with ordinality as x(p, ord)), '[]'::jsonb),
    'privacidade_url', f.privacidade_url, 'termos_url', f.termos_url, 'pixels', f.pixels, 'agendamento', f.agendamento)
  from public.formularios f
  where f.slug = p_slug and f.ativo;
$$;

create or replace function public.evento_registrar(p_slug text, p_anon text, p_evento text, p_resposta uuid, p_meta jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  fid uuid;
begin
  if p_evento not in ('abriu', 'comecou', 'respondeu', 'concluiu', 'desqualificado', 'abriu_agenda', 'agendou')
     or coalesce(length(p_anon), 0) not between 8 and 80 then
    return;
  end if;
  select id into fid from public.formularios where slug = p_slug and ativo;
  if fid is null then return; end if;
  insert into public.eventos (formulario_id, formulario_slug, anon_id, resposta_id, evento, meta)
  values (fid, p_slug, p_anon, p_resposta, p_evento, case when length(coalesce(p_meta, '{}')::text) < 2000 then coalesce(p_meta, '{}') else '{}' end);
end $$;

revoke all on function public.formulario_publico(text), public.evento_registrar(text, text, text, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.formulario_publico(text), public.evento_registrar(text, text, text, uuid, jsonb)
  to anon, authenticated;
