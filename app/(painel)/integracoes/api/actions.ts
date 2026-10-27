"use server";
import { revalidatePath } from "next/cache";
import { criarChave, revogarChave } from "@/src/lib/api/chaves";
import { checarAdmin } from "@/src/lib/permissoes";
import { ehUuid } from "@/src/lib/regras/acesso";

export async function criarChaveApi(nome: string, permissao: string): Promise<{ erro?: string; chave?: string }> {
  const r = await checarAdmin();
  if (!r.ok) return { erro: "Só Administradores criam chaves." };
  const c = await criarChave({ nome, permissao, criadaPor: r.usuario.id });
  if ("erro" in c) return { erro: c.erro };
  revalidatePath("/integracoes/api");
  return { chave: c.chave };
}

export async function revogarChaveApi(id: string): Promise<{ erro?: string }> {
  const r = await checarAdmin();
  if (!r.ok) return { erro: "Só Administradores revogam chaves." };
  if (!ehUuid(id)) return { erro: "Chave inválida." };
  const v = await revogarChave(id);
  if ("erro" in v) return { erro: v.erro };
  revalidatePath("/integracoes/api");
  return {};
}
