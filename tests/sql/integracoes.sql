-- Teste das integrações (webhooks, chaves, domínios) e do limite de envios. Desfaz tudo no fim.
begin;

insert into public.formularios (id, slug, nome, ativo, perguntas) values
  ('00000000-0000-0000-0000-0000000003f1', 'integ-sql', 'Integ SQL', true, '[{"slug":"nome","tipo":"texto","papel":"nome","texto":"Nome?"}]'),
  ('00000000-0000-0000-0000-0000000003f2', 'integ-outro', 'Integ Outro', true, '[]');

insert into public.webhooks (id, nome, url, segredo, formularios) values
  ('00000000-0000-0000-0000-0000000003a1', 'Todos', 'https://exemplo.com/a', 'seg-a', null),
  ('00000000-0000-0000-0000-0000000003a2', 'Só o outro', 'https://exemplo.com/b', 'seg-b', array['00000000-0000-0000-0000-0000000003f2']::uuid[]),
  ('00000000-0000-0000-0000-0000000003a3', 'Desligado', 'https://exemplo.com/c', 'seg-c', null);
update public.webhooks set ativo = false where id = '00000000-0000-0000-0000-0000000003a3';

-- 1. Fila: parcial não enfileira; concluir enfileira só pros webhooks que casam
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
set local request.headers = '{"x-forwarded-for":"203.0.113.9"}';
do $$ begin
  perform public.resposta_salvar('integ-sql', '00000000-0000-0000-0000-0000000003b1', '{"nome":"Ana","respostas":[{"slug":"nome","a":"Ana"}],"final":false}');
end $$;
reset role;
do $$ begin
  if (select count(*) from public.webhook_entregas where resposta_id = '00000000-0000-0000-0000-0000000003b1') <> 0 then raise exception 'parcial não pode enfileirar'; end if;
end $$;
set local role anon;
do $$ begin
  perform public.resposta_salvar('integ-sql', '00000000-0000-0000-0000-0000000003b1', '{"nome":"Ana","respostas":[{"slug":"nome","a":"Ana"}],"final":true}');
  -- concluída: chamar de novo não enfileira outra vez
  perform public.resposta_salvar('integ-sql', '00000000-0000-0000-0000-0000000003b1', '{"nome":"Ana","respostas":[{"slug":"nome","a":"Ana"}],"final":true}');
end $$;
reset role;
do $$ begin
  if (select count(*) from public.webhook_entregas where resposta_id = '00000000-0000-0000-0000-0000000003b1') <> 1 then raise exception 'concluir tem que enfileirar uma entrega (só o webhook "Todos")'; end if;
  if not exists (select 1 from public.webhook_entregas where resposta_id = '00000000-0000-0000-0000-0000000003b1' and webhook_id = '00000000-0000-0000-0000-0000000003a1' and status = 'pendente') then raise exception 'entrega errada'; end if;
end $$;

-- 2. Reserva da fila: pega a pendente e adia a próxima tentativa (outro cron não pega a mesma)
do $$ declare n int; begin
  select count(*) into n from public.webhook_entregas_reservar(500) e where e.resposta_id = '00000000-0000-0000-0000-0000000003b1';
  if n <> 1 then raise exception 'reserva não pegou a entrega'; end if;
  select count(*) into n from public.webhook_entregas_reservar(500) e where e.resposta_id = '00000000-0000-0000-0000-0000000003b1';
  if n <> 0 then raise exception 'reserva pegou a mesma entrega duas vezes'; end if;
end $$;

-- 3. Limite: 20 gravações por IP por minuto (a resposta b1 contou 1: a parcial; o final dela atualizou um lead
--    que já existia e não conta; a 3ª chamada voltou antes do insert, por estar concluída); outro IP passa;
--    servidor não conta
set local role anon;
do $$ declare i int; begin
  for i in 1..19 loop
    perform public.resposta_salvar('integ-sql', ('00000000-0000-0000-0000-0000000004' || lpad(i::text, 2, '0'))::uuid, '{"respostas":[],"final":false}');
  end loop;
  begin
    perform public.resposta_salvar('integ-sql', '00000000-0000-0000-0000-000000000499', '{"respostas":[],"final":false}');
    raise exception 'a 21ª gravação do mesmo IP tinha que ser barrada';
  exception when sqlstate 'VT429' then null;
  end;
end $$;
set local request.headers = '{"x-forwarded-for":"198.51.100.7, 10.0.0.1"}';
do $$ begin
  perform public.resposta_salvar('integ-sql', '00000000-0000-0000-0000-000000000498', '{"respostas":[],"final":false}');
end $$;
reset role;
set local request.jwt.claims = '{}';
do $$ declare i int; begin
  for i in 1..30 loop
    insert into public.respostas (id, formulario_id, formulario_slug) values (gen_random_uuid(), '00000000-0000-0000-0000-0000000003f1', 'integ-sql');
  end loop;
end $$;

-- 3a. O balde desse IP está cheio, mas o envio final de um lead que já existe passa (vira update, sem limite)
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
set local request.headers = '{"x-forwarded-for":"203.0.113.9"}';
do $$ declare r jsonb; begin
  begin
    perform public.resposta_salvar('integ-sql', '00000000-0000-0000-0000-000000000497', '{"respostas":[],"final":false}');
    raise exception 'o balde do IP 203.0.113.9 tinha que estar cheio';
  exception when sqlstate 'VT429' then null;
  end;
  r := public.resposta_salvar('integ-sql', '00000000-0000-0000-0000-000000000401', '{"nome":"Bia","respostas":[{"slug":"nome","a":"Bia"}],"final":true}');
  if r ->> 'status' <> 'completo' then raise exception 'envio final do lead existente não salvou: %', r; end if;
end $$;
reset role;
do $$ begin
  if (select status from public.respostas where id = '00000000-0000-0000-0000-000000000401') <> 'completo' then raise exception 'lead existente não concluiu'; end if;
  if (select count(*) from public.webhook_entregas where resposta_id = '00000000-0000-0000-0000-000000000401') <> 1 then raise exception 'conclusão pela página pública tem que enfileirar'; end if;
end $$;

-- 3a2. IPv6: dois endereços do mesmo /64 dividem o balde; outro /64 tem o seu
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
set local request.headers = '{"x-forwarded-for":"2001:db8:aa:1:1111::1"}';
do $$ declare i int; begin
  for i in 1..10 loop
    perform public.resposta_salvar('integ-sql', ('00000000-0000-0000-0000-0000000006' || lpad(i::text, 2, '0'))::uuid, '{"respostas":[],"final":false}');
  end loop;
end $$;
set local request.headers = '{"x-forwarded-for":"2001:DB8:AA:1:ffff:2:3:4"}';
do $$ declare i int; begin
  for i in 11..20 loop
    perform public.resposta_salvar('integ-sql', ('00000000-0000-0000-0000-0000000006' || lpad(i::text, 2, '0'))::uuid, '{"respostas":[],"final":false}');
  end loop;
  begin
    perform public.resposta_salvar('integ-sql', '00000000-0000-0000-0000-000000000699', '{"respostas":[],"final":false}');
    raise exception 'o mesmo /64 tinha que dividir o balde (21ª gravação)';
  exception when sqlstate 'VT429' then null;
  end;
end $$;
set local request.headers = '{"x-forwarded-for":"2001:db8:aa:2::1"}';
do $$ begin
  perform public.resposta_salvar('integ-sql', '00000000-0000-0000-0000-000000000698', '{"respostas":[],"final":false}');
end $$;
reset role;
do $$ begin
  if public.chave_ip('2001:db8:aa:1:1111::1') is distinct from public.chave_ip('2001:DB8:AA:1:ffff:2:3:4') then raise exception 'chave_ip: mesmo /64 tem que dar a mesma chave'; end if;
  if public.chave_ip('2001:db8:aa:1::1') = public.chave_ip('2001:db8:aa:2::1') then raise exception 'chave_ip: /64 diferentes não podem dividir'; end if;
  if public.chave_ip('203.0.113.9') is distinct from '203.0.113.9' then raise exception 'chave_ip: IPv4 vai como vem'; end if;
  if public.chave_ip('::ffff:203.0.113.9') is distinct from '203.0.113.9' then raise exception 'chave_ip: IPv4 mapeado volta pro IPv4'; end if;
  if public.chave_ip(null) is not null or public.chave_ip('') is not null then raise exception 'chave_ip: sem IP dá null'; end if;
end $$;

-- 3a3. Resposta criada pelo servidor (service role, ex.: importação da Etapa 4) não dispara webhook
set local request.jwt.claims = '{"role":"service_role"}';
set local request.headers = '{}';
insert into public.respostas (id, formulario_id, formulario_slug, status, concluido_em)
  values ('00000000-0000-0000-0000-0000000003b9', '00000000-0000-0000-0000-0000000003f1', 'integ-sql', 'completo', now());
do $$ begin
  if (select count(*) from public.webhook_entregas where resposta_id = '00000000-0000-0000-0000-0000000003b9') <> 0 then raise exception 'insert da service role não pode enfileirar webhook'; end if;
end $$;

-- 3b. Sem IP identificado (nem cf-connecting-ip nem x-forwarded-for): não pode cair num limite
--     compartilhado por todo mundo sem IP. As 25 gravações, todas com id novo, têm que passar.
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
set local request.headers = '{}';
do $$ declare i int; begin
  for i in 1..25 loop
    perform public.resposta_salvar('integ-sql', ('00000000-0000-0000-0000-0000000005' || lpad(i::text, 2, '0'))::uuid, '{"respostas":[],"final":false}');
  end loop;
end $$;
reset role;

-- 4. Eventos: 300 por IP por minuto, o resto some em silêncio
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
set local request.headers = '{"x-forwarded-for":"192.0.2.44"}';
do $$ declare i int; begin
  for i in 1..305 loop
    perform public.evento_registrar('integ-sql', 'anon-limite-0001', 'abriu', null, '{}');
  end loop;
end $$;
reset role;
do $$ begin
  if (select count(*) from public.eventos where anon_id = 'anon-limite-0001') <> 300 then raise exception 'limite de eventos errado'; end if;
end $$;

-- 5. Domínio: só ativo e de formulário ligado
insert into public.dominios (host, formulario_id, status) values
  ('aplicacao.cliente-sql.com', '00000000-0000-0000-0000-0000000003f1', 'ativo'),
  ('pendente.cliente-sql.com', '00000000-0000-0000-0000-0000000003f1', 'pendente');
set local role anon;
do $$ begin
  if public.formulario_do_dominio('Aplicacao.Cliente-SQL.com') is distinct from 'integ-sql' then raise exception 'domínio ativo não achou o formulário'; end if;
  if public.formulario_do_dominio('pendente.cliente-sql.com') is not null then raise exception 'domínio pendente abriu'; end if;
  begin
    perform 1 from public.dominios;
    raise exception 'anônimo leu dominios';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.chaves_api;
    raise exception 'anônimo leu chaves_api';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.webhook_entregas_reservar(1);
    raise exception 'anônimo reservou a fila';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
update public.formularios set ativo = false where id = '00000000-0000-0000-0000-0000000003f1';
set local role anon;
do $$ begin
  if public.formulario_do_dominio('aplicacao.cliente-sql.com') is not null then raise exception 'domínio de formulário desligado abriu'; end if;
end $$;
reset role;

-- 6. Membro (não admin) não vê webhooks
insert into auth.users (id, email, aud, role) values ('00000000-0000-0000-0000-0000000003c1', 'membro-integ@sql.teste', 'authenticated', 'authenticated');
insert into public.membros (usuario_id, papel) values ('00000000-0000-0000-0000-0000000003c1', 'membro');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000003c1","role":"authenticated"}';
do $$ begin
  if (select count(*) from public.webhooks where id in ('00000000-0000-0000-0000-0000000003a1', '00000000-0000-0000-0000-0000000003a2')) <> 0 then raise exception 'membro viu webhooks'; end if;
end $$;
reset role;

select 'tudo certo' as resultado;
rollback;
