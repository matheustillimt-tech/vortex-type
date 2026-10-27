-- Opcional: entrega dos webhooks a cada minuto usando o próprio Supabase (funciona no plano grátis).
--
-- Por quê: a fila de webhooks é processada pela rota /api/cron/webhooks. No plano grátis da Vercel o cron
-- só pode rodar uma vez por dia (é o que está no vercel.json). Com este agendamento, o Supabase chama essa
-- rota a cada minuto.
--
-- Este arquivo NÃO é uma migração (não roda no `supabase db push`). Rode à mão, uma vez, no SQL Editor do
-- Supabase, DEPOIS de publicar o sistema na Vercel. Antes de rodar, troque os dois marcadores do passo 2:
--   https://SEU-DOMINIO  → o endereço do sistema (o mesmo de NEXT_PUBLIC_SITE_URL, sem barra no fim)
--   SEU-CRON-SECRET      → o mesmo valor de CRON_SECRET cadastrado na Vercel
-- Os dois ficam guardados no Supabase Vault (cofre de segredos do Supabase), nunca no código.

-- 1. Extensões de agendamento (pg_cron) e de chamada HTTP (pg_net). Também dá pra ligar pelo painel:
--    Integrations → Cron e Database → Extensions → pg_net.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- 2. Guarda o endereço e o segredo no Vault (troque os marcadores antes de rodar). Rode uma vez só: o nome
--    do segredo não pode repetir (pra trocar depois, use o vault.update_secret do fim do arquivo).
select vault.create_secret('https://SEU-DOMINIO', 'vortex_type_url', 'Endereço do Vórtex Type');
select vault.create_secret('SEU-CRON-SECRET', 'vortex_type_cron_secret', 'CRON_SECRET do Vórtex Type');

-- 3. Agenda a chamada a cada minuto.
select cron.schedule(
  'vortex-type-webhooks',
  '* * * * *',
  $$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'vortex_type_url') || '/api/cron/webhooks',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'vortex_type_cron_secret')
    ),
    timeout_milliseconds := 60000
  );
  $$
);

-- Pra conferir:   select * from cron.job_run_details order by start_time desc limit 5;
-- Pra desligar:   select cron.unschedule('vortex-type-webhooks');
-- Trocou o segredo ou o endereço? Atualize no Vault:
--   select vault.update_secret((select id from vault.secrets where name = 'vortex_type_cron_secret'), 'NOVO-VALOR');
