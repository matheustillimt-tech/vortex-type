/** Formato de um formulário (linha de `formularios`). As perguntas moram num jsonb da própria linha. */

import type { Agendamento } from "../agendamento/tipos";

/** "varias" = marca mais de uma opção (a resposta vira as opções juntas com "; "). */
export type TipoPergunta = "texto" | "telefone" | "email" | "escolha" | "varias";

/** Papel marca o que a resposta é pro banco (vira coluna) e pras validações. */
export type Papel = "nome" | "whatsapp" | "email" | "empresa" | "nicho" | "cargo" | "faturamento";

export type Pergunta = {
  slug: string;
  tipo: TipoPergunta;
  papel?: Papel | null;
  /** Texto da pergunta (bolha em negrito). */
  texto: string;
  /** Bolhas que o bot fala antes da pergunta. */
  bolhas?: string[];
  rotulo?: string;
  placeholder?: string;
  opcoes?: string[];
  /** Só em "varias": quantas a pessoa pode marcar (vazio = todas). */
  maximo?: number | null;
  /** Só em "varias": opções que valem sozinhas (ex.: "Todas as áreas"). Marcar uma desmarca as outras, e vice-versa. */
  exclusivas?: string[] | null;
  /** Com isto, escolher a última opção ("Outro") abre um campo de texto livre. */
  outro?: { rotulo?: string; placeholder?: string } | null;
  /** Opções que desqualificam (o banco confere; a página nunca recebe esta lista). */
  desqualifica?: string[];
  /** Só aparece quando a resposta de outra pergunta é uma destas. */
  condicao?: { slug: string; valores: string[] } | null;
};

export type Cores = { marca: string; marca2: string; verde: string; fundo: string; bolha: string; texto: string };

export type Textos = {
  perfilIdeal: string[];
  /** Última bolha de quem tem perfil. */
  fechamento: string;
  desqualificado: string;
  falhou: string;
  tentarDeNovo: string;
  legalAntes: string;
};

export type AcoesPixel = { meta: string[]; tiktok: string[]; google: string[] };

export type Pixels = {
  meta: string[];
  tiktok: string[];
  google: string[];
  /** Eventos disparados quando a pessoa conclui. Google: "AW-xxx/rótulo" de conversão. */
  acoes: { lead: AcoesPixel };
  /** Dispara o Lead também pra quem fica sem perfil (desqualificado). Padrão: sim. */
  leadSemPerfil: boolean;
};

/** O que a página pública recebe (formulario_publico). */
export type FormularioPublico = {
  id: string;
  slug: string;
  nome: string;
  titulo_pagina: string | null;
  descricao: string | null;
  logo_url: string | null;
  avatar_url: string | null;
  cores: Partial<Cores>;
  textos: Partial<Textos>;
  perguntas: Pergunta[];
  privacidade_url: string | null;
  termos_url: string | null;
  pixels: Partial<Pixels>;
  /** Marcar a reunião no Vórtex Call no fim (nulo/ausente = desligado). */
  agendamento?: Agendamento | null;
};

/** Linha inteira, como o painel lê. */
export type Formulario = FormularioPublico & {
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
};

export type Resposta = { slug: string; q: string; a: string; papel?: Papel | null };

export type StatusResposta = "parcial" | "completo" | "desqualificado";

export type RespostaLinha = {
  id: string;
  formulario_id: string;
  formulario_slug: string;
  status: StatusResposta;
  nome: string | null;
  whatsapp: string | null;
  email: string | null;
  empresa: string | null;
  respostas: Resposta[];
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  origem: Record<string, string>;
  criado_em: string;
  atualizado_em: string;
  concluido_em: string | null;
};
