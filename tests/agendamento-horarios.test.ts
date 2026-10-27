import assert from "node:assert/strict";
import { test } from "vitest";
import {
  celulasDoMes, chaveMes, diaEHora, diaPorExtenso, hojeTexto, horariosDePrevia, instanteBrasilia, mesAno, partesBrasilia, porDia, primeiroDia,
  primeiroDiaComHorarioFuturo, primeiroDiaDoMes,
} from "@/src/lib/agendamento/horarios";

test("instante e partes em Brasília vão e voltam", () => {
  const iso = instanteBrasilia("2026-10-23", "14:30");
  assert.equal(iso, "2026-10-23T17:30:00.000Z");
  assert.deepEqual(partesBrasilia(iso), { dia: "2026-10-23", hora: "14:30" });
  // 22h em Brasília já é o dia seguinte em UTC, mas continua no dia 23 aqui
  assert.deepEqual(partesBrasilia(instanteBrasilia("2026-10-23", "22:00")), { dia: "2026-10-23", hora: "22:00" });
});

test("datas por extenso, mês e selo de hoje", () => {
  assert.equal(diaPorExtenso("2026-10-23"), "23 de outubro");
  assert.equal(diaEHora("2026-10-23T18:00:00Z"), "23 de outubro às 15:00");
  assert.equal(mesAno(2026, 9), "Outubro 2026");
  assert.equal(chaveMes(2026, 0), "2026-01");
  assert.equal(hojeTexto(new Date("2026-10-23T16:45:00Z")), "Hoje é Sexta-feira, 13:45");
});

test("porDia agrupa pelo dia de Brasília e ordena", () => {
  const m = porDia([{ inicio: "2026-10-24T01:00:00Z" }, { inicio: "2026-10-23T12:00:00Z" }]);
  assert.deepEqual([...m.keys()], ["2026-10-23"]);
  assert.deepEqual(m.get("2026-10-23")!.map((h) => h.inicio), ["2026-10-23T12:00:00Z", "2026-10-24T01:00:00Z"]);
});

test("celulasDoMes começa no dia da semana certo", () => {
  const c = celulasDoMes(2026, 9); // outubro de 2026 começa numa quinta
  assert.equal(c.filter((x) => x === null).length, 4);
  assert.equal(c.filter(Boolean).length, 31);
  assert.equal(c[4]!.chave, "2026-10-01");
});

test("o cartão abre no primeiro dia com horário (dia de Brasília)", () => {
  const l = [{ inicio: "2026-10-27T13:00:00Z" }, { inicio: "2026-10-26T01:30:00Z" }, { inicio: "2026-11-02T12:00:00Z" }];
  // 26/10 01:30 UTC = 25/10 22:30 em Brasília
  assert.equal(primeiroDia(l), "2026-10-25");
  assert.equal(primeiroDia([]), null);
  const dias = porDia(l);
  assert.equal(primeiroDiaDoMes(dias, 2026, 9), "2026-10-25");
  assert.equal(primeiroDiaDoMes(dias, 2026, 10), "2026-11-02");
  assert.equal(primeiroDiaDoMes(dias, 2026, 11), null);
});

test("primeiroDiaComHorarioFuturo pula dias que já ficaram todos no passado", () => {
  const agora = new Date("2026-10-26T12:00:00Z");
  const l = [{ inicio: "2026-10-26T01:30:00Z" }, { inicio: "2026-10-27T13:00:00Z" }, { inicio: "2026-11-02T12:00:00Z" }];
  // 26/10 01:30 UTC já passou (agora é 26/10 12:00 UTC): o dia 25/10 (Brasília) nem entra, vai pro 27/10
  assert.equal(primeiroDiaComHorarioFuturo(l, agora), "2026-10-27");
  assert.equal(primeiroDiaComHorarioFuturo(l, new Date("2026-10-20T00:00:00Z")), "2026-10-25"); // tudo no futuro: igual primeiroDia
  assert.equal(primeiroDiaComHorarioFuturo(l, new Date("2026-12-01T00:00:00Z")), null); // tudo no passado
  assert.equal(primeiroDiaComHorarioFuturo([], agora), null);
});

test("horários da prévia: próximos dias úteis, 3 por dia, nenhum lotado", () => {
  const h = horariosDePrevia(new Date("2026-10-23T16:45:00Z")); // sexta
  assert.equal(h.length, 15);
  const dias = porDia(h);
  assert.deepEqual([...dias.keys()], ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"]);
  assert.deepEqual(dias.get("2026-10-26")!.map((x) => partesBrasilia(x.inicio).hora), ["10:00", "14:00", "15:00"]);
  assert.ok(h.every((x) => !x.lotada && x.restantes > 0));
});
