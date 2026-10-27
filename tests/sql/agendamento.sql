-- Teste do agendamento no fim do formulário. Roda numa transação e desfaz tudo no fim.
begin;

insert into public.formularios (id, slug, nome, ativo, perguntas, agendamento) values
  ('00000000-0000-0000-0000-0000000000c1', 'agenda-sql', 'Agenda SQL', true, '[]',
   '{"agenda":"demonstracao","whatsapp":"551180000001","textos":{"agendaTitulo":"Marque"}}'),
  ('00000000-0000-0000-0000-0000000000c2', 'sem-agenda-sql', 'Sem agenda SQL', true, '[]', null);

-- agendamento só pode ser nulo ou objeto
do $$ begin
  begin
    insert into public.formularios (slug, nome, agendamento) values ('agenda-lista-sql', 'Lista', '[]');
    raise exception 'agendamento em lista entrou';
  exception when check_violation then null;
  end;
end $$;

set local role anon;
set local request.jwt.claims = '{}';
do $$
declare f jsonb;
begin
  f := public.formulario_publico('agenda-sql');
  if f -> 'agendamento' ->> 'agenda' <> 'demonstracao' or f -> 'agendamento' ->> 'whatsapp' <> '551180000001'
     or f -> 'agendamento' -> 'textos' ->> 'agendaTitulo' <> 'Marque' then
    raise exception 'formulario_publico não devolveu o agendamento: %', f -> 'agendamento';
  end if;
  f := public.formulario_publico('sem-agenda-sql');
  if not (f ? 'agendamento') or jsonb_typeof(f -> 'agendamento') <> 'null' then
    raise exception 'formulário sem agenda deveria devolver agendamento nulo: %', f;
  end if;

  perform public.evento_registrar('agenda-sql', 'anon-agenda-0001', 'abriu_agenda', null, '{"horarios":3}');
  perform public.evento_registrar('agenda-sql', 'anon-agenda-0001', 'agendou', null, '{"resultado":"nova"}');
  perform public.evento_registrar('agenda-sql', 'anon-agenda-0001', 'marcou', null, '{}');
  perform public.evento_registrar('agenda-sql', 'anon-agenda-0001', 'concluiu', null, '{}');
end $$;

reset role;
do $$ begin
  if (select count(*) from public.eventos where formulario_id = '00000000-0000-0000-0000-0000000000c1') <> 3 then
    raise exception 'eventos do agendamento: esperava 3 (abriu_agenda, agendou, concluiu), veio %',
      (select count(*) from public.eventos where formulario_id = '00000000-0000-0000-0000-0000000000c1');
  end if;
  if (select meta ->> 'resultado' from public.eventos where formulario_id = '00000000-0000-0000-0000-0000000000c1' and evento = 'agendou') <> 'nova' then
    raise exception 'meta.resultado do agendou não ficou';
  end if;
  if exists (select 1 from public.eventos where formulario_id = '00000000-0000-0000-0000-0000000000c1' and evento = 'marcou') then
    raise exception 'evento desconhecido entrou';
  end if;
end $$;

select 'tudo certo' as resultado;
rollback;
