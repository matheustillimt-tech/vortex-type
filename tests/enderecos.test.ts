import { describe, expect, it } from "vitest";
import { conferirEnderecos, enderecoValido, ERRO_ENDERECO } from "@/src/lib/formulario/enderecos";

const vazio = { privacidade_url: null, termos_url: null, logo_url: null, avatar_url: null };

describe("enderecos", () => {
  it("vazio e https passam", () => {
    expect(enderecoValido(null)).toBe(true);
    expect(enderecoValido("  ")).toBe(true);
    expect(enderecoValido("https://site.com/privacidade")).toBe(true);
  });
  it("http, javascript e caminho relativo em link de texto não passam", () => {
    expect(enderecoValido("http://site.com")).toBe(false);
    expect(enderecoValido("javascript:alert(1)")).toBe(false);
    expect(enderecoValido("/privacidade")).toBe(false);
  });
  it("logo e avatar aceitam caminho do próprio site, mas não //", () => {
    expect(enderecoValido("/logo.png", true)).toBe(true);
    expect(enderecoValido("//outro.com/x.png", true)).toBe(false);
    expect(enderecoValido("data:image/png;base64,AAA", true)).toBe(false);
    expect(enderecoValido("http://127.0.0.1:54421/storage/v1/object/public/formularios/x.png", true)).toBe(true);
    expect(enderecoValido("http://127.0.0.1:54421/x.png")).toBe(false);
    expect(enderecoValido("http://localhost.evil.com/x.png", true)).toBe(false);
  });
  it("conferirEnderecos devolve a mensagem quando algum falha", () => {
    expect(conferirEnderecos(vazio)).toBeNull();
    expect(conferirEnderecos({ ...vazio, logo_url: "/logo.svg", termos_url: "https://x.com/t" })).toBeNull();
    expect(conferirEnderecos({ ...vazio, privacidade_url: "javascript:alert(1)" })).toBe(ERRO_ENDERECO);
    expect(conferirEnderecos({ ...vazio, avatar_url: "http://x.com/a.png" })).toBe(ERRO_ENDERECO);
  });
});
