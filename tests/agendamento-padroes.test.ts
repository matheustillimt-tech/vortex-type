import assert from "node:assert/strict";
import { test } from "vitest";
import { conferirAgendamento, MENSAGEM_WHATSAPP_PADRAO, mesclarAgendamento, ROTULOS_TEXTOS_AGENDA, TEXTOS_AGENDA_PADRAO } from "@/src/lib/agendamento/padroes";

const BASE = "https://agenda.exemplo.com";

test("textos padrão", () => {
  assert.equal(TEXTOS_AGENDA_PADRAO.chamada, "Agora é só escolher o melhor horário pra sua reunião com o nosso time:");
  assert.equal(TEXTOS_AGENDA_PADRAO.agendaTitulo, "Agende sua reunião");
  assert.equal(TEXTOS_AGENDA_PADRAO.confirmarBotao, "Confirmar horário");
  assert.equal(TEXTOS_AGENDA_PADRAO.botaoWhatsapp, "Confirmar presença no WhatsApp");
  assert.equal(TEXTOS_AGENDA_PADRAO.semHorarios, "Agora não há horários livres na agenda. Nosso time vai falar com você pelo WhatsApp.");
  assert.equal(TEXTOS_AGENDA_PADRAO.lotou, "Esse horário acabou de ser preenchido. Escolha outro.");
  assert.equal(TEXTOS_AGENDA_PADRAO.naoAgendou, "Não foi possível agendar agora. Tente de novo.");
  assert.equal(MENSAGEM_WHATSAPP_PADRAO, "Oi! Acabei de agendar minha reunião e quero confirmar minha presença.");
  assert.deepEqual(ROTULOS_TEXTOS_AGENDA.map((r) => r.key).sort(), Object.keys(TEXTOS_AGENDA_PADRAO).sort());
});

test("desligado: sem endereço do Call, sem configuração ou agenda inválida", () => {
  assert.equal(mesclarAgendamento({ agenda: "demonstracao" }, null), null);
  assert.equal(mesclarAgendamento(null, BASE), null);
  assert.equal(mesclarAgendamento([], BASE), null);
  assert.equal(mesclarAgendamento({ agenda: "" }, BASE), null);
  assert.equal(mesclarAgendamento({ agenda: "Sua Agenda" }, BASE), null);
});

test("mescla com os padrões", () => {
  const a = mesclarAgendamento({ agenda: " demonstracao ", whatsapp: "+55 (11) 8000-0001", textos: { agendaTitulo: "Marque sua call", lotou: "  ", inventado: "x" } }, BASE)!;
  assert.equal(a.base, BASE);
  assert.equal(a.agenda, "demonstracao");
  assert.equal(a.whatsapp, "551180000001");
  assert.equal(a.mensagemWhatsapp, MENSAGEM_WHATSAPP_PADRAO);
  assert.equal(a.textos.agendaTitulo, "Marque sua call");
  assert.equal(a.textos.lotou, TEXTOS_AGENDA_PADRAO.lotou);
  assert.equal(a.textos.reservadoTitulo, "Horário reservado!");
  assert.ok(!("inventado" in a.textos));
  assert.equal(mesclarAgendamento({ agenda: "x", whatsapp: "" }, BASE)!.whatsapp, null);
  assert.equal(mesclarAgendamento({ agenda: "x", mensagemWhatsapp: "Oi" }, BASE)!.mensagemWhatsapp, "Oi");
});

test("conferência do editor antes de salvar", () => {
  assert.equal(conferirAgendamento(null), null);
  assert.equal(conferirAgendamento(undefined), null);
  assert.equal(conferirAgendamento({ agenda: "demonstracao", whatsapp: "551180000001" }), null);
  assert.equal(conferirAgendamento({ agenda: "demonstracao" }), null);
  assert.match(conferirAgendamento({ agenda: "" })!, /endereço da agenda/);
  assert.match(conferirAgendamento({ agenda: "demonstracao", whatsapp: "11 8000" })!, /WhatsApp/);
});

test("abrir o WhatsApp sozinho depois de reservar: desligado, a não ser que esteja marcado", () => {
  assert.equal(mesclarAgendamento({ agenda: "x" }, BASE)!.abrirWhatsappSozinho, false);
  assert.equal(mesclarAgendamento({ agenda: "x", abrirWhatsappSozinho: "sim" }, BASE)!.abrirWhatsappSozinho, false);
  assert.equal(mesclarAgendamento({ agenda: "x", abrirWhatsappSozinho: true }, BASE)!.abrirWhatsappSozinho, true);
});
