import "server-only";
import { listarFormularios, listarRespostas, metricasFormulario, verFormulario, verResposta } from "../api/consultas";
import type { ChaveAutenticada } from "../api/auth";
import { lerFiltro, lerPeriodo } from "../api/parametros";
import { siteUrl } from "../env";
import { conferirEnderecos } from "../formulario/enderecos";
import { EXEMPLO } from "../formulario/exemplo";
import { conferirPerguntas, slugify } from "../formulario/fluxo";
import { CORES_PADRAO, TEXTOS_PADRAO } from "../formulario/padroes";
import { validarSlug } from "../formulario/slug";
import type { Cores, Formulario, Pergunta, Pixels, Textos } from "../formulario/tipos";
import { dbAdmin } from "../supabase/admin";

export type ResultadoFerramenta = { content: { type: "text"; text: string }[]; isError?: boolean };
export type Ferramenta = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: Record<string, unknown>;
  escrita: boolean;
  executar: (chave: ChaveAutenticada, args: Record<string, unknown>) => Promise<ResultadoFerramenta>;
};

const texto = (dados: unknown): ResultadoFerramenta => ({ content: [{ type: "text", text: JSON.stringify(dados, null, 2) }] });
const erro = (mensagem: string): ResultadoFerramenta => ({ content: [{ type: "text", text: mensagem }], isError: true });
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID = { type: "string", format: "uuid", description: "Id do formulário (veja listar_formularios)." } as const;
const LEITURA = { readOnlyHint: true, openWorldHint: false } as const;
const ALTERA = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const CRIA = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } as const;
const NAO_ENCONTRADO = "Formulário não encontrado.";

const ehListaDeTexto = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
const HEX_COR = /^#[0-9a-fA-F]{6}$/;

/** Só os campos de `Textos`; `perfilIdeal` é lista de textos, o resto é texto simples. */
function erroTextos(v: Record<string, unknown>): string | null {
  for (const k of Object.keys(v)) {
    if (!(k in TEXTOS_PADRAO)) return `textos: campo desconhecido "${k}".`;
    if (k === "perfilIdeal") {
      if (!ehListaDeTexto(v[k])) return "textos.perfilIdeal: lista de textos.";
    } else if (typeof v[k] !== "string") {
      return `textos.${k}: texto.`;
    }
  }
  return null;
}

/** Só os campos de `Cores`, cada um uma cor #rrggbb. */
function erroCores(v: Record<string, unknown>): string | null {
  for (const k of Object.keys(v)) {
    if (!(k in CORES_PADRAO)) return `cores: campo desconhecido "${k}".`;
    if (typeof v[k] !== "string" || !HEX_COR.test(v[k] as string)) return `cores.${k}: use uma cor no formato #rrggbb.`;
  }
  return null;
}

const CHAVES_PIXELS = ["meta", "tiktok", "google", "acoes", "leadSemPerfil"];
const CHAVES_ACOES_LEAD = ["meta", "tiktok", "google"];

/** `meta`/`tiktok`/`google` são listas de textos; `acoes.lead` tem as mesmas três; `leadSemPerfil` é booleano. */
function erroPixels(v: Record<string, unknown>): string | null {
  for (const k of Object.keys(v)) {
    if (!CHAVES_PIXELS.includes(k)) return `pixels: campo desconhecido "${k}".`;
  }
  for (const k of ["meta", "tiktok", "google"] as const) {
    if (v[k] !== undefined && !ehListaDeTexto(v[k])) return `pixels.${k}: lista de textos.`;
  }
  if (v.acoes !== undefined) {
    if (!v.acoes || typeof v.acoes !== "object" || Array.isArray(v.acoes)) return "pixels.acoes: objeto no formato de ver_formulario.";
    const acoes = v.acoes as Record<string, unknown>;
    if (Object.keys(acoes).some((k) => k !== "lead")) return "pixels.acoes: só o campo lead.";
    if (acoes.lead !== undefined) {
      if (!acoes.lead || typeof acoes.lead !== "object" || Array.isArray(acoes.lead)) return "pixels.acoes.lead: objeto no formato de ver_formulario.";
      const lead = acoes.lead as Record<string, unknown>;
      for (const k of Object.keys(lead)) {
        if (!CHAVES_ACOES_LEAD.includes(k)) return `pixels.acoes.lead: campo desconhecido "${k}".`;
      }
      for (const k of ["meta", "tiktok", "google"] as const) {
        if (lead[k] !== undefined && !ehListaDeTexto(lead[k])) return `pixels.acoes.lead.${k}: lista de textos.`;
      }
    }
  }
  if (v.leadSemPerfil !== undefined && typeof v.leadSemPerfil !== "boolean") return "pixels.leadSemPerfil: true ou false.";
  return null;
}

/** Campos que o MCP pode mudar num formulário, conferidos com as mesmas regras do editor. */
async function aplicarEdicao(atual: Formulario, a: Record<string, unknown>): Promise<{ patch: Partial<Formulario> } | { erro: string }> {
  const patch: Partial<Formulario> = {};
  if (a.nome !== undefined) {
    if (typeof a.nome !== "string" || !a.nome.trim() || a.nome.length > 120) return { erro: "nome: texto de 1 a 120 caracteres." };
    patch.nome = a.nome.trim();
  }
  if (a.slug !== undefined) {
    const s = typeof a.slug === "string" ? slugify(a.slug) : "";
    const e = validarSlug(s);
    if (e) return { erro: `slug: ${e}` };
    patch.slug = s;
  }
  for (const k of ["titulo_pagina", "descricao", "privacidade_url", "termos_url", "logo_url", "avatar_url"] as const) {
    if (a[k] === undefined) continue;
    if (a[k] !== null && typeof a[k] !== "string") return { erro: `${k}: texto ou null.` };
    (patch as Record<string, unknown>)[k] = a[k] === "" ? null : a[k];
  }
  if (a.ativo !== undefined) {
    if (typeof a.ativo !== "boolean") return { erro: "ativo: true ou false." };
    patch.ativo = a.ativo;
  }
  if (a.perguntas !== undefined) {
    if (!Array.isArray(a.perguntas)) return { erro: "perguntas: lista de perguntas no formato de ver_formulario." };
    const erros = conferirPerguntas(a.perguntas as Pergunta[]);
    if (erros.length) return { erro: `perguntas: ${erros.join(" ")}` };
    patch.perguntas = a.perguntas as Pergunta[];
  }
  if (a.textos !== undefined) {
    if (!a.textos || typeof a.textos !== "object" || Array.isArray(a.textos)) return { erro: "textos: objeto no formato de ver_formulario." };
    const e = erroTextos(a.textos as Record<string, unknown>);
    if (e) return { erro: e };
    patch.textos = a.textos as Partial<Textos>;
  }
  if (a.cores !== undefined) {
    if (!a.cores || typeof a.cores !== "object" || Array.isArray(a.cores)) return { erro: "cores: objeto no formato de ver_formulario." };
    const e = erroCores(a.cores as Record<string, unknown>);
    if (e) return { erro: e };
    patch.cores = a.cores as Partial<Cores>;
  }
  if (a.pixels !== undefined) {
    if (!a.pixels || typeof a.pixels !== "object" || Array.isArray(a.pixels)) return { erro: "pixels: objeto no formato de ver_formulario." };
    const e = erroPixels(a.pixels as Record<string, unknown>);
    if (e) return { erro: e };
    patch.pixels = a.pixels as Partial<Pixels>;
  }
  const erroLinks = conferirEnderecos({ ...atual, ...patch } as Formulario);
  if (erroLinks) return { erro: erroLinks };
  return { patch };
}

async function gravar(id: string, patch: Partial<Formulario>): Promise<ResultadoFerramenta> {
  const { data, error } = await dbAdmin().from("formularios").update({ ...patch, atualizado_em: new Date().toISOString() }).eq("id", id).select("id, slug, nome, ativo").maybeSingle();
  if (error) return erro(error.message.includes("duplicate") ? "Já existe um formulário com esse endereço (slug)." : "Não deu para salvar.");
  if (!data) return erro(NAO_ENCONTRADO);
  const f = data as { id: string; slug: string; nome: string; ativo: boolean };
  return texto({ ...f, link: `${siteUrl()}/${f.slug}` });
}

const CAMPOS_EDICAO = {
  nome: { type: "string" },
  slug: { type: "string", description: "Endereço público (letras minúsculas, números e hífen)." },
  ativo: { type: "boolean" },
  titulo_pagina: { type: ["string", "null"] },
  descricao: { type: ["string", "null"] },
  privacidade_url: { type: ["string", "null"], description: "https://…" },
  termos_url: { type: ["string", "null"], description: "https://…" },
  logo_url: { type: ["string", "null"] },
  avatar_url: { type: ["string", "null"] },
  perguntas: { type: "array", items: { type: "object" }, description: "Lista completa de perguntas (substitui a atual), no formato de ver_formulario." },
  textos: { type: "object" },
  cores: { type: "object" },
  pixels: { type: "object" },
} as const;

export const FERRAMENTAS: Ferramenta[] = [
  {
    name: "listar_formularios", title: "Listar formulários", escrita: false, annotations: LEITURA,
    description: "Lista os formulários (id, endereço, nome, se está no ar, link e quantas perguntas).",
    inputSchema: { type: "object", properties: {} },
    executar: async () => texto({ formularios: await listarFormularios() }),
  },
  {
    name: "ver_formulario", title: "Ver formulário", escrita: false, annotations: LEITURA,
    description: "Mostra o formulário completo: perguntas (com regras de desqualificação), textos, cores e pixels.",
    inputSchema: { type: "object", properties: { id: ID }, required: ["id"] },
    executar: async (_c, a) => {
      if (typeof a.id !== "string" || !UUID_RE.test(a.id)) return erro("Informe o id do formulário.");
      const f = await verFormulario(a.id);
      return f ? texto({ formulario: f, link: `${siteUrl()}/${f.slug}` }) : erro(NAO_ENCONTRADO);
    },
  },
  {
    name: "criar_formulario", title: "Criar formulário", escrita: true, annotations: CRIA,
    description: "Cria um formulário novo (já nasce com o roteiro de exemplo, que dá pra trocar com editar_formulario). Nasce desligado.",
    inputSchema: { type: "object", properties: { nome: { type: "string" }, slug: { type: "string" } }, required: ["nome"] },
    executar: async (_c, a) => {
      if (typeof a.nome !== "string" || !a.nome.trim()) return erro("Informe o nome.");
      const slug = slugify(typeof a.slug === "string" && a.slug.trim() ? a.slug : a.nome);
      const e = validarSlug(slug);
      if (e) return erro(`slug: ${e}`);
      const { id: _i, criado_em: _c2, atualizado_em: _a, slug: _s, nome: _n, ...base } = EXEMPLO;
      const { data, error } = await dbAdmin().from("formularios").insert({ ...base, nome: a.nome.trim(), slug, ativo: false }).select("id, slug, nome, ativo").single();
      if (error) return erro(error.message.includes("duplicate") ? "Já existe um formulário com esse endereço (slug)." : "Não deu para criar.");
      const f = data as { id: string; slug: string; nome: string; ativo: boolean };
      return texto({ ...f, link: `${siteUrl()}/${f.slug}`, painel: `${siteUrl()}/formularios/${f.id}` });
    },
  },
  {
    name: "editar_formulario", title: "Editar formulário", escrita: true, annotations: ALTERA,
    description: "Muda campos de um formulário. Só os campos enviados mudam; perguntas substitui a lista inteira. Mostre ao usuário o que vai mudar antes: o formulário pode estar no ar.",
    inputSchema: { type: "object", properties: { id: ID, ...CAMPOS_EDICAO }, required: ["id"] },
    executar: async (_c, a) => {
      if (typeof a.id !== "string" || !UUID_RE.test(a.id)) return erro("Informe o id do formulário.");
      const atual = await verFormulario(a.id);
      if (!atual) return erro(NAO_ENCONTRADO);
      const r = await aplicarEdicao(atual, a);
      if ("erro" in r) return erro(r.erro);
      if (!Object.keys(r.patch).length) return erro("Nada pra mudar: envie pelo menos um campo.");
      return gravar(a.id, r.patch);
    },
  },
  {
    name: "ligar_desligar_formulario", title: "Ligar ou desligar formulário", escrita: true, annotations: ALTERA,
    description: "Põe o formulário no ar (ativo: true) ou tira (ativo: false). Desligado, o link mostra página não encontrada.",
    inputSchema: { type: "object", properties: { id: ID, ativo: { type: "boolean" } }, required: ["id", "ativo"] },
    executar: async (_c, a) => {
      if (typeof a.id !== "string" || !UUID_RE.test(a.id)) return erro("Informe o id do formulário.");
      if (typeof a.ativo !== "boolean") return erro("ativo: true ou false.");
      return gravar(a.id, { ativo: a.ativo });
    },
  },
  {
    name: "listar_respostas", title: "Listar respostas", escrita: false, annotations: LEITURA,
    description: "Respostas mais novas primeiro. Filtros: formulario (id), status (parcial, completo, desqualificado), de/ate (AAAA-MM-DD, Brasília), limite (até 500, padrão 100), antes: valor do campo proximo, pra página seguinte.",
    inputSchema: { type: "object", properties: { formulario: ID, status: { type: "string", enum: ["parcial", "completo", "desqualificado"] }, de: { type: "string" }, ate: { type: "string" }, limite: { type: "number" }, antes: { type: "string" } } },
    executar: async (_c, a) => {
      const f = lerFiltro(a);
      return f.ok ? texto(await listarRespostas(f.filtro)) : erro(f.erro);
    },
  },
  {
    name: "ver_resposta", title: "Ver resposta", escrita: false, annotations: LEITURA,
    description: "Uma resposta completa (contato, respostas de cada pergunta, origem/UTM, datas).",
    inputSchema: { type: "object", properties: { id: { type: "string", format: "uuid" } }, required: ["id"] },
    executar: async (_c, a) => {
      if (typeof a.id !== "string" || !UUID_RE.test(a.id)) return erro("Informe o id da resposta.");
      const r = await verResposta(a.id);
      return r ? texto({ resposta: r }) : erro("Resposta não encontrada.");
    },
  },
  {
    name: "metricas_formulario", title: "Métricas do formulário", escrita: false, annotations: LEITURA,
    description: "Respostas, concluídas, sem perfil e abandonos no período, e o funil (onde as pessoas param; com agendamento no Vórtex Call, as etapas Viu a agenda e Agendou depois de Concluiu). de/ate AAAA-MM-DD (Brasília); sem datas: últimos 30 dias.",
    inputSchema: { type: "object", properties: { id: ID, de: { type: "string" }, ate: { type: "string" } }, required: ["id"] },
    executar: async (_c, a) => {
      if (typeof a.id !== "string" || !UUID_RE.test(a.id)) return erro("Informe o id do formulário.");
      const p = lerPeriodo(a.de, a.ate);
      if (!p.ok) return erro(p.erro);
      const m = await metricasFormulario(a.id, p.de, p.ate);
      return m ? texto(m) : erro(NAO_ENCONTRADO);
    },
  },
];
