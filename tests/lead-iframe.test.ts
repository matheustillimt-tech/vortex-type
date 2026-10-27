import { describe, expect, it } from "vitest";
import { deveDispararLead, mesclar } from "@/src/lib/formulario/padroes";
import { codigoIframe } from "@/src/lib/formulario/incorporar";

const base = { cores: {}, textos: {} };

describe("Lead pra quem fica sem perfil", () => {
  it("sem configuração, dispara pra todo mundo (comportamento antigo)", () => {
    const { pixels } = mesclar({ ...base, pixels: {} });
    expect(pixels.leadSemPerfil).toBe(true);
    expect(deveDispararLead(pixels, true)).toBe(true);
    expect(deveDispararLead(pixels, false)).toBe(true);
  });
  it("desligado, só dispara pra quem tem perfil", () => {
    const { pixels } = mesclar({ ...base, pixels: { leadSemPerfil: false } });
    expect(deveDispararLead(pixels, true)).toBe(false);
    expect(deveDispararLead(pixels, false)).toBe(true);
  });
});

describe("codigoIframe", () => {
  it("monta o iframe com o link do formulário", () => {
    expect(codigoIframe("https://formularios.exemplo.com/aplicacao")).toBe(
      '<iframe src="https://formularios.exemplo.com/aplicacao" title="Formulário" style="width:100%;height:640px;border:0;border-radius:12px" loading="lazy"></iframe>',
    );
  });
  it("escapa aspas e sinais do link", () => {
    expect(codigoIframe('https://x.com/a"b<c')).toContain('src="https://x.com/a&quot;b&lt;c"');
  });
});
