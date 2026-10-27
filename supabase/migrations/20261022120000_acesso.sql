-- Equipe: papel admin ou membro (Admin vê tudo; Membro vê Início, Formulários e Respostas).
create table public.membros (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  nome text not null default '' check (char_length(nome) <= 60),
  papel text not null default 'membro' check (papel in ('admin', 'membro'))
);
alter table public.membros enable row level security;
create policy le_a_propria on public.membros for select to authenticated using (usuario_id = auth.uid());
revoke all on public.membros from anon, authenticated;
grant select on public.membros to authenticated;
grant select, insert, update, delete on public.membros to service_role;

-- Cadastro é fechado: só o admin cria acesso (Equipe ou scripts/criar-admin.ts). Todo acesso novo nasce Membro.
create or replace function public.membro_novo() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.membros (usuario_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger membro_novo after insert on auth.users for each row execute function public.membro_novo();

-- Usadas na RLS (regras de acesso por linha) das outras tabelas.
create or replace function public.eh_membro() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.membros where usuario_id = auth.uid());
$$;
create or replace function public.eh_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.membros where usuario_id = auth.uid() and papel = 'admin');
$$;
revoke execute on function public.eh_membro(), public.eh_admin(), public.membro_novo() from public;
grant execute on function public.eh_membro(), public.eh_admin() to anon, authenticated, service_role;
