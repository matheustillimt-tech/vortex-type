"use server";
import { revalidatePath } from "next/cache";
import { checarAdmin } from "@/src/lib/permissoes";
import { ehUuid } from "@/src/lib/regras/acesso";
import { hostValido, normalizarHost } from "@/src/lib/regras/dominio";
import { dbAdmin } from "@/src/lib/supabase/admin";
import { adicionarNaVercel, removerDaVercel, verificarNaVercel } from "@/src/lib/vercel/dominios";

const SO_ADMIN = "Só Administradores mudam os domínios.";

export async function adicionarDominio(entrada: string, formularioId: string): Promise<{ erro?: string }> {
  const r = await checarAdmin();
  if (!r.ok) return { erro: SO_ADMIN };
  const host = normalizarHost(entrada);
  if (!hostValido(host)) return { erro: "Domínio inválido. Use algo como aplicacao.suaempresa.com." };
  if (!ehUuid(formularioId)) return { erro: "Escolha o formulário." };
  const v = await adicionarNaVercel(host);
  if ("erro" in v) return { erro: v.erro };
  const { error } = await dbAdmin().from("dominios").insert({ host, formulario_id: formularioId });
  if (error) return { erro: error.message.includes("duplicate") ? "Esse domínio já está cadastrado." : "Não foi possível salvar." };
  revalidatePath("/integracoes/dominios");
  return {};
}

export async function verificarDominio(id: string): Promise<{ erro?: string; verificado?: boolean }> {
  const r = await checarAdmin();
  if (!r.ok) return { erro: SO_ADMIN };
  if (!ehUuid(id)) return { erro: "Domínio inválido." };
  const db = dbAdmin();
  const { data } = await db.from("dominios").select("host").eq("id", id).maybeSingle();
  if (!data) return { erro: "Domínio não encontrado." };
  const v = await verificarNaVercel((data as { host: string }).host);
  if ("erro" in v) return { erro: v.erro };
  await db.from("dominios").update(v.verificado ? { status: "ativo", verificado_em: new Date().toISOString() } : { status: "pendente" }).eq("id", id);
  revalidatePath("/integracoes/dominios");
  return { verificado: v.verificado };
}

export async function removerDominio(id: string): Promise<{ erro?: string }> {
  const r = await checarAdmin();
  if (!r.ok) return { erro: SO_ADMIN };
  if (!ehUuid(id)) return { erro: "Domínio inválido." };
  const db = dbAdmin();
  const { data } = await db.from("dominios").select("host").eq("id", id).maybeSingle();
  if (!data) return { erro: "Domínio não encontrado." };
  const v = await removerDaVercel((data as { host: string }).host);
  if ("erro" in v) return { erro: v.erro };
  const { error } = await db.from("dominios").delete().eq("id", id);
  if (error) return { erro: "Não foi possível salvar." };
  revalidatePath("/integracoes/dominios");
  return {};
}
