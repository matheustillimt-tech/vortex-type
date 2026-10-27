import { describe, expect, it } from "vitest";
import { senhaAleatoria } from "@/src/lib/crypto";
import { env } from "@/src/lib/env";

describe("base do projeto", () => {
  it("senha aleatória tem o tamanho pedido e só letras e dígitos", () => {
    const s = senhaAleatoria(20);
    expect(s).toHaveLength(20);
    expect(s).toMatch(/^[A-Za-z0-9]+$/);
  });

  it("env acusa variável ausente pelo nome", () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => env("SUPABASE_SERVICE_ROLE_KEY")).toThrow("SUPABASE_SERVICE_ROLE_KEY");
  });
});
