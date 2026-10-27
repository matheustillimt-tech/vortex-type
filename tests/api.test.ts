import { describe, expect, it } from "vitest";
import { FORMATO_CHAVE, gerarChave, hashDaChave, prefixoDaChave } from "@/src/lib/api/chaves";
import { lerFiltro, lerPeriodo } from "@/src/lib/api/parametros";
import { buscarPaginado } from "@/src/lib/api/consultas";

describe("chaves", () => {
  it("formato vt_ + 40 base62, prefixo e hash", () => {
    const c = gerarChave();
    expect(c).toMatch(FORMATO_CHAVE);
    expect(prefixoDaChave(c)).toBe(c.slice(3, 11));
    expect(hashDaChave(c)).toMatch(/^[0-9a-f]{64}$/);
    expect(gerarChave()).not.toBe(c);
  });
});

describe("lerFiltro", () => {
  it("padrão: 100 por página", () => {
    expect(lerFiltro({})).toEqual({ ok: true, filtro: { limite: 100 } });
  });
  it("aceita formulário, status, datas, limite até 500 e cursor", () => {
    expect(lerFiltro({ formulario: "2f1c9a4e-1b2c-4d3e-8f90-123456789abc", status: "completo", de: "2026-10-01", ate: "2026-10-23", limite: "600", antes: "2026-10-20T10:00:00.000Z_2f1c9a4e-1b2c-4d3e-8f90-123456789abc" })).toEqual({
      ok: true,
      filtro: {
        formulario: "2f1c9a4e-1b2c-4d3e-8f90-123456789abc", status: "completo", de: "2026-10-01T03:00:00.000Z", ate: "2026-10-24T03:00:00.000Z", limite: 500,
        antes: { criadoEm: "2026-10-20T10:00:00.000Z", id: "2f1c9a4e-1b2c-4d3e-8f90-123456789abc" },
      },
    });
  });
  it("cursor com microssegundos e offset volta idêntico (não reserializa)", () => {
    const r = lerFiltro({ antes: "2026-10-23T10:18:00.123456+00:00_2f1c9a4e-1b2c-4d3e-8f90-123456789abc" });
    expect(r).toEqual({
      ok: true,
      filtro: { limite: 100, antes: { criadoEm: "2026-10-23T10:18:00.123456+00:00", id: "2f1c9a4e-1b2c-4d3e-8f90-123456789abc" } },
    });
  });
  it("recusa o que não serve", () => {
    expect(lerFiltro({ formulario: "x" })).toEqual({ ok: false, erro: "formulario: use o id (uuid) do formulário." });
    expect(lerFiltro({ status: "agendado" })).toEqual({ ok: false, erro: "status: use parcial, completo ou desqualificado." });
    expect(lerFiltro({ de: "23/10/2026" })).toEqual({ ok: false, erro: "de/ate: use AAAA-MM-DD." });
    expect(lerFiltro({ antes: "ontem" })).toEqual({ ok: false, erro: "antes: use o valor do campo proximo." });
  });
  it("recusa antes sem o id (formato antigo, só a data)", () => {
    expect(lerFiltro({ antes: "2026-10-20T10:00:00.000Z" })).toEqual({ ok: false, erro: "antes: use o valor do campo proximo." });
  });
  it("recusa antes com timestamp malformado", () => {
    expect(lerFiltro({ antes: "23/10/2026 10:18_2f1c9a4e-1b2c-4d3e-8f90-123456789abc" })).toEqual({ ok: false, erro: "antes: use o valor do campo proximo." });
    expect(lerFiltro({ antes: "2026-10-23T25:99:00Z_2f1c9a4e-1b2c-4d3e-8f90-123456789abc" })).toEqual({ ok: false, erro: "antes: use o valor do campo proximo." });
  });
});

describe("lerPeriodo", () => {
  it("sem datas: últimos 30 dias até agora", () => {
    const p = lerPeriodo();
    expect(p.ok).toBe(true);
    if (p.ok) expect(new Date(p.ate).getTime() - new Date(p.de).getTime()).toBeGreaterThanOrEqual(29 * 86400000);
  });
  it("datas em horário de Brasília, fim inclusivo", () => {
    expect(lerPeriodo("2026-10-01", "2026-10-01")).toEqual({ ok: true, de: "2026-10-01T03:00:00.000Z", ate: "2026-10-02T03:00:00.000Z" });
  });
});

describe("buscarPaginado", () => {
  const fonte = (total: number) => {
    const pedidos: [number, number][] = [];
    const pagina = async (de: number, ate: number) => {
      pedidos.push([de, ate]);
      const fim = Math.min(ate + 1, total);
      return { data: Array.from({ length: Math.max(fim - de, 0) }, (_, k) => de + k), error: null };
    };
    return { pedidos, pagina };
  };

  it("busca de 1000 em 1000 até vir página incompleta", async () => {
    const f = fonte(2500);
    const r = await buscarPaginado(f.pagina, 50);
    expect(r.linhas).toHaveLength(2500);
    expect(r.linhas[2499]).toBe(2499);
    expect(r.truncado).toBe(false);
    expect(f.pedidos).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it("múltiplo exato de 1000 pede uma página vazia e não marca truncado", async () => {
    const f = fonte(2000);
    const r = await buscarPaginado(f.pagina, 50);
    expect(r.linhas).toHaveLength(2000);
    expect(r.truncado).toBe(false);
  });

  it("para no teto de páginas e marca truncado", async () => {
    const f = fonte(10_000);
    const r = await buscarPaginado(f.pagina, 3);
    expect(r.linhas).toHaveLength(3000);
    expect(r.truncado).toBe(true);
    expect(f.pedidos).toHaveLength(3);
  });

  it("erro do banco vira exceção", async () => {
    await expect(buscarPaginado(async () => ({ data: null, error: { message: "boom" } }), 5)).rejects.toThrow("boom");
  });
});
