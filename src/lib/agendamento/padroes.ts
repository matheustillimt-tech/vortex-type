/** Padrões do agendamento (textos que valem quando o formulário não muda nada) e a mescla com o que está no banco. Puro. */
import type { Agendamento, AgendamentoEfetivo, TextosAgenda } from "./tipos";

export const MENSAGEM_WHATSAPP_PADRAO = "Oi! Acabei de agendar minha reunião e quero confirmar minha presença.";

/** Textos padrão do cartão de agenda (cada formulário pode trocar na aba Agendamento do editor). */
export const TEXTOS_AGENDA_PADRAO: TextosAgenda = {
  chamada: "Agora é só escolher o melhor horário pra sua reunião com o nosso time:",
  agendaTitulo: "Agende sua reunião",
  agendaSubtitulo: "Conversa ao vivo com o nosso time",
  confirmarTitulo: "Confirmar horário",
  confirmarTexto: "Esse horário fica separado pra você. Confirma que vai conseguir participar?",
  confirmarBotao: "Confirmar horário",
  outroHorario: "Escolher outro horário",
  reservadoTitulo: "Horário reservado!",
  reservadoTexto: "Os detalhes da reunião chegam pelo WhatsApp. Confirme sua presença por lá.",
  botaoWhatsapp: "Confirmar presença no WhatsApp",
  verLink: "Abrir o link da reunião",
  semHorarios: "Agora não há horários livres na agenda. Nosso time vai falar com você pelo WhatsApp.",
  lotou: "Esse horário acabou de ser preenchido. Escolha outro.",
  naoAgendou: "Não foi possível agendar agora. Tente de novo.",
};

/** Aparece no cartão enquanto o Call responde (fixo, não editável). */
export const AGENDANDO = "Agendando seu horário...";

/** Mesmo formato de slug das agendas do Vórtex Call. */
export const SLUG_AGENDA = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Rótulo de cada texto no editor, na ordem em que aparecem pro lead. */
export const ROTULOS_TEXTOS_AGENDA: { key: keyof TextosAgenda; label: string }[] = [
  { key: "chamada", label: "Bolha antes da agenda (no lugar da última bolha de quem tem perfil)" },
  { key: "agendaTitulo", label: "Título da agenda" },
  { key: "agendaSubtitulo", label: "Subtítulo da agenda" },
  { key: "confirmarTitulo", label: "Título da confirmação" },
  { key: "confirmarTexto", label: "Texto da confirmação" },
  { key: "confirmarBotao", label: "Botão de confirmar" },
  { key: "outroHorario", label: "Link pra escolher outro horário" },
  { key: "reservadoTitulo", label: "Título depois de agendar" },
  { key: "reservadoTexto", label: "Texto depois de agendar" },
  { key: "botaoWhatsapp", label: "Botão do WhatsApp" },
  { key: "verLink", label: "Botão do link da reunião" },
  { key: "semHorarios", label: "Bolha quando não há horários" },
  { key: "lotou", label: "Aviso quando o horário lota" },
  { key: "naoAgendou", label: "Aviso quando não dá pra agendar" },
];

const objeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * O que a conversa usa. Null = desligado: cópia sem endereço do Call (`base`), formulário sem agendamento ou com
 * agenda fora do formato. Texto vazio no banco volta pro padrão.
 */
export function mesclarAgendamento(v: unknown, base: string | null): AgendamentoEfetivo | null {
  if (!base || !objeto(v)) return null;
  const agenda = typeof v.agenda === "string" ? v.agenda.trim() : "";
  if (!SLUG_AGENDA.test(agenda)) return null;
  const whatsapp = typeof v.whatsapp === "string" ? v.whatsapp.replace(/\D/g, "") : "";
  const mensagem = typeof v.mensagemWhatsapp === "string" && v.mensagemWhatsapp.trim() ? v.mensagemWhatsapp.trim() : MENSAGEM_WHATSAPP_PADRAO;
  const textos = { ...TEXTOS_AGENDA_PADRAO };
  if (objeto(v.textos)) {
    for (const [k, t] of Object.entries(v.textos)) {
      if (k in TEXTOS_AGENDA_PADRAO && typeof t === "string" && t.trim()) textos[k as keyof TextosAgenda] = t;
    }
  }
  return { base, agenda, whatsapp: whatsapp || null, mensagemWhatsapp: mensagem, abrirWhatsappSozinho: v.abrirWhatsappSozinho === true, textos };
}

/** Erro pra mostrar antes de salvar, ou null. Desligado (null) sempre passa. */
export function conferirAgendamento(a: Agendamento | null | undefined): string | null {
  if (!a) return null;
  if (!SLUG_AGENDA.test((a.agenda ?? "").trim())) return "Agendamento: informe o endereço da agenda no Vórtex Call (ex.: reuniao-comercial).";
  const w = a.whatsapp ?? "";
  if (w && !/^\d{10,15}$/.test(w)) return "Agendamento: o WhatsApp vai só com números, com o DDI 55 e o DDD na frente.";
  return null;
}
