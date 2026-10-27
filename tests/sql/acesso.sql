-- Teste das migrações de acesso e configuração. Roda numa transação e desfaz tudo no fim.
begin;

insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-000000000001', 'admin@sql.teste', 'authenticated', 'authenticated'),
       ('00000000-0000-0000-0000-000000000002', 'membro@sql.teste', 'authenticated', 'authenticated');

do $$ begin
  if exists (
    select 1 from public.membros
     where usuario_id in ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002')
  ) then raise exception 'acesso novo não pode virar membro sozinho'; end if;
end $$;

insert into public.membros (usuario_id, papel) values
  ('00000000-0000-0000-0000-000000000001', 'admin'),
  ('00000000-0000-0000-0000-000000000002', 'membro');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
do $$ begin
  if not public.eh_membro() then raise exception 'eh_membro falhou pro membro'; end if;
  if public.eh_admin() then raise exception 'membro não pode ser admin'; end if;
  if (select count(*) from public.membros) <> 1 then raise exception 'membro só lê a própria linha'; end if;
  begin
    update public.membros set papel = 'admin';
    raise exception 'membro conseguiu mudar o papel';
  exception when insufficient_privilege then null;
  end;
end $$;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
do $$ begin
  if not public.eh_admin() then raise exception 'eh_admin falhou pro admin'; end if;
end $$;

reset role;
set local request.jwt.claims = '{}';
set local role anon;
do $$ begin
  if (select nome_sistema from public.configuracao) <> 'Vórtex Type' then raise exception 'configuração padrão errada'; end if;
  if (select cor_principal from public.configuracao) <> '#0fa968' then raise exception 'cor padrão errada'; end if;
  if public.eh_membro() then raise exception 'anônimo não é membro'; end if;
  begin
    update public.configuracao set nome_sistema = 'invadido';
    raise exception 'anônimo conseguiu editar a configuração';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
do $$ begin
  if not exists (select 1 from storage.buckets where id = 'marca' and public) then raise exception 'bucket marca ausente'; end if;
end $$;

select 'tudo certo' as resultado;
rollback;
