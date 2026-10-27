-- Teste das tabelas e funções dos formulários. Roda numa transação e desfaz tudo no fim.
begin;

insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-0000000000a1', 'membro-form@sql.teste', 'authenticated', 'authenticated');
insert into public.membros (usuario_id, papel) values ('00000000-0000-0000-0000-0000000000a1', 'membro');

insert into public.formularios (id, slug, nome, ativo, perguntas) values
  ('00000000-0000-0000-0000-0000000000f1', 'teste-sql', 'Teste SQL', true,
   '[{"slug":"nome","tipo":"texto","papel":"nome","texto":"Nome?"},
     {"slug":"fat","tipo":"escolha","texto":"Faturamento?","opcoes":["Pouco","Muito"],"desqualifica":["Pouco"]}]'),
  ('00000000-0000-0000-0000-0000000000f2', 'desligado-sql', 'Desligado', false, '[]'),
  ('00000000-0000-0000-0000-0000000000f3', 'ligado2-sql', 'Ligado 2', true, '[]');

set local role anon;
set local request.jwt.claims = '{}';
do $$
declare f jsonb; r jsonb;
begin
  f := public.formulario_publico('teste-sql');
  if f is null then raise exception 'formulário ligado não abriu'; end if;
  if (f -> 'perguntas' -> 1) ? 'desqualifica' then raise exception 'regra de desqualificação vazou pro público'; end if;
  if f ? 'ativo' then raise exception 'campo interno vazou'; end if;
  if public.formulario_publico('desligado-sql') is not null then raise exception 'formulário desligado abriu'; end if;

  r := public.resposta_salvar('teste-sql', '00000000-0000-0000-0000-0000000000b1',
    '{"nome":"Ana","respostas":[{"slug":"nome","q":"Nome?","a":"Ana"}],"final":false}');
  if r ->> 'status' <> 'parcial' then raise exception 'parcial falhou: %', r; end if;

  r := public.resposta_salvar('teste-sql', '00000000-0000-0000-0000-0000000000b1',
    '{"nome":"Ana","respostas":[{"slug":"nome","q":"Nome?","a":"Ana"},{"slug":"fat","q":"Faturamento?","a":"Pouco"}],"final":true}');
  if r ->> 'status' <> 'desqualificado' then raise exception 'desqualificação falhou: %', r; end if;

  -- concluída não muda: outra chamada com outro nome devolve o mesmo estado
  r := public.resposta_salvar('teste-sql', '00000000-0000-0000-0000-0000000000b1',
    '{"nome":"Outra","respostas":[{"slug":"nome","a":"Outra"},{"slug":"fat","a":"Muito"}],"final":true}');
  if r ->> 'status' <> 'desqualificado' or r ->> 'id' <> '00000000-0000-0000-0000-0000000000b1' then raise exception 'concluída mudou de status: %', r; end if;
  r := public.resposta_salvar('teste-sql', '00000000-0000-0000-0000-0000000000b1', '{"nome":"Outra","final":false}');
  if r ->> 'status' <> 'desqualificado' then raise exception 'concluída voltou pra parcial: %', r; end if;

  -- respostas limpas no servidor: só item objeto, slug existente, `a` texto, q vindo do formulário
  r := public.resposta_salvar('teste-sql', '00000000-0000-0000-0000-0000000000b2',
    '{"respostas":[null,{"slug":"nome","a":{"o":1}},{"slug":"inventado","a":"x"},{"slug":"nome","q":"FALSO","a":"Ana"}],"final":false}');
  if r ->> 'status' <> 'parcial' then raise exception 'parcial com lixo falhou: %', r; end if;

  -- resposta de outro formulário
  begin
    perform public.resposta_salvar('ligado2-sql', '00000000-0000-0000-0000-0000000000b1', '{"final":false}');
    raise exception 'gravou resposta em formulário de outro';
  exception when insufficient_privilege then null;
  end;

  perform public.evento_registrar('teste-sql', 'anon-12345678', 'abriu', null, '{}');
  perform public.evento_registrar('teste-sql', 'anon-12345678', 'hackeou', null, '{}');
  perform public.evento_registrar('nao-existe', 'anon-12345678', 'abriu', null, '{}');
  perform public.evento_registrar('desligado-sql', 'anon-12345678', 'abriu', null, '{}');
  perform public.evento_registrar('ligado2-sql', 'anon-12345678', 'abriu', null, '{}');

  begin
    perform 1 from public.respostas;
    raise exception 'anônimo leu a tabela de respostas';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
do $$ begin
  if (select count(*) from public.eventos where formulario_id = '00000000-0000-0000-0000-0000000000f1') <> 1 then
    raise exception 'evento inválido entrou ou o válido não entrou';
  end if;
  if (select count(*) from public.eventos where formulario_slug = 'desligado-sql' or formulario_id = '00000000-0000-0000-0000-0000000000f2') <> 0 then
    raise exception 'evento de formulário desligado entrou';
  end if;
  if (select nome from public.respostas where id = '00000000-0000-0000-0000-0000000000b1') <> 'Ana' then
    raise exception 'resposta concluída mudou de nome';
  end if;
  if (select respostas from public.respostas where id = '00000000-0000-0000-0000-0000000000b1')
     <> '[{"slug":"nome","q":"Nome?","a":"Ana","papel":"nome"},{"slug":"fat","q":"Faturamento?","a":"Pouco","papel":null}]'::jsonb then
    raise exception 'respostas da concluída mudaram: %', (select respostas from public.respostas where id = '00000000-0000-0000-0000-0000000000b1');
  end if;
  if (select respostas from public.respostas where id = '00000000-0000-0000-0000-0000000000b2')
     <> '[{"slug":"nome","q":"Nome?","a":"Ana","papel":"nome"}]'::jsonb then
    raise exception 'respostas não foram limpas: %', (select respostas from public.respostas where id = '00000000-0000-0000-0000-0000000000b2');
  end if;
  -- apagar o formulário apaga os eventos dele
  if (select count(*) from public.eventos where formulario_id = '00000000-0000-0000-0000-0000000000f3') <> 1 then
    raise exception 'evento do formulário ligado 2 não entrou';
  end if;
  delete from public.formularios where id = '00000000-0000-0000-0000-0000000000f3';
  if (select count(*) from public.eventos where formulario_slug = 'ligado2-sql') <> 0 then
    raise exception 'eventos do formulário apagado ficaram';
  end if;
end $$;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
do $$ begin
  if (select count(*) from public.respostas where formulario_id = '00000000-0000-0000-0000-0000000000f1') <> 2 then raise exception 'membro não lê respostas'; end if;
  update public.formularios set nome = 'Editado' where slug = 'teste-sql';
  if (select nome from public.formularios where slug = 'teste-sql') <> 'Editado' then raise exception 'membro não edita formulário'; end if;
end $$;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}';
do $$ begin
  if (select count(*) from public.formularios where id in ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f3')) <> 0 then raise exception 'logado sem linha em membros leu formulários'; end if;
end $$;

reset role;
do $$ begin
  if not exists (select 1 from storage.buckets where id = 'formularios' and public) then raise exception 'bucket formularios ausente'; end if;
end $$;

select 'tudo certo' as resultado;
rollback;
