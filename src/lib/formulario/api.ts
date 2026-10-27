/** Chamadas da página pública. Tudo passa pelas funções do banco (o anon não lê tabela nenhuma). */
import type { FormularioPublico, Resposta } from "./tipos";

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function rpc<T>(fn: string, args: Record<string, unknown>, init?: RequestInit): Promise<T> {
  const res = await fetch(`${URL_SB}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` },
    body: JSON.stringify(args),
    ...init,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error((body && (body.message || body.error)) || `erro ${res.status}`);
  return body as T;
}

/** Usado no servidor (página e metadados). Sempre fresco: formulário desligado sai do ar na hora. */
export function buscarFormulario(slug: string) {
  return rpc<FormularioPublico | null>("formulario_publico", { p_slug: slug }, { cache: "no-store" } as RequestInit);
}

export type Origem = Record<string, string>;

export function salvarResposta(slug: string, id: string, dados: { nome?: string; whatsapp?: string; email?: string; empresa?: string; respostas: Resposta[]; final: boolean; origem: Origem }) {
  return rpc<{ id: string; status: string; desqualificado: boolean }>("resposta_salvar", { p_slug: slug, p_id: id, p_dados: dados });
}

export function evento(slug: string, anon: string, ev: string, resposta: string | null = null, meta: Record<string, unknown> = {}) {
  rpc("evento_registrar", { p_slug: slug, p_anon: anon, p_evento: ev, p_resposta: resposta, p_meta: meta }, { keepalive: true }).catch(() => {});
}
