/**
 * Primeiro Administrador de uma cópia do Vórtex Type (o cadastro é fechado).
 *   npx tsx scripts/criar-admin.ts --email pessoa@empresa.com --nome "Nome" [--env .env.local] [--guardar-senha]
 * Produção: quem roda é o dono da cópia, no terminal dele (a senha aparece uma vez só, ali).
 * --guardar-senha: só pra Supabase local de teste; grava ADMIN_TESTE_EMAIL/ADMIN_TESTE_SENHA no arquivo de env.
 */
import { appendFileSync } from "node:fs";
import { randomInt } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function arg(nome: string): string | undefined {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const arquivoEnv = arg("env") ?? ".env.local";
  process.loadEnvFile(arquivoEnv);
  const email = arg("email")?.trim().toLowerCase();
  const nome = (arg("nome") ?? "").trim().slice(0, 60);
  const guardar = process.argv.includes("--guardar-senha");
  if (!email || !nome) {
    console.error('Uso: npx tsx scripts/criar-admin.ts --email pessoa@empresa.com --nome "Nome" [--env arquivo] [--guardar-senha]');
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) throw new Error(`NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar em ${arquivoEnv}`);
  const db = createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });

  const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const senha = Array.from({ length: 16 }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");

  const { data: lista, error: erroLista } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (erroLista) throw erroLista;
  let id = lista.users.find((u) => u.email?.toLowerCase() === email)?.id;
  let criado = false;
  if (!id) {
    const { data, error } = await db.auth.admin.createUser({ email, password: senha, email_confirm: true });
    if (error || !data.user) throw error ?? new Error("Não foi possível criar o usuário.");
    id = data.user.id;
    criado = true;
  }

  const { error } = await db.from("membros").upsert({ usuario_id: id, nome, papel: "admin", updated_at: new Date().toISOString() }, { onConflict: "usuario_id" });
  if (error) throw error;

  if (!criado) console.log(`${email} já tinha acesso: agora é Administrador (senha não mudou).`);
  else if (guardar) {
    appendFileSync(arquivoEnv, `ADMIN_TESTE_EMAIL=${email}\nADMIN_TESTE_SENHA=${senha}\n`);
    console.log(`Administrador criado. Senha guardada em ${arquivoEnv}.`);
  } else console.log(`Administrador criado: ${email}\nSenha (aparece só agora; troque em Meu perfil): ${senha}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
