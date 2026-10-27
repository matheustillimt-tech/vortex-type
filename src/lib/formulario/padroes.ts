import type { AcoesPixel, FormularioPublico, Cores, Pixels, Textos } from "./tipos";

/** Cores padrão da conversa. O painel troca pelas do formulário. */
export const CORES_PADRAO: Cores = {
  marca: "#0d0d0d",
  marca2: "#2b2b2b",
  verde: "#1eb84a",
  fundo: "#fbfcfd",
  bolha: "#f1f3f6",
  texto: "#242424",
};

/** Textos que valem quando o formulário não muda nada. `{nome}` vira o primeiro nome da pessoa. */
export const TEXTOS_PADRAO: Textos = {
  perfilIdeal: [
    "Prontinho! Pelas suas respostas, você tem o perfil que a gente atende.",
    "Quer ver na prática como isso pode funcionar no seu negócio?",
  ],
  fechamento: "Nosso time vai falar com você pelo WhatsApp com o próximo passo. Fica de olho!",
  desqualificado:
    "Obrigado pelas respostas, {nome}! Agora a reunião ainda não é o melhor próximo passo pra você, mas vamos te mandar conteúdos pelo WhatsApp pra te ajudar a chegar lá.",
  falhou: "Não conseguimos salvar suas respostas. Elas continuam nesta página. Tente novamente.",
  tentarDeNovo: "Tentar novamente",
  legalAntes: "Ao continuar, você concorda com a ",
};

/** Rótulo de cada texto no editor do painel, na ordem em que aparecem. */
export const ROTULOS_TEXTOS: { key: keyof Textos; label: string; grupo: "Fechamento" }[] = [
  { key: "perfilIdeal", label: "Bolhas depois da última pergunta (uma por linha)", grupo: "Fechamento" },
  { key: "fechamento", label: "Última bolha de quem tem perfil", grupo: "Fechamento" },
  { key: "desqualificado", label: "Fechamento de quem não tem perfil", grupo: "Fechamento" },
];

export const PIXELS_PADRAO: Pixels = {
  meta: [],
  tiktok: [],
  google: [],
  acoes: {
    lead: { meta: ["Lead"], tiktok: ["SubmitForm"], google: [] },
  },
  leadSemPerfil: true,
};

const lista = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim()) : []);

function acoes(v: unknown, padrao: AcoesPixel): AcoesPixel {
  if (!v || typeof v !== "object") return padrao;
  const o = v as Record<string, unknown>;
  return { meta: lista(o.meta), tiktok: lista(o.tiktok), google: lista(o.google) };
}

/** Junta o que está no banco com os padrões. Texto vazio no banco volta pro padrão. */
export function mesclar(bot: Pick<FormularioPublico, "cores" | "textos" | "pixels">) {
  const cores = { ...CORES_PADRAO };
  for (const [k, v] of Object.entries(bot.cores ?? {})) if (typeof v === "string" && /^#[0-9a-f]{3,8}$/i.test(v)) cores[k as keyof Cores] = v;

  const textos = { ...TEXTOS_PADRAO };
  for (const [k, v] of Object.entries(bot.textos ?? {})) {
    const key = k as keyof Textos;
    if (!(key in TEXTOS_PADRAO)) continue;
    if (key === "perfilIdeal") {
      const l = lista(v);
      if (l.length) textos.perfilIdeal = l;
    } else if (typeof v === "string" && v.trim()) {
      (textos as Record<string, unknown>)[key] = v;
    }
  }

  const p = (bot.pixels ?? {}) as Partial<Pixels>;
  const pixels: Pixels = {
    meta: lista(p.meta),
    tiktok: lista(p.tiktok),
    google: lista(p.google),
    acoes: {
      lead: acoes(p.acoes?.lead, PIXELS_PADRAO.acoes.lead),
    },
    leadSemPerfil: p.leadSemPerfil !== false,
  };
  return { cores, textos, pixels };
}

/** O Lead dispara pra quem tem perfil sempre; pra quem fica sem perfil, só se o formulário deixar (`leadSemPerfil`). */
export function deveDispararLead(pixels: Pixels, desqualificado: boolean): boolean {
  return !desqualificado || pixels.leadSemPerfil;
}
