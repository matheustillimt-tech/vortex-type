import { describe, expect, it } from "vitest";
import { conversaoGoogleValida, idPixelValido } from "@/src/lib/formulario/pixels";

describe("pixels", () => {
  it("aceita IDs de Meta, TikTok e Google", () => {
    for (const id of ["1234567890123456", "C4ABCDEF12GHIJ", "G-AB12CD34", "AW-123456789"]) expect(idPixelValido(id)).toBe(true);
  });
  it("recusa ID que mexeria na URL ou no script", () => {
    for (const id of ["", "1&x=1", "a b", "G-1\"/><script>", "x".repeat(41), "AW-1/rotulo", null, 1]) expect(idPixelValido(id)).toBe(false);
  });
  it("conversão do Google Ads com uma barra só", () => {
    expect(conversaoGoogleValida("AW-123/abc_D-1")).toBe(true);
    expect(conversaoGoogleValida("AW-123")).toBe(false);
    expect(conversaoGoogleValida("AW-123/a/b")).toBe(false);
    expect(conversaoGoogleValida("G-1/a")).toBe(false);
  });
});
