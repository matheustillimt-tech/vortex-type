import "server-only";
import { dbAdmin } from "../supabase/admin";
import { FORMATO_CHAVE, hashDaChave, type Permissao } from "./chaves";

export type ChaveAutenticada = { id: string; nome: string; permissao: Permissao; usuarioId: string | null };
export type FalhaAuth = { status: 401 | 429 | 503; mensagem: string; cabecalhos?: Record<string, string> };

export const LIMITE_POR_MINUTO = 120;
export const ERROS_AUTH = {
  naoAutenticado: "Chave ausente ou inválida.",
  limite: `Limite de ${LIMITE_POR_MINUTO} chamadas por minuto atingido. Tente de novo em instantes.`,
  indisponivel: "Não deu para conferir a chave agora. Tente de novo.",
} as const;

function chaveDoHeader(req: Request): string | null {
  const m = /^Bearer\s+(\S+)\s*$/i.exec(req.headers.get("authorization") ?? "");
  return m && FORMATO_CHAVE.test(m[1]) ? m[1] : null;
}

export async function registrarUso(chaveId: string): Promise<"ok" | "limite" | "indisponivel"> {
  const { data, error } = await dbAdmin().rpc("api_registrar_uso", { p_chave: chaveId });
  if (error) return "indisponivel";
  return Number(data) > LIMITE_POR_MINUTO ? "limite" : "ok";
}

const retry = () => ({ "retry-after": String(60 - new Date().getUTCSeconds()) });

/** Chave inexistente, revogada, mal formada ou de quem não é mais Administrador → 401; acima do limite → 429.
 *  Conta 1 chamada. Nunca loga a chave nem o header. */
export async function autenticarChave(req: Request): Promise<{ chave: ChaveAutenticada } | FalhaAuth> {
  const texto = chaveDoHeader(req);
  if (!texto) return { status: 401, mensagem: ERROS_AUTH.naoAutenticado };
  const db = dbAdmin();
  const { data, error } = await db.from("chaves_api").select("id, nome, permissao, criada_por, revogada_em").eq("hash", hashDaChave(texto)).maybeSingle();
  if (error) return { status: 503, mensagem: ERROS_AUTH.indisponivel };
  const linha = data as { id: string; nome: string; permissao: Permissao; criada_por: string | null; revogada_em: string | null } | null;
  if (!linha || linha.revogada_em || !linha.criada_por) return { status: 401, mensagem: ERROS_AUTH.naoAutenticado };
  const { data: membro, error: erroMembro } = await db.from("membros").select("papel").eq("usuario_id", linha.criada_por).maybeSingle();
  if (erroMembro) return { status: 503, mensagem: ERROS_AUTH.indisponivel };
  if ((membro as { papel: string } | null)?.papel !== "admin") return { status: 401, mensagem: ERROS_AUTH.naoAutenticado };
  const uso = await registrarUso(linha.id);
  if (uso === "indisponivel") return { status: 503, mensagem: ERROS_AUTH.indisponivel };
  if (uso === "limite") return { status: 429, mensagem: ERROS_AUTH.limite, cabecalhos: retry() };
  return { chave: { id: linha.id, nome: linha.nome, permissao: linha.permissao, usuarioId: linha.criada_por } };
}
