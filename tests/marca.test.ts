import { describe, expect, it } from "vitest";
import { arquivoMarcaValido, COR_PADRAO, extensaoDoTipo, marcaDaLinha, NOME_PADRAO, tipoDoArquivo, validarMarca, variaveisDaCor } from "@/src/lib/regras/marca";

describe("marcaDaLinha", () => {
  it("sem linha volta o padrão", () => {
    expect(marcaDaLinha(null)).toEqual({ nome: NOME_PADRAO, logoUrl: null, faviconUrl: null, cor: COR_PADRAO });
  });
  it("usa os valores da linha", () => {
    expect(marcaDaLinha({ nome_sistema: "Cliente Forms", logo_url: "https://x/l.png", favicon_url: null, cor_principal: "#ff0000" })).toEqual({
      nome: "Cliente Forms",
      logoUrl: "https://x/l.png",
      faviconUrl: null,
      cor: "#ff0000",
    });
  });
  it("cor inválida no banco cai no padrão", () => {
    expect(marcaDaLinha({ nome_sistema: "", logo_url: null, favicon_url: null, cor_principal: "vermelho" })).toMatchObject({ nome: NOME_PADRAO, cor: COR_PADRAO });
  });
});

describe("validarMarca", () => {
  it("nome obrigatório, até 40", () => {
    expect(validarMarca({ nome: "  ", cor: "#000000" })).toEqual({ ok: false, erro: "O nome do sistema é obrigatório." });
    expect(validarMarca({ nome: "x".repeat(41), cor: "#000000" })).toEqual({ ok: false, erro: "O nome do sistema tem no máximo 40 caracteres." });
  });
  it("cor em #rrggbb, normalizada em minúsculas", () => {
    expect(validarMarca({ nome: "A", cor: "red" })).toEqual({ ok: false, erro: "Cor inválida. Use o formato #RRGGBB." });
    expect(validarMarca({ nome: " A ", cor: "#ABCDEF" })).toEqual({ ok: true, nome: "A", cor: "#abcdef" });
  });
});

describe("variaveisDaCor", () => {
  it("cor padrão não sobrescreve nada", () => {
    expect(variaveisDaCor(COR_PADRAO)).toEqual({});
  });
  it("outra cor vira as variáveis do tema", () => {
    expect(variaveisDaCor("#3366ff")).toEqual({
      "--color-vt-accent": "#3366ff",
      "--color-vt-accent-2": "#3366ff",
      "--color-vt-accent-3": "color-mix(in srgb, #3366ff 45%, white)",
      "--color-vt-link": "color-mix(in srgb, #3366ff 45%, white)",
      "--color-vt-primario": "color-mix(in srgb, #3366ff 72%, black)",
      "--color-vt-primario-hover": "color-mix(in srgb, #3366ff 80%, black)",
    });
  });
});

describe("arquivos da marca", () => {
  it("aceita imagem até 1 MB", () => {
    expect(arquivoMarcaValido("image/png", 1024, "logo")).toBeNull();
    expect(arquivoMarcaValido("image/png", 1024 * 1024 + 1, "logo")).toBe("O arquivo tem mais de 1 MB.");
    expect(arquivoMarcaValido("application/pdf", 10, "logo")).toBe("Formato não aceito. Use PNG, JPG, SVG ou WebP.");
  });
  it("favicon aceita .ico; logo não", () => {
    expect(arquivoMarcaValido("image/x-icon", 10, "favicon")).toBeNull();
    expect(arquivoMarcaValido("image/x-icon", 10, "logo")).toBe("Formato não aceito. Use PNG, JPG, SVG ou WebP.");
  });
  it("extensão pelo tipo", () => {
    expect(extensaoDoTipo("image/svg+xml")).toBe("svg");
    expect(extensaoDoTipo("image/jpeg")).toBe("jpg");
    expect(extensaoDoTipo("image/vnd.microsoft.icon")).toBe("ico");
  });
});

describe("tipoDoArquivo", () => {
  it("mantém o tipo quando ele já vem certo", () => {
    expect(tipoDoArquivo("image/png", "logo.png")).toBe("image/png");
    expect(tipoDoArquivo("image/x-icon", "favicon.ico")).toBe("image/x-icon");
  });
  it("tipo vazio (Windows/Safari .ico) cai pra extensão do nome", () => {
    expect(tipoDoArquivo("", "favicon.ico")).toBe("image/x-icon");
    expect(tipoDoArquivo("", "logo.png")).toBe("image/png");
    expect(tipoDoArquivo("", "logo.jpg")).toBe("image/jpeg");
    expect(tipoDoArquivo("", "logo.jpeg")).toBe("image/jpeg");
    expect(tipoDoArquivo("", "logo.svg")).toBe("image/svg+xml");
    expect(tipoDoArquivo("", "logo.webp")).toBe("image/webp");
  });
  it("application/octet-stream genérico também cai pra extensão do nome", () => {
    expect(tipoDoArquivo("application/octet-stream", "favicon.ico")).toBe("image/x-icon");
  });
  it("sem extensão reconhecida, mantém o tipo original (mesmo vazio)", () => {
    expect(tipoDoArquivo("", "arquivo")).toBe("");
    expect(tipoDoArquivo("application/octet-stream", "arquivo.xyz")).toBe("application/octet-stream");
  });
});
