/** Conversa com a API pública do Vórtex Call, direto do navegador (CORS aberto lá). Sem React. */
import { aparece, normalizarTelefone, papelDe, porPapel, type Respostas } from "../formulario/fluxo";
import type { Pergunta } from "../formulario/tipos";
import { SLUG_AGENDA } from "./padroes";
import type { PedidoInscricao, ResultadoInscricao, SessaoCall } from "./tipos";

type Busca = typeof fetch;
/** Call que trava sem responder não pode prender a conversa: 10 s e vira erro de rede (cai em "naoAgendou"). */
const LIMITE_MS = 10_000;

/** AbortSignal.timeout não existe no Safari/iOS antigo (< 16): sem isso o agendamento falhava sempre lá. */
function controladorComTimeout(ms: number): { signal: AbortSignal; limpar: () => void } {
  if (typeof AbortSignal.timeout === "function") return { signal: AbortSignal.timeout(ms), limpar: () => {} };
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, limpar: () => clearTimeout(t) };
}

const buscar: Busca = (url, init) => {
  const { signal, limpar } = controladorComTimeout(LIMITE_MS);
  return fetch(url, { cache: "no-store", ...init, signal }).finally(limpar);
};

/** Endereço do Vórtex Call desta cópia, sem barra no fim. Null = agendamento desligado na cópia. */
export function urlCall(): string | null {
  // acesso literal: o Next troca pelo valor no build (vai pro navegador)
  const v = process.env.NEXT_PUBLIC_VORTEX_CALL_URL;
  return v && /^https?:\/\/[^\s/]+/.test(v) ? v.replace(/\/+$/, "") : null;
}

/** WhatsApp digitado → E.164 do Brasil (+55 + DDD + número), ou null. */
export function paraE164(v: string): string | null {
  const d = normalizarTelefone(v);
  return /^55\d{10,11}$/.test(d) ? `+${d}` : null;
}

/** Botão de confirmar presença no WhatsApp. Sem número, sem botão. */
export function linkWhatsapp(numero: string | null, mensagem: string): string | null {
  const d = (numero ?? "").replace(/\D/g, "");
  return d ? `https://wa.me/${d}?text=${encodeURIComponent(mensagem)}` : null;
}

const LIMITE_RESPOSTAS = 5000;
const UTMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

/**
 * Pares pergunta/resposta pra ficha do anfitrião no Call (formato `[{pergunta, resposta}]` que a ficha lê). Sem nome,
 * WhatsApp e e-mail (já vão nos campos próprios, e a IA da ficha não deve ver contato). Cada par é cortado
 * (300/600) e a lista para antes de passar do limite de 5000 caracteres do Call.
 */
export function paresParaCall(perguntas: Pergunta[], r: Respostas) {
  const pares: { pergunta: string; resposta: string }[] = [];
  for (const p of perguntas) {
    if (!aparece(p, r) || r[p.slug] == null || papelDe(p) !== "texto") continue;
    const par = { pergunta: p.texto.slice(0, 300), resposta: r[p.slug].slice(0, 600) };
    if (JSON.stringify([...pares, par]).length > LIMITE_RESPOSTAS) break;
    pares.push(par);
  }
  return pares;
}

/** Corpo do POST de inscrição. Null se faltar nome ou WhatsApp válido (não deveria: a conversa já validou). */
export function montarInscricao(o: { perguntas: Pergunta[]; respostas: Respostas; respostaId: string; sessao: string; origem: Record<string, string> }): PedidoInscricao | null {
  const nome = (porPapel(o.perguntas, o.respostas, "nome") ?? "").trim();
  const whatsapp = paraE164(porPapel(o.perguntas, o.respostas, "whatsapp") ?? "");
  if (!nome || !whatsapp) return null;
  const email = (porPapel(o.perguntas, o.respostas, "email") ?? "").trim().toLowerCase();
  const utm: Record<string, string> = {};
  for (const k of UTMS) if (o.origem[k]) utm[k] = o.origem[k].slice(0, 200);
  return {
    sessao: o.sessao,
    nome: nome.slice(0, 120),
    whatsapp,
    ...(email && { email }),
    resposta: o.respostaId,
    respostas: paresParaCall(o.perguntas, o.respostas),
    utm,
    origem: "encaixe",
  };
}

/** Sessões que dá pra mostrar: formato certo, não lotadas, em ordem de horário. */
export function sessoesValidas(v: unknown): SessaoCall[] {
  if (!Array.isArray(v)) return [];
  const valida = (s: unknown): s is SessaoCall => {
    const o = s as Record<string, unknown> | null;
    return !!o && typeof o === "object" && typeof o.id === "string" && typeof o.inicio === "string" && !Number.isNaN(Date.parse(o.inicio));
  };
  return v
    .filter(valida)
    .filter((s) => s.lotada !== true)
    .map((s) => ({ id: s.id, inicio: s.inicio, restantes: Number(s.restantes) || 0, lotada: false }))
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
}

const caminho = (base: string, agenda: string) => `${base}/api/agendamento/${encodeURIComponent(agenda)}`;

/** GET dos horários abertos. Lança em erro (a conversa trata como "sem horários"). */
export async function buscarHorarios(base: string, agenda: string, f: Busca = buscar): Promise<SessaoCall[]> {
  const res = await f(caminho(base, agenda), { cache: "no-store" });
  if (!res.ok) throw new Error(`Vórtex Call respondeu ${res.status}`);
  const corpo = (await res.json()) as { sessoes?: unknown };
  return sessoesValidas(corpo?.sessoes);
}

/** POST da inscrição. Nunca lança: 409 vira "lotou"; 400, 429, outro erro ou rede vira "falhou". */
export async function inscrever(base: string, agenda: string, pedido: PedidoInscricao, f: Busca = buscar): Promise<ResultadoInscricao> {
  let res: Response;
  try {
    res = await f(`${caminho(base, agenda)}/inscrever`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pedido) });
  } catch {
    return { tipo: "falhou" };
  }
  if (res.status === 409) return { tipo: "lotou" };
  if (!res.ok) return { tipo: "falhou" };
  const c = (await res.json().catch(() => null)) as { resultado?: unknown; inicio?: unknown; link?: unknown } | null;
  if (!c || typeof c.inicio !== "string" || Number.isNaN(Date.parse(c.inicio))) return { tipo: "falhou" };
  if (c.resultado === "nova") return { tipo: "nova", inicio: c.inicio, link: typeof c.link === "string" && /^https?:\/\//.test(c.link) ? c.link : null };
  if (c.resultado === "mesma" || c.resultado === "reagendada") return { tipo: c.resultado, inicio: c.inicio };
  return { tipo: "falhou" };
}

const SEM_CONEXAO = "Não deu pra falar com o Vórtex Call. Tente de novo.";

/** Botão "Testar" do editor: a agenda existe e quantos horários abertos tem. */
export async function testarAgenda(base: string, agenda: string, f: Busca = buscar): Promise<{ ok: true; abertos: number } | { ok: false; erro: string }> {
  if (!SLUG_AGENDA.test(agenda)) return { ok: false, erro: "Endereço inválido: use letras minúsculas, números e hífen." };
  try {
    const res = await f(caminho(base, agenda), { cache: "no-store" });
    if (res.status === 404) return { ok: false, erro: "Agenda não encontrada no Vórtex Call. Confira o endereço e se ela está ativa." };
    if (!res.ok) return { ok: false, erro: SEM_CONEXAO };
    const corpo = (await res.json()) as { sessoes?: unknown };
    return { ok: true, abertos: sessoesValidas(corpo?.sessoes).length };
  } catch {
    return { ok: false, erro: SEM_CONEXAO };
  }
}
