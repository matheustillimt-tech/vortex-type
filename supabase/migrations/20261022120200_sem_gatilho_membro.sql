-- Remove o gatilho que criava membro sozinho em todo signup: sem linha em `membros` = sem acesso a nada.
-- Acesso novo só nasce pela Equipe (`criarAcesso`, que já faz upsert) ou por `scripts/criar-admin.ts` (idem).
drop trigger if exists membro_novo on auth.users;
drop function if exists public.membro_novo();
