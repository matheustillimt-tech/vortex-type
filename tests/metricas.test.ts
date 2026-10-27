import assert from "node:assert/strict";
import { test } from "vitest";
import type { Pergunta, RespostaLinha } from "@/src/lib/formulario/tipos";
import { distribuicao, funil, linhasCsv, resumo } from "@/src/lib/formulario/metricas";
import { FERRAMENTAS } from "@/src/lib/mcp/ferramentas";

const P: Pergunta[] = [
  { slug: "nome", tipo: "texto", papel: "nome", texto: "Nome?" },
  { slug: "fat", tipo: "escolha", texto: "Faturamento?", opcoes: ["A", "B"] },
];

const ev = (anon_id: string, evento: string, pergunta?: string) => ({ anon_id, evento, meta: pergunta ? { pergunta } : {} });

test("funil conta pessoas únicas por etapa e a queda em relação à anterior", () => {
  const f = funil(P, [
    ev("a", "abriu"), ev("a", "abriu"), ev("b", "abriu"), ev("c", "abriu"), ev("d", "abriu"),
    ev("a", "respondeu", "nome"), ev("b", "respondeu", "nome"),
    ev("a", "respondeu", "fat"),
    ev("a", "concluiu"),
  ]);
  assert.deepEqual(f.map((e) => e.n), [4, 2, 1, 1]);
  assert.equal(f[1].queda, 0.5);
  assert.equal(f[2].queda, 0.5);
  assert.equal(f[3].doTopo, 0.25);
});

const r = (status: RespostaLinha["status"], fat?: string): RespostaLinha => ({
  id: Math.random().toString(), formulario_id: "b", formulario_slug: "x", status, nome: "Ana", whatsapp: "55", email: null, empresa: null,
  respostas: fat ? [{ slug: "fat", q: "Faturamento?", a: fat }] : [], utm_source: null, utm_medium: null, utm_campaign: null,
  utm_content: null, utm_term: null, origem: {}, criado_em: "2026-10-21T12:00:00Z", atualizado_em: "", concluido_em: null,
});

test("resumo e distribuição", () => {
  const lista = [r("parcial"), r("completo", "A"), r("completo", "A"), r("desqualificado", "B")];
  assert.deepEqual(resumo(lista), { total: 4, parcial: 1, concluiu: 3, desqualificado: 1 });
  assert.deepEqual(distribuicao(lista, "fat"), [{ opcao: "A", n: 2 }, { opcao: "B", n: 1 }]);
});

test("csv tem uma coluna por pergunta que não é contato", () => {
  const [l] = linhasCsv([r("desqualificado", "B")], P);
  assert.equal(l.fat, "B");
  assert.equal(l.status, "Sem perfil");
  assert.ok(!("nome_" in l));
});

test("linha antiga com itens inválidos não quebra distribuição nem CSV", () => {
  const ruim = { ...r("completo"), respostas: [null, { slug: "fat", a: { o: 1 } }, "x", { slug: "fat", q: "Faturamento?", a: "B" }] } as unknown as RespostaLinha;
  const semArray = { ...r("parcial"), respostas: null } as unknown as RespostaLinha;
  assert.deepEqual(distribuicao([ruim, semArray], "fat"), [{ opcao: "B", n: 1 }]);
  const linhas = linhasCsv([ruim, semArray], P);
  assert.equal(linhas[0].fat, "B");
  assert.equal(linhas[1].fat, "");
});

test("funil ganha Viu a agenda e Agendou depois de Concluiu", () => {
  const f = funil(P, [
    ev("a", "abriu"), ev("b", "abriu"), ev("c", "abriu"),
    ev("a", "concluiu"), ev("b", "concluiu"), ev("c", "desqualificado"),
    ev("a", "abriu_agenda"), ev("b", "abriu_agenda"),
    ev("a", "agendou"), ev("a", "agendou"),
  ]);
  assert.deepEqual(f.map((e) => e.key), ["abriu", "p:nome", "p:fat", "concluiu", "abriu_agenda", "agendou"]);
  assert.deepEqual(f.slice(3).map((e) => e.label), ["Concluiu", "Viu a agenda", "Agendou"]);
  assert.deepEqual(f.slice(3).map((e) => e.n), [3, 2, 1]);
  assert.equal(f[5].queda, 0.5);
});

test("sem agendamento o funil fica como antes; ligado mostra as etapas zeradas", () => {
  assert.deepEqual(funil(P, [ev("a", "abriu"), ev("a", "concluiu")]).map((e) => e.key), ["abriu", "p:nome", "p:fat", "concluiu"]);
  const ligado = funil(P, [ev("a", "abriu")], true);
  assert.deepEqual(ligado.slice(-2).map((e) => [e.key, e.n]), [["abriu_agenda", 0], ["agendou", 0]]);
});

test("MCP explica as etapas do agendamento nas métricas", () => {
  const t = FERRAMENTAS.find((x) => x.name === "metricas_formulario")!;
  assert.match(t.description, /Viu a agenda/);
  assert.match(t.description, /Agendou/);
});
