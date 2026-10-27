import "server-only";
import type { Formulario, RespostaLinha } from "../formulario/tipos";
import { funil, resumo } from "../formulario/metricas";
import { siteUrl } from "../env";
import { dbAdmin } from "../supabase/admin";
import type { FiltroApi } from "./parametros";

/** Consultas da API REST e do MCP (service role; quem chama já autenticou a chave). */

export type FormularioResumo = { id: string; slug: string; nome: string; ativo: boolean; link: string; perguntas: number; criado_em: string; atualizado_em: string };

const falhou = (e: { message: string } | null) => {
  if (e) throw new Error(e.message);
};

export async function listarFormularios(): Promise<FormularioResumo[]> {
  const { data, error } = await dbAdmin().from("formularios").select("id, slug, nome, ativo, perguntas, criado_em, atualizado_em").order("criado_em");
  falhou(error);
  return ((data ?? []) as (Formulario & { perguntas: unknown[] })[]).map((f) => ({
    id: f.id, slug: f.slug, nome: f.nome, ativo: f.ativo, link: `${siteUrl()}/${f.slug}`, perguntas: Array.isArray(f.perguntas) ? f.perguntas.length : 0,
    criado_em: f.criado_em, atualizado_em: f.atualizado_em,
  }));
}

export async function verFormulario(id: string): Promise<Formulario | null> {
  const { data, error } = await dbAdmin().from("formularios").select("*").eq("id", id).maybeSingle();
  falhou(error);
  return (data as Formulario | null) ?? null;
}

/** Mais novas primeiro (empate em `criado_em` resolvido por `id`, pra não perder nem repetir linha entre páginas).
 *  `proximo` = `<criado_em>_<id>` da última, pra pedir a página seguinte com `antes`. */
export async function listarRespostas(f: FiltroApi): Promise<{ respostas: RespostaLinha[]; proximo: string | null }> {
  let q = dbAdmin().from("respostas").select("*");
  if (f.formulario) q = q.eq("formulario_id", f.formulario);
  if (f.status) q = q.eq("status", f.status);
  if (f.de) q = q.gte("criado_em", f.de);
  if (f.ate) q = q.lt("criado_em", f.ate);
  if (f.antes) {
    const { criadoEm, id } = f.antes;
    // Valor entre aspas: o timestamp tem `+`, `:` e `.`, que a gramática do `.or()` do PostgREST só aceita
    // dentro de um literal com aspas (supabase-js cuida de URL-codificar o parâmetro inteiro).
    q = q.or(`criado_em.lt."${criadoEm}",and(criado_em.eq."${criadoEm}",id.lt.${id})`);
  }
  const { data, error } = await q.order("criado_em", { ascending: false }).order("id", { ascending: false }).limit(f.limite);
  falhou(error);
  const respostas = (data ?? []) as RespostaLinha[];
  const ultima = respostas[respostas.length - 1];
  return { respostas, proximo: respostas.length === f.limite ? `${ultima.criado_em}_${ultima.id}` : null };
}

export async function verResposta(id: string): Promise<RespostaLinha | null> {
  const { data, error } = await dbAdmin().from("respostas").select("*").eq("id", id).maybeSingle();
  falhou(error);
  return (data as RespostaLinha | null) ?? null;
}

const PAGINA = 1000;

/** O PostgREST corta cada resposta em `max_rows` (1000), então `.limit()` maior não adianta: busca de 1000 em
 *  1000 (a consulta tem que ter ordem fixa) até vir uma página incompleta ou chegar em `maxPaginas`.
 *  `truncado` = parou no teto com dados ainda por vir. */
export async function buscarPaginado<T>(
  pagina: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  maxPaginas: number,
): Promise<{ linhas: T[]; truncado: boolean }> {
  const linhas: T[] = [];
  for (let i = 0; i < maxPaginas; i++) {
    const { data, error } = await pagina(i * PAGINA, (i + 1) * PAGINA - 1);
    falhou(error);
    const lote = data ?? [];
    linhas.push(...lote);
    if (lote.length < PAGINA) return { linhas, truncado: false };
  }
  return { linhas, truncado: true };
}

export async function metricasFormulario(id: string, de: string, ate: string) {
  const f = await verFormulario(id);
  if (!f) return null;
  const db = dbAdmin();
  const [respostas, eventos] = await Promise.all([
    buscarPaginado<Pick<RespostaLinha, "status">>(
      (i, j) => db.from("respostas").select("status").eq("formulario_id", id).gte("criado_em", de).lt("criado_em", ate).order("criado_em").order("id").range(i, j),
      50,
    ),
    buscarPaginado<{ anon_id: string; evento: string; meta: Record<string, unknown> }>(
      (i, j) => db.from("eventos").select("anon_id, evento, meta").eq("formulario_id", id).gte("criado_em", de).lt("criado_em", ate).order("criado_em").order("id").range(i, j),
      100,
    ),
  ]);
  return {
    formulario: { id: f.id, slug: f.slug, nome: f.nome },
    periodo: { de, ate },
    resumo: resumo(respostas.linhas as RespostaLinha[]),
    funil: funil(f.perguntas, eventos.linhas, !!f.agendamento),
    truncado: respostas.truncado || eventos.truncado,
  };
}
