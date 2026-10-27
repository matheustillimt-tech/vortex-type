import "server-only";
import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import type { Papel } from "./regras/acesso";
import { dbAdmin } from "./supabase/admin";
import { dbUsuario, exigirUsuario } from "./supabase/usuario";

export const SEM_PERMISSAO = "Você não tem permissão para isso.";

export type Acesso = { usuario: User; membro: { papel: Papel; nome: string } | null };

type Linha = { papel: Papel; nome: string } | null;

async function lerLinha(ler: () => PromiseLike<{ data: unknown; error: unknown }>): Promise<{ ok: true; linha: Linha } | { ok: false; erro: unknown }> {
  try {
    const { data, error } = await ler();
    if (error) return { ok: false, erro: error };
    return { ok: true, linha: (data as Linha) ?? null };
  } catch (e) {
    return { ok: false, erro: e };
  }
}

/** Uma leitura por requisição. Lê pela RLS; se a leitura der erro (não "sem linha"), tenta uma vez pelo servidor.
 *  Sem linha em `membros` = sem acesso a nada. */
export const membroAtual = cache(async (): Promise<Acesso> => {
  const usuario = await exigirUsuario();
  let r = await lerLinha(async () => (await dbUsuario()).from("membros").select("papel, nome").eq("usuario_id", usuario.id).maybeSingle());
  if (!r.ok) {
    console.error("[permissoes] leitura pela RLS falhou; tentando pelo servidor", r.erro);
    r = await lerLinha(() => dbAdmin().from("membros").select("papel, nome").eq("usuario_id", usuario.id).maybeSingle());
    if (!r.ok) return { usuario, membro: null };
  }
  return { usuario, membro: r.linha };
});

/** Pra server actions só de Administrador (equipe, marca, integrações). */
export async function checarAdmin(): Promise<({ ok: true } & Acesso) | { ok: false; erro: string }> {
  const acesso = await membroAtual();
  if (acesso.membro?.papel !== "admin") return { ok: false, erro: SEM_PERMISSAO };
  return { ok: true, ...acesso };
}
