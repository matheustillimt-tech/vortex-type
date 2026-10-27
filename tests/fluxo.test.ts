import assert from "node:assert/strict";
import { test } from "vitest";
import {
  alternarOpcao,
  conferirPerguntas,
  erroTelefone,
  htmlDaBolha,
  juntar,
  listaRespostas,
  mascaraTelefone,
  normalizarTelefone,
  progresso,
  proxima,
  separar,
  slugify,
  validar,
} from "@/src/lib/formulario/fluxo";
import { mesclar, TEXTOS_PADRAO } from "@/src/lib/formulario/padroes";
import type { Pergunta } from "@/src/lib/formulario/tipos";

const P: Pergunta[] = [
  { slug: "nome", tipo: "texto", papel: "nome", texto: "Nome?" },
  { slug: "whatsapp", tipo: "telefone", papel: "whatsapp", texto: "WhatsApp?" },
  { slug: "tem_empresa", tipo: "escolha", texto: "Tem empresa?", opcoes: ["Sim", "Não"] },
  { slug: "empresa", tipo: "texto", papel: "empresa", texto: "Nome da empresa?", condicao: { slug: "tem_empresa", valores: ["Sim"] } },
  { slug: "email", tipo: "email", papel: "email", texto: "E-mail?" },
];

test("proxima pula pergunta com condição que não bateu", () => {
  assert.equal(proxima(P, {}, 0), 0);
  assert.equal(proxima(P, { tem_empresa: "Sim" }, 3), 3);
  assert.equal(proxima(P, { tem_empresa: "Não" }, 3), 4);
  assert.equal(proxima(P, {}, 5), 5);
});

test("progresso conta só as perguntas que vão aparecer", () => {
  assert.deepEqual(progresso(P, {}, 0), { feitas: 0, total: 5 });
  assert.deepEqual(progresso(P, { nome: "A", whatsapp: "1", tem_empresa: "Não" }, 4), { feitas: 3, total: 4 });
});

test("telefone: máscara, normalização e validação (números fictícios)", () => {
  assert.equal(mascaraTelefone("11987654321"), "(11) 98765-4321");
  assert.equal(mascaraTelefone("5511987654321"), "(11) 98765-4321");
  assert.equal(mascaraTelefone("119"), "(11) 9");
  assert.equal(normalizarTelefone("(11) 98765-4321"), "5511987654321");
  assert.equal(normalizarTelefone("(11) 8000-0001"), "5511980000001");
  assert.equal(erroTelefone("(11) 90000-0001"), null);
  assert.match(erroTelefone("(20) 90000-0001")!, /DDD/);
  assert.match(erroTelefone("(11) 3000-0001")!, /celular|9 na frente/);
  assert.match(erroTelefone("(11) 91234-5678")!, /não parece válido/);
  assert.match(erroTelefone("(11) 99999-9999")!, /não parece válido/);
  assert.match(erroTelefone("123")!, /DDD/);
});

test("validar nome, e-mail, texto e o campo livre do Outro", () => {
  assert.equal(validar(P[0], "Ana Souza"), null);
  assert.ok(validar(P[0], "G"));
  assert.equal(validar(P[4], "a@b.com"), null);
  assert.ok(validar(P[4], "a@b"));
  assert.equal(validar(P[3], "Padaria"), null);
  assert.ok(validar(P[3], "  "));
  assert.ok(validar(P[2], "ab", true));
  assert.equal(validar(P[2], "Clínica de estética", true), null);
});

test("htmlDaBolha escapa HTML e troca {nome} e **negrito**", () => {
  assert.equal(htmlDaBolha("Prazer, {nome}!", "Ana"), "Prazer, <b>Ana</b>!");
  assert.equal(htmlDaBolha("<script>x</script>", ""), "&lt;script&gt;x&lt;/script&gt;");
  assert.equal(htmlDaBolha("é **muito** bom", ""), "é <b>muito</b> bom");
  assert.match(htmlDaBolha("veja https://a.com.", ""), /<a href="https:\/\/a\.com"/);
});

test("listaRespostas guarda só o que apareceu, na ordem", () => {
  const r = listaRespostas(P, { nome: "Ana", whatsapp: "x", tem_empresa: "Não", empresa: "sobrou", email: "a@b.com" });
  assert.deepEqual(r.map((x) => x.slug), ["nome", "whatsapp", "tem_empresa", "email"]);
  assert.equal(r[0].q, "Nome?");
});

test("conferirPerguntas acha os erros que quebram a conversa", () => {
  assert.deepEqual(conferirPerguntas(P), []);
  const ruim: Pergunta[] = [
    { slug: "a", tipo: "escolha", texto: "x", opcoes: [] },
    { slug: "a", tipo: "texto", texto: "", condicao: { slug: "z", valores: [] } },
  ];
  const e = conferirPerguntas(ruim);
  assert.ok(e.some((x) => x.includes("sem opções")));
  assert.ok(e.some((x) => x.includes("repetido")));
  assert.ok(e.some((x) => x.includes("falta o texto")));
  assert.ok(e.some((x) => x.includes("condição")));
  assert.ok(e.some((x) => x.includes('"nome"')));
});

test("conferirPerguntas devolve erro (sem quebrar) pra item que não é objeto", () => {
  const base = { slug: "nome", tipo: "texto", papel: "nome", texto: "Nome?" } as const;
  const w = { slug: "whatsapp", tipo: "telefone", papel: "whatsapp", texto: "Zap?" } as const;
  const e = conferirPerguntas([base, null, "x", [1], w] as never);
  assert.deepEqual(e, ["Pergunta 2: formato inválido.", "Pergunta 3: formato inválido.", "Pergunta 4: formato inválido."]);
  assert.deepEqual(conferirPerguntas([null] as never).slice(0, 1), ["Pergunta 1: formato inválido."]);
});

test("conferirPerguntas rejeita formatos inválidos vindos do MCP", () => {
  const base = { slug: "nome", tipo: "texto", papel: "nome", texto: "Nome?" } as const;
  const w = { slug: "whatsapp", tipo: "telefone", papel: "whatsapp", texto: "Zap?" } as const;

  const tipoRuim = conferirPerguntas([base, w, { slug: "x", tipo: "numero" as never, texto: "x" }]);
  assert.ok(tipoRuim.some((e) => e.includes("tipo de pergunta inválido")));

  const textoRuim = conferirPerguntas([base, w, { slug: "x", tipo: "texto", texto: 123 as never }]);
  assert.ok(textoRuim.some((e) => e.includes("falta o texto")));

  const bolhasRuim = conferirPerguntas([base, w, { slug: "x", tipo: "texto", texto: "x", bolhas: "oi" as never }]);
  assert.ok(bolhasRuim.some((e) => e.includes("bolhas precisa ser uma lista de textos")));

  const opcoesRuim = conferirPerguntas([base, w, { slug: "x", tipo: "escolha", texto: "x", opcoes: [1, 2] as never }]);
  assert.ok(opcoesRuim.some((e) => e.includes("opções precisa ser uma lista de textos")));

  const desqualificaRuim = conferirPerguntas([base, w, { slug: "x", tipo: "texto", texto: "x", desqualifica: [1] as never }]);
  assert.ok(desqualificaRuim.some((e) => e.includes("desqualifica precisa ser uma lista de textos")));

  const condicaoRuim = conferirPerguntas([base, w, { slug: "x", tipo: "texto", texto: "x", condicao: { slug: "nome", valores: 123 } as never }]);
  assert.ok(condicaoRuim.some((e) => e.includes("condição inválida")));

  const condicaoNaoObjeto = conferirPerguntas([base, w, { slug: "x", tipo: "texto", texto: "x", condicao: "nome" as never }]);
  assert.ok(condicaoNaoObjeto.some((e) => e.includes("condição inválida")));

  const maximoRuim = conferirPerguntas([base, w, { slug: "x", tipo: "varias", texto: "x", opcoes: ["A"], maximo: -1 }]);
  assert.ok(maximoRuim.some((e) => e.includes("máximo de opções")));

  const maximoTipoErrado = conferirPerguntas([base, w, { slug: "x", tipo: "varias", texto: "x", opcoes: ["A"], maximo: "3" as never }]);
  assert.ok(maximoTipoErrado.some((e) => e.includes("máximo de opções")));

  const outroRuim = conferirPerguntas([base, w, { slug: "x", tipo: "escolha", texto: "x", opcoes: ["A"], outro: { rotulo: 5 } as never }]);
  assert.ok(outroRuim.some((e) => e.includes('"outro"')));

  const outroNaoObjeto = conferirPerguntas([base, w, { slug: "x", tipo: "escolha", texto: "x", opcoes: ["A"], outro: "oi" as never }]);
  assert.ok(outroNaoObjeto.some((e) => e.includes('"outro"')));

  const papelRuim = conferirPerguntas([base, w, { slug: "x", tipo: "texto", texto: "x", papel: "admin" as never }]);
  assert.ok(papelRuim.some((e) => e.includes("papel inválido")));

  // Formatos válidos (incluindo os opcionais ausentes) não geram erro de formato.
  assert.deepEqual(
    conferirPerguntas([base, w, { slug: "x", tipo: "escolha", texto: "x", opcoes: ["A", "B"], outro: { rotulo: "Outro" }, condicao: { slug: "nome", valores: ["Ana"] }, papel: "empresa" }]),
    [],
  );
});

test("slugify", () => {
  assert.equal(slugify("Sua Empresa · Aplicação"), "sua-empresa-aplicacao");
});

test("mesclar usa o padrão quando o banco não tem o texto ou a cor", () => {
  const m = mesclar({ cores: { marca: "#123456", verde: "vermelho" }, textos: { desqualificado: "Valeu", fechamento: "  ", perfilIdeal: [] }, pixels: { meta: ["1"] } });
  assert.equal(m.cores.marca, "#123456");
  assert.equal(m.cores.verde, "#1eb84a");
  assert.equal(m.textos.desqualificado, "Valeu");
  assert.equal(m.textos.fechamento, TEXTOS_PADRAO.fechamento);
  assert.deepEqual(m.textos.perfilIdeal, TEXTOS_PADRAO.perfilIdeal);
  assert.deepEqual(m.pixels.meta, ["1"]);
  assert.deepEqual(m.pixels.acoes.lead.meta, ["Lead"]);
});

test("várias opções: junta com '; ' (opção pode ter vírgula) e separa de volta", () => {
  const v = juntar(["Cobrança, financeiro e conciliação", "Relatórios"]);
  assert.equal(v, "Cobrança, financeiro e conciliação; Relatórios");
  assert.deepEqual(separar(v), ["Cobrança, financeiro e conciliação", "Relatórios"]);
  const base = [{ slug: "nome", tipo: "texto", papel: "nome", texto: "Nome?" }, { slug: "w", tipo: "telefone", papel: "whatsapp", texto: "Zap?" }] as const;
  assert.deepEqual(conferirPerguntas([...base, { slug: "t", tipo: "varias", texto: "Tarefas?", opcoes: [] }]), ["Pergunta 3: escolha sem opções."]);
  assert.deepEqual(conferirPerguntas([...base, { slug: "t", tipo: "varias", texto: "Tarefas?", opcoes: ["A"], maximo: 0 }]), ["Pergunta 3: o máximo de opções precisa ser 1 ou mais."]);
  assert.deepEqual(conferirPerguntas([...base, { slug: "t", tipo: "varias", texto: "Tarefas?", opcoes: ["A"], maximo: 3 }]), []);
});

test("várias opções: opção exclusiva desmarca as outras e é desmarcada por elas", () => {
  const ex = ["Todas"];
  assert.deepEqual(alternarOpcao([], "A", { exclusivas: ex }), ["A"]);
  assert.deepEqual(alternarOpcao(["A", "B"], "Todas", { exclusivas: ex }), ["Todas"]);
  assert.deepEqual(alternarOpcao(["Todas"], "A", { exclusivas: ex }), ["A"]);
  assert.deepEqual(alternarOpcao(["Todas"], "Todas", { exclusivas: ex }), []);
  assert.deepEqual(alternarOpcao(["A"], "A", {}), []);
  // no máximo, as comuns travam, mas a exclusiva entra (troca tudo por ela)
  assert.deepEqual(alternarOpcao(["A", "B"], "C", { maximo: 2 }), ["A", "B"]);
  assert.deepEqual(alternarOpcao(["A", "B"], "Todas", { maximo: 2, exclusivas: ex }), ["Todas"]);
});
