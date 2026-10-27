import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { dbAdmin } from "../supabase/admin";

/** Chaves da API e do MCP: `vt_` + 40 caracteres base62. O banco guarda só o prefixo e o hash (SHA-256 hex);
 *  a chave em texto aparece uma vez, na criação. Nunca logar a chave. */

export const PERMISSOES = ["leitura", "escrita"] as const;
export type Permissao = (typeof PERMISSOES)[number];
export const FORMATO_CHAVE = /^vt_[0-9A-Za-z]{40}$/;

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** Sem viés: descarta bytes ≥ 248 (maior múltiplo de 62 abaixo de 256). */
export function gerarChave(): string {
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

export const hashDaChave = (chave: string) => createHash("sha256").update(chave, "utf8").digest("hex");
export const prefixoDaChave = (chave: string) => chave.slice(3, 11);
export const ehPermissao = (v: unknown): v is Permissao => typeof v === "string" && (PERMISSOES as readonly string[]).includes(v);

export async function criarChave(e: { nome: string; permissao: string; criadaPor: string }): Promise<{ chave: string; id: string } | { erro: string }> {
  const nome = e.nome.trim();
  if (nome.length < 1 || nome.length > 60) return { erro: "Nome da chave: de 1 a 60 caracteres." };
  if (!ehPermissao(e.permissao)) return { erro: "Permissão inválida." };
  const chave = gerarChave();
  const { data, error } = await dbAdmin()
    .from("chaves_api")
    .insert({ nome, permissao: e.permissao, prefixo: prefixoDaChave(chave), hash: hashDaChave(chave), criada_por: e.criadaPor })
    .select("id")
    .single();
  if (error || !data) return { erro: "Não deu para criar a chave." };
  return { chave, id: (data as { id: string }).id };
}

export async function revogarChave(id: string): Promise<{ ok: true } | { erro: string }> {
  const { data, error } = await dbAdmin().from("chaves_api").update({ revogada_em: new Date().toISOString() }).eq("id", id).is("revogada_em", null).select("id");
  if (error) return { erro: "Não deu para revogar a chave." };
  if (!(data as unknown[] | null)?.length) return { erro: "Chave não encontrada ou já revogada." };
  return { ok: true };
}
