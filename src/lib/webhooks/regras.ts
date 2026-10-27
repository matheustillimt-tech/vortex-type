/** Regras dos webhooks: tentativas, URL aceita e o formato do aviso (payload). Puro. */
import type { RespostaLinha } from "../formulario/tipos";

export const EVENTO_RESPOSTA = "resposta.concluida";
export const MAX_TENTATIVAS = 5;
/** Espera depois da 1ª, 2ª, 3ª e 4ª falha (minutos). A 5ª falha desiste. */
const ESPERAS_MIN = [1, 5, 30, 120];

export function proximaTentativa(tentativasFeitas: number, agora: Date): Date | null {
  if (tentativasFeitas >= MAX_TENTATIVAS) return null;
  const min = ESPERAS_MIN[Math.min(Math.max(tentativasFeitas, 1), ESPERAS_MIN.length) - 1];
  return new Date(agora.getTime() + min * 60_000);
}

/** Os 8 blocos de 16 bits de um IPv6 (aceita `::`, IPv4 no fim e zona `%eth0`); `null` se não for IPv6. */
function blocosIpv6(ip: string): number[] | null {
  let t = ip.replace(/^\[|\]$/g, "").split("%")[0].toLowerCase();
  if (!t.includes(":")) return null;
  const v4 = /(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(t);
  if (v4) {
    const n = v4.slice(1).map(Number);
    if (n.some((x) => x > 255)) return null;
    t = t.slice(0, v4.index) + ((n[0] << 8) | n[1]).toString(16) + ":" + ((n[2] << 8) | n[3]).toString(16);
  }
  const partes = t.split("::");
  if (partes.length > 2) return null;
  const ler = (x: string) => (x ? x.split(":") : []);
  const ini = ler(partes[0]);
  const fim = partes.length === 2 ? ler(partes[1]) : [];
  const faltam = 8 - ini.length - fim.length;
  if (partes.length === 2 ? faltam < 1 : faltam !== 0) return null;
  const todos = [...ini, ...Array(partes.length === 2 ? faltam : 0).fill("0"), ...fim];
  if (todos.some((b) => !/^[0-9a-f]{1,4}$/.test(b))) return null;
  return todos.map((b) => parseInt(b, 16));
}

function ipv4Interno(a: number, b: number): boolean {
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

/** IP (v4 ou v6) de rede interna: privado, loopback, link-local, CGNAT (100.64/10), ULA (fc00::/7), não
 *  especificado, multicast/reservado, e IPv4 mapeado em IPv6 (`::ffff:127.0.0.1`) pelo IPv4 de dentro.
 *  Texto que não é IP → `false`. Puro (sem import do Node). */
export function ipInterno(ip: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip.trim());
  if (m) {
    const n = m.slice(1).map(Number);
    return n.every((x) => x <= 255) && ipv4Interno(n[0], n[1]);
  }
  const b = blocosIpv6(ip.trim());
  if (!b) return false;
  // ::ffff:a.b.c.d (mapeado) e ::a.b.c.d (compatível, obsoleto): vale o IPv4 de dentro.
  if (b.slice(0, 5).every((x) => x === 0) && (b[5] === 0xffff || (b[5] === 0 && (b[6] !== 0 || b[7] > 1)))) return ipv4Interno(b[6] >> 8, b[6] & 0xff);
  if (b.slice(0, 7).every((x) => x === 0)) return b[7] <= 1; // :: e ::1
  return (b[0] & 0xfe00) === 0xfc00 || (b[0] & 0xffc0) === 0xfe80 || (b[0] & 0xff00) === 0xff00;
}

function hostInterno(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  return ipInterno(h);
}

/** IP literal (IPv4 puro ou IPv6, com ou sem colchetes) depois da canonicalização do `URL`. Isso pega também
 *  disfarces como IPv4-mapeado em IPv6 (`::ffff:169.254.169.254`) ou IPv4 decimal (`2130706433`). */
function ehIpLiteral(host: string): boolean {
  if (host.includes(":")) return true; // IPv6 (o `URL` sempre devolve entre colchetes, que também contêm ":")
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
}

/** Erro em português ou `null`. Só https público, com nome de domínio (o servidor faz o POST: nada de rede
 *  interna nem de IP literal, que escapa fácil do filtro por domínio). */
export function urlWebhookValida(url: string): string | null {
  const t = url.trim();
  if (t.length > 500) return "Endereço longo demais (máximo 500 caracteres).";
  let u: URL;
  try {
    u = new URL(t);
  } catch {
    return "Endereço inválido.";
  }
  if (u.protocol !== "https:") return "Use um endereço que comece com https://.";
  // DNS ignora o ponto final de um nome ("localhost." == "localhost"); sem isso, um ponto no fim escapava
  // das checagens de IP e de host interno.
  const hostname = u.hostname.replace(/\.+$/, "");
  if (ehIpLiteral(hostname)) return "Use o endereço com nome de domínio (não um IP).";
  if (hostInterno(hostname)) return "Esse endereço é de rede interna. Use um endereço público.";
  return null;
}

export type PayloadResposta = {
  evento: string;
  teste?: boolean;
  id: string;
  formulario: string;
  formularioNome: string;
  link: string;
  status: string;
  nome: string | null;
  primeiroNome: string;
  whatsapp: string | null;
  email: string | null;
  empresa: string | null;
  respostas: RespostaLinha["respostas"];
  criadoEm: string;
  concluidoEm: string | null;
  origem: Record<"utm_source" | "utm_medium" | "utm_campaign" | "utm_content" | "utm_term", string | null>;
};

export function montarPayload(r: RespostaLinha, f: { slug: string; nome: string }, siteUrl: string): PayloadResposta {
  return {
    evento: EVENTO_RESPOSTA,
    id: r.id,
    formulario: f.slug,
    formularioNome: f.nome,
    link: `${siteUrl.replace(/\/$/, "")}/${f.slug}`,
    status: r.status,
    nome: r.nome,
    primeiroNome: (r.nome ?? "").trim().split(/\s+/)[0] ?? "",
    whatsapp: r.whatsapp,
    email: r.email,
    empresa: r.empresa,
    respostas: r.respostas,
    criadoEm: r.criado_em,
    concluidoEm: r.concluido_em,
    origem: { utm_source: r.utm_source, utm_medium: r.utm_medium, utm_campaign: r.utm_campaign, utm_content: r.utm_content, utm_term: r.utm_term },
  };
}

/** Aviso de exemplo do botão "Testar" (marcado com `teste: true`). */
export function PAYLOAD_TESTE(siteUrl: string): PayloadResposta {
  const agora = new Date().toISOString();
  return {
    ...montarPayload(
      {
        id: "00000000-0000-4000-8000-000000000000", formulario_id: "00000000-0000-4000-8000-000000000000", formulario_slug: "exemplo",
        status: "completo", nome: "Maria Exemplo", whatsapp: "5511900000000", email: "maria@exemplo.com", empresa: "Empresa Exemplo",
        respostas: [{ slug: "nome", q: "Qual é o seu nome?", a: "Maria Exemplo", papel: "nome" }],
        utm_source: "teste", utm_medium: null, utm_campaign: null, utm_content: null, utm_term: null, origem: {},
        criado_em: agora, atualizado_em: agora, concluido_em: agora,
      },
      { slug: "exemplo", nome: "Formulário de exemplo" },
      siteUrl,
    ),
    teste: true,
  };
}
