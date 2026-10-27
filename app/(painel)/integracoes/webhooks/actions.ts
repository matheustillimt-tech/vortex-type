"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { siteUrl } from "@/src/lib/env";
import { checarAdmin } from "@/src/lib/permissoes";
import { ehUuid } from "@/src/lib/regras/acesso";
import { dbAdmin } from "@/src/lib/supabase/admin";
import { gerarSegredo } from "@/src/lib/webhooks/assinatura";
import { entregarAgora, type ResultadoEnvio } from "@/src/lib/webhooks/entregar";
import { urlWebhookValida } from "@/src/lib/webhooks/regras";

const SO_ADMIN = "Só Administradores mudam as integrações.";
const FALHOU = "Não foi possível salvar. Tente de novo.";

async function origem(): Promise<string> {
  const h = await headers();
  const host = h.get("host");
  return siteUrl(host ? `${h.get("x-forwarded-proto") ?? "https"}://${host}` : "");
}

const textoResultado = (r: ResultadoEnvio | null) =>
  !r ? "Não deu para enviar." : r.ok ? `Entregue (HTTP ${r.status}).` : `Não entregou: ${r.erro ?? "erro"}.`;

export async function salvarWebhook(dados: { id?: string; nome: string; url: string; formularios: string[] | null }): Promise<{ erro?: string }> {
  const r = await checarAdmin();
  if (!r.ok) return { erro: SO_ADMIN };
  const nome = dados.nome.trim();
  if (!nome || nome.length > 60) return { erro: "Nome: de 1 a 60 caracteres." };
  const erroUrl = urlWebhookValida(dados.url);
  if (erroUrl) return { erro: erroUrl };
  const formularios = dados.formularios === null ? null : dados.formularios.filter(ehUuid);
  if (formularios && !formularios.length) return { erro: "Escolha pelo menos um formulário (ou Todos)." };
  const db = dbAdmin();
  const linha = { nome, url: dados.url.trim(), formularios, atualizado_em: new Date().toISOString() };
  const { error } = dados.id
    ? ehUuid(dados.id) ? await db.from("webhooks").update(linha).eq("id", dados.id) : { error: { message: "id" } }
    : await db.from("webhooks").insert({ ...linha, segredo: gerarSegredo() });
  if (error) return { erro: FALHOU };
  revalidatePath("/integracoes/webhooks");
  return {};
}

export async function alternarWebhook(id: string, ativo: boolean): Promise<{ erro?: string }> {
  const r = await checarAdmin();
  if (!r.ok) return { erro: SO_ADMIN };
  if (!ehUuid(id)) return { erro: FALHOU };
  const { error } = await dbAdmin().from("webhooks").update({ ativo, atualizado_em: new Date().toISOString() }).eq("id", id);
  if (error) return { erro: FALHOU };
  revalidatePath("/integracoes/webhooks");
  return {};
}

export async function apagarWebhook(id: string): Promise<{ erro?: string }> {
  const r = await checarAdmin();
  if (!r.ok) return { erro: SO_ADMIN };
  if (!ehUuid(id)) return { erro: FALHOU };
  const { error } = await dbAdmin().from("webhooks").delete().eq("id", id);
  if (error) return { erro: FALHOU };
  revalidatePath("/integracoes/webhooks");
  return {};
}

export async function trocarSegredo(id: string): Promise<{ erro?: string }> {
  const r = await checarAdmin();
  if (!r.ok) return { erro: SO_ADMIN };
  if (!ehUuid(id)) return { erro: FALHOU };
  const { error } = await dbAdmin().from("webhooks").update({ segredo: gerarSegredo(), atualizado_em: new Date().toISOString() }).eq("id", id);
  if (error) return { erro: FALHOU };
  revalidatePath("/integracoes/webhooks");
  return {};
}

/** Manda já um aviso de exemplo (marcado `teste: true`) pro endereço do webhook. */
export async function testarWebhook(id: string): Promise<{ erro?: string; resultado?: string }> {
  const r = await checarAdmin();
  if (!r.ok) return { erro: SO_ADMIN };
  if (!ehUuid(id)) return { erro: FALHOU };
  const { data, error } = await dbAdmin().from("webhook_entregas").insert({ webhook_id: id, teste: true, proxima_em: new Date(Date.now() + 120_000).toISOString() }).select("id").single();
  if (error || !data) return { erro: FALHOU };
  const resultado = await entregarAgora((data as { id: number }).id, await origem());
  revalidatePath("/integracoes/webhooks");
  return { resultado: textoResultado(resultado) };
}

/** Reenvia já uma entrega (qualquer status). */
export async function reenviarEntrega(id: number): Promise<{ erro?: string; resultado?: string }> {
  const r = await checarAdmin();
  if (!r.ok) return { erro: SO_ADMIN };
  if (!Number.isInteger(id) || id <= 0) return { erro: FALHOU };
  const { error } = await dbAdmin().from("webhook_entregas").update({ status: "pendente", proxima_em: new Date(Date.now() + 120_000).toISOString() }).eq("id", id);
  if (error) return { erro: FALHOU };
  const resultado = await entregarAgora(id, await origem());
  revalidatePath("/integracoes/webhooks");
  return { resultado: textoResultado(resultado) };
}
