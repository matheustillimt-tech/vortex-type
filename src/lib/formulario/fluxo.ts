/** Regras da conversa, sem React: qual pergunta vem, validação das respostas, telefone, progresso. */
import type { Papel, Pergunta, Resposta, TipoPergunta } from "./tipos";

export type Respostas = Record<string, string>;

/** Pergunta de várias opções guarda as escolhidas numa string só (as opções podem ter vírgula, então é "; "). */
export const SEPARADOR = "; ";
export const juntar = (opcoes: string[]) => opcoes.join(SEPARADOR);
export const separar = (resposta: string) => resposta.split(SEPARADOR).map((x) => x.trim()).filter(Boolean);

/**
 * Marca ou desmarca uma opção de "várias opções". Opção exclusiva fica sozinha (e entra mesmo com o máximo cheio);
 * marcar uma comum tira a exclusiva. No máximo, as comuns não entram.
 */
export function alternarOpcao(marcadas: string[], opcao: string, o: { exclusivas?: string[] | null; maximo?: number | null } = {}): string[] {
  if (marcadas.includes(opcao)) return marcadas.filter((x) => x !== opcao);
  const exclusivas = o.exclusivas ?? [];
  if (exclusivas.includes(opcao)) return [opcao];
  const comuns = marcadas.filter((x) => !exclusivas.includes(x));
  if (o.maximo && comuns.length >= o.maximo) return marcadas;
  return [...comuns, opcao];
}

/** A pergunta entra na conversa? (sem condição sempre entra; com condição, só se a resposta bater) */
export function aparece(p: Pergunta, r: Respostas) {
  if (!p.condicao?.slug) return true;
  const v = r[p.condicao.slug];
  return v != null && p.condicao.valores.includes(v);
}

/** Índice da próxima pergunta que aparece a partir de `de`. Devolve perguntas.length quando acabou. */
export function proxima(perguntas: Pergunta[], r: Respostas, de: number) {
  let i = de;
  while (i < perguntas.length && !aparece(perguntas[i], r)) i++;
  return i;
}

/** Quantas já foram e quantas devem aparecer, pra barrinha de progresso do topo. */
export function progresso(perguntas: Pergunta[], r: Respostas, idx: number) {
  const visiveis = perguntas.filter((p) => !p.condicao?.slug || r[p.condicao.slug] == null || aparece(p, r));
  const feitas = perguntas.slice(0, idx).filter((p) => aparece(p, r)).length;
  return { feitas: Math.min(feitas, visiveis.length), total: visiveis.length };
}

export function papelDe(p: Pergunta): "nome" | "whatsapp" | "email" | "texto" {
  if (p.papel === "nome") return "nome";
  if (p.papel === "whatsapp" || p.tipo === "telefone") return "whatsapp";
  if (p.papel === "email" || p.tipo === "email") return "email";
  return "texto";
}

const LIMITE = { nome: 120, whatsapp: 20, email: 160, texto: 600 };

const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/** Máscara enquanto digita: (DDD) seguido de 5 + 4 dígitos. */
export function mascaraTelefone(v: string) {
  let d = v.replace(/\D/g, "");
  if (d.startsWith("0055")) d = d.slice(2);
  if (d.startsWith("55") && d.length > 11) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Telefone no formato 55DDNNNNNNNNN (com o 9 na frente de celular antigo de 8 dígitos). */
export function normalizarTelefone(v: string) {
  let d = (v || "").replace(/\D/g, "");
  if (d.startsWith("0055")) d = d.slice(2);
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) {
    const ddd = d.slice(2, 4);
    let n = d.slice(4);
    if (n.length === 8 && /^[6-9]/.test(n)) n = `9${n}`;
    d = `55${ddd}${n}`;
  }
  return d;
}

/** Sequência (12345678) ou tudo igual (99999999): número inventado. */
function pareceFalso(n: string) {
  if (/^(\d)\1{7}$/.test(n)) return true;
  let sobe = true;
  let desce = true;
  for (let i = 1; i < n.length; i++) {
    if (+n[i] !== +n[i - 1] + 1) sobe = false;
    if (+n[i] !== +n[i - 1] - 1) desce = false;
  }
  return sobe || desce;
}

export function erroTelefone(v: string): string | null {
  const t = normalizarTelefone(v);
  if (!/^55\d{11}$/.test(t)) return "Coloca um celular válido com DDD (11 números, com o 9 na frente).";
  if (!DDDS.has(Number(t.slice(2, 4)))) return "DDD inválido. Confere o DDD do seu celular.";
  if (t[4] !== "9") return "Coloca um número de celular (o 9 na frente depois do DDD).";
  if (pareceFalso(t.slice(5))) return "Esse número não parece válido. Digita seu WhatsApp de verdade.";
  return null;
}

/** Erro pra mostrar embaixo do campo, ou null quando a resposta serve. `livre` = texto do "Outro". */
export function validar(p: Pergunta, valor: string, livre = false): string | null {
  const v = valor.trim();
  if (livre) {
    if (v.length < 3) return "Conta um pouco mais pra continuar.";
    return v.length > LIMITE.texto ? `Use até ${LIMITE.texto} caracteres nesta resposta.` : null;
  }
  const papel = papelDe(p);
  if (v.length > LIMITE[papel]) return papel === "texto" ? `Use até ${LIMITE.texto} caracteres nesta resposta.` : `Use até ${LIMITE[papel]} caracteres.`;
  if (papel === "nome") return v.length >= 2 ? null : "Me diz seu nome pra continuar.";
  if (papel === "whatsapp") return erroTelefone(v);
  if (papel === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? null : "Coloca um e-mail válido.";
  return v ? null : "Responde pra continuar.";
}

export function primeiroNome(perguntas: Pergunta[], r: Respostas) {
  const p = perguntas.find((x) => x.papel === "nome");
  return (p && r[p.slug] ? r[p.slug] : "").trim().split(/\s+/)[0] ?? "";
}

function escapar(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Texto do bot vira HTML seguro: escapa tudo, troca {nome} pelo primeiro nome em negrito, **negrito** vira <b>
 * e links/e-mails ficam clicáveis.
 */
export function htmlDaBolha(texto: string, nome: string) {
  return escapar(texto)
    .replace(/\{nome\}/gi, nome ? `<b>${escapar(nome)}</b>` : "")
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)]/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
}

/** Respostas na ordem da conversa, só das perguntas que apareceram. */
export function listaRespostas(perguntas: Pergunta[], r: Respostas): Resposta[] {
  return perguntas
    .filter((p) => aparece(p, r) && r[p.slug] != null)
    .map((p) => ({ slug: p.slug, q: p.texto, a: r[p.slug], papel: p.papel ?? null }));
}

/** Valor da resposta da pergunta com esse papel (nome, whatsapp, email, empresa). */
export function porPapel(perguntas: Pergunta[], r: Respostas, papel: string) {
  const p = perguntas.find((x) => x.papel === papel);
  return p ? r[p.slug] : undefined;
}

/** Slug a partir de um texto: "Sua Empresa · Aplicação" vira "sua-empresa-aplicacao". */
export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const TIPOS: readonly TipoPergunta[] = ["texto", "telefone", "email", "escolha", "varias"];
const PAPEIS: readonly Papel[] = ["nome", "whatsapp", "email", "empresa", "nicho", "cargo", "faturamento"];

/** `undefined` serve (campo opcional); senão precisa ser uma lista onde todo item é texto. */
const listaDeTextos = (v: unknown): boolean => v === undefined || (Array.isArray(v) && v.every((x) => typeof x === "string"));

function condicaoValida(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return typeof o.slug === "string" && Array.isArray(o.valores) && o.valores.every((x) => typeof x === "string");
}

function outroValido(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return (o.rotulo === undefined || typeof o.rotulo === "string") && (o.placeholder === undefined || typeof o.placeholder === "string");
}

/** Erros de configuração que quebrariam a conversa. Lista vazia = pode salvar. */
export function conferirPerguntas(perguntas: Pergunta[]): string[] {
  const erros: string[] = [];
  const slugs = new Set<string>();
  // Vindo do MCP, um item pode ser null, texto ou lista: erro de formato em vez de quebrar.
  const objeto = (p: unknown): p is Pergunta => typeof p === "object" && p !== null && !Array.isArray(p);
  perguntas.forEach((p, i) => {
    const n = `Pergunta ${i + 1}`;
    if (!objeto(p)) {
      erros.push(`${n}: formato inválido.`);
      return;
    }
    if (!p.slug || !/^[a-z0-9_-]+$/.test(p.slug)) erros.push(`${n}: identificador inválido (use letras minúsculas, números e _).`);
    if (slugs.has(p.slug)) erros.push(`${n}: identificador "${p.slug}" repetido.`);
    slugs.add(p.slug);
    if (!(TIPOS as readonly string[]).includes(p.tipo)) erros.push(`${n}: tipo de pergunta inválido.`);
    if (typeof p.texto !== "string" || !p.texto.trim()) erros.push(`${n}: falta o texto da pergunta.`);
    if (!listaDeTextos(p.bolhas)) erros.push(`${n}: bolhas precisa ser uma lista de textos.`);
    if (!listaDeTextos(p.opcoes)) erros.push(`${n}: opções precisa ser uma lista de textos.`);
    if (!listaDeTextos(p.desqualifica)) erros.push(`${n}: desqualifica precisa ser uma lista de textos.`);
    if ((p.tipo === "escolha" || p.tipo === "varias") && !(p.opcoes ?? []).filter((o) => typeof o === "string" && o.trim()).length) erros.push(`${n}: escolha sem opções.`);
    if (p.maximo !== undefined && p.maximo !== null && !(Number.isInteger(p.maximo) && p.maximo >= 1)) erros.push(`${n}: o máximo de opções precisa ser 1 ou mais.`);
    if (!outroValido(p.outro)) erros.push(`${n}: "outro" precisa ser um objeto com rótulo e/ou placeholder em texto.`);
    if (!condicaoValida(p.condicao)) erros.push(`${n}: condição inválida (precisa de slug e valores, uma lista de textos).`);
    else if (p.condicao?.slug) {
      const alvo = perguntas.findIndex((x) => objeto(x) && x.slug === p.condicao!.slug);
      if (alvo < 0 || alvo >= i) erros.push(`${n}: a condição precisa apontar pra uma pergunta anterior.`);
    }
    if (p.papel !== undefined && p.papel !== null && !(PAPEIS as readonly string[]).includes(p.papel)) erros.push(`${n}: papel inválido.`);
  });
  for (const papel of ["nome", "whatsapp"] as const) {
    if (!perguntas.some((p) => objeto(p) && p.papel === papel)) erros.push(`Falta uma pergunta com o papel "${papel}".`);
  }
  return erros;
}
