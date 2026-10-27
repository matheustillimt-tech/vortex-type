import "server-only";
import { envOpcional } from "../env";

/** Domínios do projeto na Vercel (https://vercel.com/docs/rest-api). Sem VERCEL_TOKEN, VERCEL_PROJECT_ID e
 *  VERCEL_TEAM_ID, domínios ficam desligados nesta cópia. Nunca logar o token. */

const API = "https://api.vercel.com";

export function vercelConfigurada(): boolean {
  return !!(envOpcional("VERCEL_TOKEN") && envOpcional("VERCEL_PROJECT_ID") && envOpcional("VERCEL_TEAM_ID"));
}

async function chamar(caminho: string, init: RequestInit, f: typeof fetch): Promise<{ ok: boolean; status: number; corpo: Record<string, unknown> | null }> {
  const projeto = encodeURIComponent(envOpcional("VERCEL_PROJECT_ID") ?? "");
  const url = `${API}${caminho.replace("{projeto}", projeto)}${caminho.includes("?") ? "&" : "?"}teamId=${encodeURIComponent(envOpcional("VERCEL_TEAM_ID") ?? "")}`;
  const res = await f(url, { ...init, headers: { authorization: `Bearer ${envOpcional("VERCEL_TOKEN")}`, "content-type": "application/json" } });
  const corpo = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return { ok: res.ok, status: res.status, corpo };
}

const mensagemVercel = (c: Record<string, unknown> | null) => {
  const e = c?.error as { code?: string; message?: string } | undefined;
  if (e?.code === "domain_already_in_use" || e?.code === "domain_taken") return "Esse domínio já está em uso em outro projeto da Vercel.";
  return "A Vercel recusou o domínio. Confira o endereço e tente de novo.";
};

export async function adicionarNaVercel(host: string, f: typeof fetch = fetch): Promise<{ ok: true } | { erro: string }> {
  if (!vercelConfigurada()) return { erro: "Domínios estão desligados nesta cópia." };
  const r = await chamar("/v10/projects/{projeto}/domains", { method: "POST", body: JSON.stringify({ name: host }) }, f);
  if (r.ok || (r.corpo?.error as { code?: string } | undefined)?.code === "domain_already_in_use_by_project") return { ok: true };
  return { erro: mensagemVercel(r.corpo) };
}

export async function verificarNaVercel(host: string, f: typeof fetch = fetch): Promise<{ ok: true; verificado: boolean } | { erro: string }> {
  if (!vercelConfigurada()) return { erro: "Domínios estão desligados nesta cópia." };
  const r = await chamar(`/v9/projects/{projeto}/domains/${encodeURIComponent(host)}/verify`, { method: "POST" }, f);
  if (r.ok) return { ok: true, verificado: r.corpo?.verified === true };
  const g = await chamar(`/v9/projects/{projeto}/domains/${encodeURIComponent(host)}`, { method: "GET" }, f);
  if (!g.ok) return { erro: "Não deu para consultar a Vercel agora." };
  // Domínio verificado na Vercel ainda pode estar sem DNS: confere a configuração.
  const cfg = await chamar(`/v6/domains/${encodeURIComponent(host)}/config`, { method: "GET" }, f);
  return { ok: true, verificado: g.corpo?.verified === true && cfg.corpo?.misconfigured === false };
}

export async function removerDaVercel(host: string, f: typeof fetch = fetch): Promise<{ ok: true } | { erro: string }> {
  if (!vercelConfigurada()) return { ok: true };
  const r = await chamar(`/v9/projects/{projeto}/domains/${encodeURIComponent(host)}`, { method: "DELETE" }, f);
  return r.ok || r.status === 404 ? { ok: true } : { erro: "Não deu para remover o domínio na Vercel." };
}
