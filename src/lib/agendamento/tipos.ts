/** Agendamento no Vórtex Call no fim do formulário (coluna `formularios.agendamento`; nulo = desligado). */

export type TextosAgenda = {
  /** Bolha antes do cartão (no lugar do `fechamento` quando o agendamento está ligado). `{nome}` vira o primeiro nome. */
  chamada: string;
  agendaTitulo: string;
  agendaSubtitulo: string;
  confirmarTitulo: string;
  confirmarTexto: string;
  confirmarBotao: string;
  outroHorario: string;
  reservadoTitulo: string;
  reservadoTexto: string;
  botaoWhatsapp: string;
  verLink: string;
  semHorarios: string;
  lotou: string;
  naoAgendou: string;
};

/** Como fica gravado no banco. */
export type Agendamento = {
  /** Slug da agenda no Vórtex Call. */
  agenda: string;
  /** Número do botão de confirmar presença no WhatsApp (só dígitos, com DDI). Vazio = sem botão. */
  whatsapp?: string | null;
  mensagemWhatsapp?: string | null;
  /** Depois de "Horário reservado!", abre o WhatsApp sozinho em 2 s (padrão: não; a pessoa clica no botão). */
  abrirWhatsappSozinho?: boolean | null;
  textos?: Partial<TextosAgenda>;
};

/** Já mesclado com os padrões e com o endereço do Call desta cópia (`base`, sem barra no fim). */
export type AgendamentoEfetivo = { base: string; agenda: string; whatsapp: string | null; mensagemWhatsapp: string; abrirWhatsappSozinho: boolean; textos: TextosAgenda };

/** Sessão como o GET público do Call devolve. */
export type SessaoCall = { id: string; inicio: string; restantes: number; lotada: boolean };

export type ResultadoInscricao =
  | { tipo: "nova"; inicio: string; link: string | null }
  | { tipo: "mesma" | "reagendada"; inicio: string }
  | { tipo: "lotou" }
  | { tipo: "falhou" };

/** Corpo do POST /api/agendamento/{agenda}/inscrever do Call. */
export type PedidoInscricao = {
  sessao: string;
  nome: string;
  /** E.164: "+" seguido de 55, DDD e número, só dígitos. */
  whatsapp: string;
  email?: string;
  /** Id da resposta no Vórtex Type (a ficha do anfitrião usa). */
  resposta: string;
  respostas: { pergunta: string; resposta: string }[];
  utm: Record<string, string>;
  origem: "encaixe";
};
