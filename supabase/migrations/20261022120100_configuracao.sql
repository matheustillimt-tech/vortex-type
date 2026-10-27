-- Marca da cópia (uma por cliente): uma linha só. Leitura livre (login e aba do navegador precisam);
-- escrita só pelo servidor (Configurações → Marca confere se é admin).
create table public.configuracao (
  id boolean primary key default true check (id),
  nome_sistema text not null default 'Vórtex Type' check (char_length(nome_sistema) between 1 and 40),
  logo_url text,
  favicon_url text,
  cor_principal text not null default '#0fa968' check (cor_principal ~ '^#[0-9a-fA-F]{6}$'),
  updated_at timestamptz not null default now()
);
insert into public.configuracao (id) values (true) on conflict do nothing;
alter table public.configuracao enable row level security;
create policy le_todos on public.configuracao for select to anon, authenticated using (true);
revoke all on public.configuracao from anon, authenticated;
grant select on public.configuracao to anon, authenticated;
grant select, insert, update on public.configuracao to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marca', 'marca', true, 1048576,
        array['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon'])
on conflict (id) do nothing;
