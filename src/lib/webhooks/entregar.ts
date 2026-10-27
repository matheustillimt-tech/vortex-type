import "server-only";
import { lookup } from "node:dns/promises";
import type { RespostaLinha } from "../formulario/tipos";
import { dbAdmin } from "../supabase/admin";
import { assinar } from "./assinatura";
import { ipInterno, montarPayload, PAYLOAD_TESTE, proximaTentativa, urlWebhookValida } from "./regras";

/** Quantas entregas em paralelo por rodada (ver `processarItens`). */
const LOTE_CONCORRENTE = 10;
/** Prazo de cada envio (DNS + POST). */
const PRAZO_ENVIO_MS = 8_000;

/** `definitivo`: falha que não adianta tentar de novo (ex.: o nome aponta pra rede interna). */
export type ResultadoEnvio = { ok: boolean; status: number | null; erro: string | null; definitivo?: boolean };

/** Resolve o nome em todos os IPs (A e AAAA). */
export type Resolver = (host: string) => Promise<string[]>;
const resolverDns: Resolver = async (host) => (await lookup(host, { all: true, verbatim: true })).map((r) => r.address);

/** Confere pra onde o nome aponta antes do POST: a validação da URL só olha o texto, e um domínio público
 *  pode resolver pra 127.0.0.1 ou 10.x. `null` = pode enviar. (O `fetch` resolve de novo; um DNS que muda
 *  entre as duas consultas ainda passa, mas o caso comum fica barrado.) */
export async function conferirDestino(url: string, resolver: Resolver): Promise<ResultadoEnvio | null> {
  const host = new URL(url).hostname.replace(/^\[|\]$/g, "").replace(/\.+$/, "");
  let ips: string[];
  try {
    ips = await resolver(host);
  } catch {
    return { ok: false, status: null, erro: "Não deu para encontrar o endereço." };
  }
  if (!ips.length) return { ok: false, status: null, erro: "Não deu para encontrar o endereço." };
  if (ips.some(ipInterno)) return { ok: false, status: null, erro: "O endereço aponta pra rede interna.", definitivo: true };
  return null;
}

function comPrazo<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([p, new Promise<T>((_, rej) => { t = setTimeout(() => rej(new Error("prazo")), ms); })]).finally(() => clearTimeout(t));
}

/** POST do aviso. 8 s de prazo no total (DNS + envio), sem seguir redirecionamento; só 2xx conta como entregue.
 *  `resolver` é injetável pros testes. */
export async function enviarEntrega(
  e: { url: string; segredo: string; corpo: string; entregaId: number; evento: string },
  f: typeof fetch = fetch,
  resolver: Resolver = resolverDns,
): Promise<ResultadoEnvio> {
  const inicio = Date.now();
  const bloqueio = await conferirDestino(e.url, (h) => comPrazo(resolver(h), PRAZO_ENVIO_MS));
  if (bloqueio) return bloqueio;
  try {
    const res = await f(e.url, {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(Math.max(PRAZO_ENVIO_MS - (Date.now() - inicio), 1_000)),
      headers: {
        "content-type": "application/json",
        "user-agent": "Vortex-Type-Webhooks/1",
        "x-vortex-type-evento": e.evento,
        "x-vortex-type-entrega": String(e.entregaId),
        "x-vortex-type-assinatura": assinar(e.segredo, e.corpo),
      },
      body: e.corpo,
    });
    const resultado = res.status >= 200 && res.status < 300 ? { ok: true, status: res.status, erro: null } : { ok: false, status: res.status, erro: `HTTP ${res.status}` };
    await res.body?.cancel().catch(() => {});
    return resultado;
  } catch (err) {
    const tempo = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return { ok: false, status: null, erro: tempo ? "Tempo esgotado (8 s)." : "Não deu para conectar no endereço." };
  }
}

export type ItemFila = {
  id: number;
  tentativas: number;
  teste: boolean;
  evento: string;
  webhook: { url: string; segredo: string; ativo: boolean } | null;
  resposta: (RespostaLinha & { formularios: { slug: string; nome: string } | null }) | null;
};

type Deps = { enviar: typeof enviarEntrega; atualizar: (id: number, patch: Record<string, unknown>) => Promise<void>; siteUrl: string; agora: () => Date };

/** Envia um item e grava o resultado. Webhook desligado/apagado, URL que não passa mais na validação (ex.:
 *  virou IP ou rede interna depois de cadastrado) ou resposta sumida: falhou, sem enviar. */
async function processarUm(it: ItemFila, deps: Deps): Promise<"enviada" | "falha"> {
  if (!it.webhook?.ativo) {
    await deps.atualizar(it.id, { status: "falhou", ultimo_erro: "Webhook desligado." });
    return "falha";
  }
  const erroUrl = urlWebhookValida(it.webhook.url);
  if (erroUrl) {
    await deps.atualizar(it.id, { status: "falhou", ultimo_erro: erroUrl });
    return "falha";
  }
  const payload = it.teste ? PAYLOAD_TESTE(deps.siteUrl) : it.resposta?.formularios ? montarPayload(it.resposta, it.resposta.formularios, deps.siteUrl) : null;
  if (!payload) {
    await deps.atualizar(it.id, { status: "falhou", ultimo_erro: "Resposta não existe mais." });
    return "falha";
  }
  const r = await deps.enviar({ url: it.webhook.url, segredo: it.webhook.segredo, corpo: JSON.stringify(payload), entregaId: it.id, evento: it.evento });
  const tentativas = it.tentativas + 1;
  if (r.ok) {
    await deps.atualizar(it.id, { status: "enviado", tentativas, ultimo_status: r.status, ultimo_erro: null, enviado_em: deps.agora().toISOString() });
    return "enviada";
  }
  // Teste do botão "Testar" e falha definitiva não tentam de novo: falhou, acabou.
  const proxima = it.teste || r.definitivo ? null : proximaTentativa(tentativas, deps.agora());
  await deps.atualizar(it.id, proxima
    ? { status: "pendente", tentativas, ultimo_status: r.status, ultimo_erro: r.erro, proxima_em: proxima.toISOString() }
    : { status: "falhou", tentativas, ultimo_status: r.status, ultimo_erro: r.erro });
  return "falha";
}

/** Envia os itens em lotes de até `LOTE_CONCORRENTE` em paralelo (25 itens, 10 por vez, 8 s cada: 3 levas,
 *  24 s no pior caso por reserva). */
export async function processarItens(itens: ItemFila[], deps: Deps): Promise<{ enviadas: number; falhas: number }> {
  let enviadas = 0;
  let falhas = 0;
  for (let i = 0; i < itens.length; i += LOTE_CONCORRENTE) {
    const lote = itens.slice(i, i + LOTE_CONCORRENTE);
    const resultados = await Promise.all(lote.map((it) => processarUm(it, deps)));
    for (const r of resultados) r === "enviada" ? enviadas++ : falhas++;
  }
  return { enviadas, falhas };
}

type LinhaEntrega = { id: number; webhook_id: string; resposta_id: string | null; tentativas: number; teste: boolean; evento: string };

/** Busca webhook e resposta (com o formulário) de cada entrega em duas consultas. */
export async function carregarItens(entregas: LinhaEntrega[]): Promise<ItemFila[]> {
  if (!entregas.length) return [];
  const db = dbAdmin();
  const idsWebhook = [...new Set(entregas.map((e) => e.webhook_id))];
  const idsResposta = [...new Set(entregas.map((e) => e.resposta_id).filter((x): x is string => !!x))];
  const [{ data: webhooks, error: e1 }, { data: respostas, error: e2 }] = await Promise.all([
    db.from("webhooks").select("id, url, segredo, ativo").in("id", idsWebhook),
    idsResposta.length ? db.from("respostas").select("*, formularios(slug, nome)").in("id", idsResposta) : Promise.resolve({ data: [], error: null }),
  ]);
  if (e1 || e2) throw new Error(`Não deu para carregar a fila: ${(e1 ?? e2)!.message}`);
  const porWebhook = new Map((webhooks ?? []).map((w) => [w.id as string, w as { url: string; segredo: string; ativo: boolean }]));
  const porResposta = new Map((respostas ?? []).map((r) => [(r as { id: string }).id, r as ItemFila["resposta"]]));
  return entregas.map((e) => ({
    id: e.id,
    tentativas: e.tentativas,
    teste: e.teste,
    evento: e.evento,
    webhook: porWebhook.get(e.webhook_id) ?? null,
    resposta: e.resposta_id ? porResposta.get(e.resposta_id) ?? null : null,
  }));
}

const atualizar = async (id: number, patch: Record<string, unknown>) => {
  const { error } = await dbAdmin().from("webhook_entregas").update(patch).eq("id", id);
  if (error) console.error(`[webhooks] não deu para gravar a entrega ${id}: ${error.message}`);
};

/** Quantas entregas reservar por vez. */
const LOTE_RESERVA = 25;
/** Depois disso o cron não reserva mais nada. Uma reserva leva até ~24 s (25 itens, 10 por vez, 8 s cada:
 *  3 levas), então a última que começa perto dos 30 s termina em ~54 s, dentro do `maxDuration = 60` da rota. */
export const PRAZO_CRON_MS = 30_000;

/** Repete "reserva → envia" até a reserva vir vazia ou passar `prazoMs` desde o começo (o prazo é conferido
 *  antes de cada reserva; o que já foi reservado é sempre enviado). Devolve os totais. */
export async function processarAteAcabar(
  reservar: () => Promise<ItemFila[]>,
  processar: (itens: ItemFila[]) => Promise<{ enviadas: number; falhas: number }>,
  agora: () => number = Date.now,
  prazoMs: number = PRAZO_CRON_MS,
): Promise<{ enviadas: number; falhas: number; rodadas: number }> {
  const inicio = agora();
  const total = { enviadas: 0, falhas: 0, rodadas: 0 };
  while (agora() - inicio < prazoMs) {
    const itens = await reservar();
    if (!itens.length) break;
    const r = await processar(itens);
    total.enviadas += r.enviadas;
    total.falhas += r.falhas;
    total.rodadas++;
  }
  return total;
}

/** Uma execução do cron: reserva de `LOTE_RESERVA` em `LOTE_RESERVA` e envia, até acabar a fila ou o prazo. */
export async function processarFila(siteUrl: string, prazoMs: number = PRAZO_CRON_MS): Promise<{ enviadas: number; falhas: number; rodadas: number }> {
  const reservar = async () => {
    const { data, error } = await dbAdmin().rpc("webhook_entregas_reservar", { p_limite: LOTE_RESERVA });
    if (error) throw new Error(`Não deu para reservar a fila: ${error.message}`);
    return carregarItens((data ?? []) as LinhaEntrega[]);
  };
  const deps: Deps = { enviar: enviarEntrega, atualizar, siteUrl, agora: () => new Date() };
  return processarAteAcabar(reservar, (itens) => processarItens(itens, deps), Date.now, prazoMs);
}

/** Apaga o histórico de entregas com mais de 30 dias (uma vez por execução do cron; erro só vai pro log). */
export async function limparEntregasAntigas(): Promise<void> {
  const limite = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();
  const { error } = await dbAdmin().from("webhook_entregas").delete().lt("criado_em", limite);
  if (error) console.error(`[webhooks] não deu para apagar entregas antigas: ${error.message}`);
}

/** "Testar" e "Reenviar" do painel: envia já essa entrega (fora do cron) e devolve o resultado. */
export async function entregarAgora(entregaId: number, siteUrl: string): Promise<ResultadoEnvio | null> {
  const { data, error } = await dbAdmin().from("webhook_entregas").select("id, webhook_id, resposta_id, tentativas, teste, evento").eq("id", entregaId).maybeSingle();
  if (error || !data) return null;
  const [item] = await carregarItens([data as LinhaEntrega]);
  let resultado: ResultadoEnvio | null = null;
  await processarItens([item], {
    enviar: async (e) => (resultado = await enviarEntrega(e)),
    atualizar,
    siteUrl,
    agora: () => new Date(),
  });
  return resultado;
}
