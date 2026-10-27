import "server-only";
import { autenticarChave, type ChaveAutenticada } from "./auth";

const SEM_CACHE = { "cache-control": "no-store" };
export const json = (corpo: unknown, status = 200, cabecalhos: Record<string, string> = {}) => Response.json(corpo, { status, headers: { ...SEM_CACHE, ...cabecalhos } });
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Autentica e roda `f`; padroniza os erros. */
export async function comChave(req: Request, f: (chave: ChaveAutenticada) => Promise<Response>): Promise<Response> {
  const a = await autenticarChave(req);
  if (!("chave" in a)) return json({ erro: a.mensagem }, a.status, a.cabecalhos);
  try {
    return await f(a.chave);
  } catch (e) {
    console.error("[api v1]", e);
    return json({ erro: "Não deu para consultar agora." }, 500);
  }
}
