import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "vitest";
import { buscarHorarios, inscrever, linkWhatsapp, montarInscricao, paraE164, sessoesValidas, testarAgenda, urlCall } from "@/src/lib/agendamento/call";
import type { PedidoInscricao } from "@/src/lib/agendamento/tipos";
import type { Pergunta } from "@/src/lib/formulario/tipos";

const BASE = "https://call.exemplo.com";
type Chamada = { url: string; init?: RequestInit };

function falso(status: number, corpo: unknown, chamadas: Chamada[] = []) {
  return (async (url: string, init?: RequestInit) => {
    chamadas.push({ url: String(url), init });
    return new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });
  }) as unknown as typeof fetch;
}
const quebrado = (async () => {
  throw new TypeError("Failed to fetch");
}) as unknown as typeof fetch;

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_VORTEX_CALL_URL;
});
afterEach(() => {
  delete process.env.NEXT_PUBLIC_VORTEX_CALL_URL;
});

test("endereço do Call vem da variável, sem barra no fim", () => {
  assert.equal(urlCall(), null);
  process.env.NEXT_PUBLIC_VORTEX_CALL_URL = "https://agenda.exemplo.com/";
  assert.equal(urlCall(), "https://agenda.exemplo.com");
  process.env.NEXT_PUBLIC_VORTEX_CALL_URL = "agenda.exemplo.com";
  assert.equal(urlCall(), null);
});

// Números fictícios, só pra testar formato.
const CEL = "5511980000001";
const E164 = `+${CEL}`;

test("WhatsApp em E.164 e link do wa.me", () => {
  assert.equal(paraE164("(11) 98000-0001"), E164);
  assert.equal(paraE164(CEL), E164);
  assert.equal(paraE164("(11) 8000-0001"), E164); // celular antigo de 8 dígitos ganha o 9
  assert.equal(paraE164("123"), null);
  assert.equal(linkWhatsapp("55 (11) 8000-0001", "Quero confirmar minha presença"), "https://wa.me/551180000001?text=Quero%20confirmar%20minha%20presen%C3%A7a");
  assert.equal(linkWhatsapp(null, "x"), null);
  assert.equal(linkWhatsapp("", "x"), null);
});

const P: Pergunta[] = [
  { slug: "nome", tipo: "texto", papel: "nome", texto: "Qual é o seu nome?" },
  { slug: "whats", tipo: "telefone", papel: "whatsapp", texto: "Seu WhatsApp?" },
  { slug: "empresa", tipo: "texto", papel: "empresa", texto: "Nome da empresa?" },
  { slug: "fat", tipo: "escolha", papel: "faturamento", texto: "Faturamento?", opcoes: ["Até R$ 60 mil", "Mais"] },
  { slug: "extra", tipo: "texto", texto: "Só aparece pra Mais", condicao: { slug: "fat", valores: ["Mais"] } },
  { slug: "email", tipo: "email", papel: "email", texto: "Seu e-mail?" },
];
const R = { nome: " Ana Souza ", whats: CEL, empresa: "Padaria", fat: "Até R$ 60 mil", email: "ana@exemplo.com" };

test("corpo da inscrição: papéis, E.164, respostas sem contato, UTMs e origem encaixe", () => {
  const c = montarInscricao({ perguntas: P, respostas: R, respostaId: "r-1", sessao: "s-1", origem: { utm_source: "ig", utm_campaign: "lancamento", fbclid: "x", url: "https://formularios.exemplo.com/aplicacao" } });
  assert.deepEqual(c, {
    sessao: "s-1",
    nome: "Ana Souza",
    whatsapp: E164,
    email: "ana@exemplo.com",
    resposta: "r-1",
    respostas: [
      { pergunta: "Nome da empresa?", resposta: "Padaria" },
      { pergunta: "Faturamento?", resposta: "Até R$ 60 mil" },
    ],
    utm: { utm_source: "ig", utm_campaign: "lancamento" },
    origem: "encaixe",
  });
  assert.equal(montarInscricao({ perguntas: P, respostas: { ...R, whats: "123" }, respostaId: "r", sessao: "s", origem: {} }), null);
  assert.equal(montarInscricao({ perguntas: P, respostas: { ...R, nome: "  " }, respostaId: "r", sessao: "s", origem: {} }), null);
  const semEmail = montarInscricao({ perguntas: P, respostas: { ...R, email: "" }, respostaId: "r", sessao: "s", origem: {} })!;
  assert.ok(!("email" in semEmail));
});

test("respostas cabem no limite de 5000 caracteres do Call", () => {
  const muitas: Pergunta[] = [P[0], P[1], ...Array.from({ length: 12 }, (_, i) => ({ slug: `q${i}`, tipo: "texto" as const, texto: `Pergunta ${i}` }))];
  const r: Record<string, string> = { nome: "Ana", whats: CEL };
  for (let i = 0; i < 12; i++) r[`q${i}`] = "x".repeat(700);
  const c = montarInscricao({ perguntas: muitas, respostas: r, respostaId: "r", sessao: "s", origem: {} })!;
  assert.ok(JSON.stringify(c.respostas).length <= 5000);
  assert.ok(c.respostas.length >= 7 && c.respostas.length < 12);
  assert.equal(c.respostas[0].resposta.length, 600);
});

test("horários: só sessões válidas e não lotadas, em ordem", async () => {
  const chamadas: Chamada[] = [];
  const corpo = {
    agenda: { slug: "demonstracao" },
    sessoes: [
      { id: "b", inicio: "2026-10-27T17:00:00Z", restantes: 3, lotada: false },
      { id: "a", inicio: "2026-10-26T17:00:00Z", restantes: 15, lotada: false },
      { id: "c", inicio: "2026-10-26T18:00:00Z", restantes: 0, lotada: true },
      { id: 1, inicio: "lixo" },
      null,
    ],
  };
  const l = await buscarHorarios(BASE, "demonstracao", falso(200, corpo, chamadas));
  assert.deepEqual(l.map((s) => s.id), ["a", "b"]);
  assert.equal(chamadas[0].url, "https://call.exemplo.com/api/agendamento/demonstracao");
  await assert.rejects(buscarHorarios(BASE, "nao-existe", falso(404, { erro: "Agenda não encontrada." })));
  await assert.rejects(buscarHorarios(BASE, "demonstracao", quebrado));
  assert.deepEqual(sessoesValidas("x"), []);
});

const PEDIDO: PedidoInscricao = { sessao: "s-1", nome: "Ana", whatsapp: E164, resposta: "r-1", respostas: [], utm: {}, origem: "encaixe" };
const INICIO = "2026-10-26T17:00:00.000Z";

test("inscrição: cada resultado do Call", async () => {
  const chamadas: Chamada[] = [];
  assert.deepEqual(
    await inscrever(BASE, "demonstracao", PEDIDO, falso(200, { resultado: "nova", codigo: "abc", link: "https://call.exemplo.com/c/abc", inicio: INICIO }, chamadas)),
    { tipo: "nova", inicio: INICIO, link: "https://call.exemplo.com/c/abc" },
  );
  assert.equal(chamadas[0].url, "https://call.exemplo.com/api/agendamento/demonstracao/inscrever");
  assert.equal(chamadas[0].init?.method, "POST");
  assert.deepEqual(JSON.parse(String(chamadas[0].init?.body)), PEDIDO);
  assert.deepEqual(await inscrever(BASE, "a", PEDIDO, falso(200, { resultado: "mesma", inicio: INICIO })), { tipo: "mesma", inicio: INICIO });
  assert.deepEqual(await inscrever(BASE, "a", PEDIDO, falso(200, { resultado: "reagendada", inicio: INICIO })), { tipo: "reagendada", inicio: INICIO });
  assert.deepEqual(await inscrever(BASE, "a", PEDIDO, falso(409, { resultado: "lotada" })), { tipo: "lotou" });
  assert.deepEqual(await inscrever(BASE, "a", PEDIDO, falso(409, { resultado: "indisponivel" })), { tipo: "lotou" });
  assert.deepEqual(await inscrever(BASE, "a", PEDIDO, falso(400, { erro: "Confira o WhatsApp com DDD." })), { tipo: "falhou" });
  assert.deepEqual(await inscrever(BASE, "a", PEDIDO, falso(429, { erro: "Muitas tentativas. Espere um minuto." })), { tipo: "falhou" });
  assert.deepEqual(await inscrever(BASE, "a", PEDIDO, falso(200, { resultado: "estranho", inicio: INICIO })), { tipo: "falhou" });
  assert.deepEqual(await inscrever(BASE, "a", PEDIDO, falso(200, { resultado: "nova", inicio: "lixo" })), { tipo: "falhou" });
  assert.deepEqual(await inscrever(BASE, "a", PEDIDO, quebrado), { tipo: "falhou" });
  // link fora de http(s) não vira botão
  assert.deepEqual(await inscrever(BASE, "a", PEDIDO, falso(200, { resultado: "nova", link: "javascript:alert(1)", inicio: INICIO })), { tipo: "nova", inicio: INICIO, link: null });
});

test("sem AbortSignal.timeout (Safari/iOS antigo) o fetch ainda acontece", async () => {
  const original = AbortSignal.timeout;
  // @ts-expect-error simula o Safari/iOS < 16, que não tem AbortSignal.timeout
  AbortSignal.timeout = undefined;
  const chamadas: Chamada[] = [];
  const globalFetchOriginal = globalThis.fetch;
  globalThis.fetch = falso(200, { sessoes: [{ id: "a", inicio: "2026-10-26T17:00:00Z", restantes: 1, lotada: false }] }, chamadas);
  try {
    const l = await buscarHorarios(BASE, "demonstracao"); // sem `f`: usa o buscar padrão, com fetch global
    assert.deepEqual(l.map((s) => s.id), ["a"]);
    assert.equal(chamadas.length, 1);
    assert.ok(chamadas[0].init?.signal instanceof AbortSignal);
  } finally {
    AbortSignal.timeout = original;
    globalThis.fetch = globalFetchOriginal;
  }
});

test("botão Testar do editor", async () => {
  const sessoes = [
    { id: "a", inicio: "2026-10-26T17:00:00Z", restantes: 1, lotada: false },
    { id: "b", inicio: "2026-10-26T18:00:00Z", restantes: 0, lotada: true },
  ];
  assert.deepEqual(await testarAgenda(BASE, "demonstracao", falso(200, { sessoes })), { ok: true, abertos: 1 });
  assert.deepEqual(await testarAgenda(BASE, "nao-existe", falso(404, {})), { ok: false, erro: "Agenda não encontrada no Vórtex Call. Confira o endereço e se ela está ativa." });
  assert.deepEqual(await testarAgenda(BASE, "Com Espaço", falso(200, {})), { ok: false, erro: "Endereço inválido: use letras minúsculas, números e hífen." });
  assert.deepEqual(await testarAgenda(BASE, "demonstracao", quebrado), { ok: false, erro: "Não deu pra falar com o Vórtex Call. Tente de novo." });
  assert.deepEqual(await testarAgenda(BASE, "demonstracao", falso(500, {})), { ok: false, erro: "Não deu pra falar com o Vórtex Call. Tente de novo." });
});
