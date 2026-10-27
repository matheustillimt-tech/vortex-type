import { describe, expect, it } from "vitest";
import { validarSlug } from "@/src/lib/formulario/slug";

describe("validarSlug", () => {
  it("aceita endereço comum", () => {
    expect(validarSlug("aplicacao-mentoria")).toBeNull();
  });
  it("recusa formato inválido", () => {
    for (const s of ["", "a", "-comeca-com-hifen", "Maiuscula", "com espaço", "x".repeat(61)]) {
      expect(validarSlug(s)).toBe("Endereço inválido: use letras minúsculas, números e hífen (2 a 60 caracteres).");
    }
  });
  it("recusa rota do sistema", () => {
    for (const s of ["login", "formularios", "equipe", "api"]) {
      expect(validarSlug(s)).toBe("Esse endereço é usado pelo sistema. Escolha outro.");
    }
  });
});
