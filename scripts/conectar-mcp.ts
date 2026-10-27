/**
 * Cria uma chave da API/MCP e já conecta o MCP do Vórtex Type no Claude Code da máquina, sem mostrar a chave.
 *   npx tsx scripts/conectar-mcp.ts [--env .env.producao.local] [--nome "Claude Code"] [--permissao escrita|leitura]
 *     [--site https://formularios.suaempresa.com.br] [--email quem@empresa.com]
 * A chave vai direto pro `claude mcp add` (escopo do usuário) e nunca é impressa. Pra desfazer: revogar a chave em
 * Integrações → API e MCP e `claude mcp remove vortex-type -s user`.
 */
import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function arg(nome: string): string | undefined {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

// Mesmo formato de src/lib/api/chaves.ts (que é server-only e não roda fora do Next).
const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
function gerarChave(): string {
  let saida = "";
  while (saida.length < 40) {
    for (const b of randomBytes(80)) {
      if (b >= 248) continue;
      saida += BASE62[b % 62];
      if (saida.length === 40) break;
    }
  }
  return `vt_${saida}`;
}

async function main() {
  const arquivoEnv = arg("env") ?? ".env.producao.local";
  process.loadEnvFile(arquivoEnv);
  const nome = (arg("nome") ?? "Claude Code").trim().slice(0, 60);
  const permissao = arg("permissao") ?? "escrita";
  if (permissao !== "escrita" && permissao !== "leitura") throw new Error("--permissao tem que ser escrita ou leitura");
  const site = (arg("site") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
  if (!/^https?:\/\//.test(site)) throw new Error("Informe o endereço do sistema com --site https://… ou NEXT_PUBLIC_SITE_URL no arquivo de env.");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) throw new Error(`NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar em ${arquivoEnv}`);
  const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

  let criadaPor: string | null = null;
  const email = arg("email")?.trim().toLowerCase();
  if (email) {
    const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
    criadaPor = data?.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
    if (!criadaPor) throw new Error(`Ninguém com o e-mail ${email} nesta cópia.`);
  }

  const chave = gerarChave();
  const { data, error } = await db
    .from("chaves_api")
    .insert({ nome, permissao, prefixo: chave.slice(3, 11), hash: createHash("sha256").update(chave, "utf8").digest("hex"), criada_por: criadaPor })
    .select("id")
    .single();
  if (error || !data) throw new Error("Não deu para criar a chave.");

  spawnSync("claude", ["mcp", "remove", "vortex-type", "-s", "user"], { stdio: "ignore" });
  const r = spawnSync("claude", ["mcp", "add", "--transport", "http", "-s", "user", "vortex-type", `${site}/api/mcp`, "--header", `Authorization: Bearer ${chave}`], {
    stdio: ["ignore", "ignore", "pipe"],
  });
  if (r.status !== 0) {
    await db.from("chaves_api").update({ revogada_em: new Date().toISOString() }).eq("id", (data as { id: string }).id);
    throw new Error(`O claude mcp add falhou (a chave foi revogada): ${r.stderr?.toString().replaceAll(chave, "vt_…").trim()}`);
  }
  console.log(`Pronto: chave "${nome}" (${permissao}, começa com vt_${chave.slice(3, 11)}…) criada e MCP vortex-type conectado em ${site}/api/mcp.`);
  console.log("Abra uma sessão nova do Claude Code pra ver as ferramentas do Vórtex Type.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
