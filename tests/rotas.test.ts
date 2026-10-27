import { describe, expect, it } from "vitest";
import { slugReservado, tipoRota } from "@/src/lib/regras/rotas";

describe("tipoRota", () => {
  it("painel: raiz e as seis áreas", () => {
    for (const p of ["/", "/formularios", "/formularios/1", "/respostas", "/integracoes", "/equipe", "/configuracoes"]) expect(tipoRota(p)).toBe("painel");
  });
  it("público: login, api e qualquer slug", () => {
    for (const p of ["/login", "/api/mcp", "/aplicacao", "/diagnostico", "/formulario/logo.png"]) expect(tipoRota(p)).toBe("publica");
  });
});

describe("slugReservado", () => {
  it("bloqueia rotas do sistema, com qualquer caixa", () => {
    for (const s of ["login", "formularios", "Respostas", "integracoes", "equipe", "configuracoes", "api", "_next", "_qualquer"]) expect(slugReservado(s)).toBe(true);
  });
  it("libera slug comum", () => {
    expect(slugReservado("aplicacao")).toBe(false);
  });
});
