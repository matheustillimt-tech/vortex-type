/** Marca de cada cópia (uma por cliente): nome, logo, favicon e cor. Puro. */

export const COR_PADRAO = "#0fa968";
export const NOME_PADRAO = "Vórtex Type";
const LIMITE_ARQUIVO = 1024 * 1024;

export type Marca = { nome: string; logoUrl: string | null; faviconUrl: string | null; cor: string };
export type LinhaConfiguracao = { nome_sistema: string | null; logo_url: string | null; favicon_url: string | null; cor_principal: string | null };

const COR = /^#[0-9a-f]{6}$/i;

export function marcaDaLinha(linha: LinhaConfiguracao | null): Marca {
  const nome = linha?.nome_sistema?.trim();
  const cor = linha?.cor_principal && COR.test(linha.cor_principal) ? linha.cor_principal.toLowerCase() : COR_PADRAO;
  return { nome: nome || NOME_PADRAO, logoUrl: linha?.logo_url ?? null, faviconUrl: linha?.favicon_url ?? null, cor };
}

export function validarMarca(entrada: { nome: string; cor: string }): { ok: true; nome: string; cor: string } | { ok: false; erro: string } {
  const nome = entrada.nome.trim();
  if (!nome) return { ok: false, erro: "O nome do sistema é obrigatório." };
  if (nome.length > 40) return { ok: false, erro: "O nome do sistema tem no máximo 40 caracteres." };
  const cor = entrada.cor.trim();
  if (!COR.test(cor)) return { ok: false, erro: "Cor inválida. Use o formato #RRGGBB." };
  return { ok: true, nome, cor: cor.toLowerCase() };
}

/** Sobrescreve o destaque e o botão principal do tema (`app/globals.css`) no `<html>`. A cor padrão não muda nada. */
export function variaveisDaCor(cor: string): Record<string, string> {
  if (cor.toLowerCase() === COR_PADRAO) return {};
  const clara = `color-mix(in srgb, ${cor} 45%, white)`;
  return {
    "--color-vt-accent": cor,
    "--color-vt-accent-2": cor,
    "--color-vt-accent-3": clara,
    "--color-vt-link": clara,
    "--color-vt-primario": `color-mix(in srgb, ${cor} 72%, black)`,
    "--color-vt-primario-hover": `color-mix(in srgb, ${cor} 80%, black)`,
  };
}

const TIPOS_LOGO = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
const TIPOS_FAVICON = [...TIPOS_LOGO, "image/x-icon", "image/vnd.microsoft.icon"];

export function arquivoMarcaValido(tipo: string, tamanho: number, campo: "logo" | "favicon"): string | null {
  const aceitos = campo === "logo" ? TIPOS_LOGO : TIPOS_FAVICON;
  if (!aceitos.includes(tipo)) return campo === "logo" ? "Formato não aceito. Use PNG, JPG, SVG ou WebP." : "Formato não aceito. Use PNG, JPG, SVG, WebP ou ICO.";
  if (tamanho > LIMITE_ARQUIVO) return "O arquivo tem mais de 1 MB.";
  return null;
}

const TIPO_DA_EXTENSAO: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
  webp: "image/webp",
  ico: "image/x-icon",
};

/** Alguns navegadores (Windows/Safari) mandam o favicon/logo .ico sem MIME, ou genérico `application/octet-stream`.
 *  Nesses casos, adivinha o tipo pela extensão do nome do arquivo; senão mantém o que veio. */
export function tipoDoArquivo(tipo: string, nome: string): string {
  if (tipo && tipo !== "application/octet-stream") return tipo;
  const extensao = nome.split(".").pop()?.toLowerCase() ?? "";
  return TIPO_DA_EXTENSAO[extensao] ?? tipo;
}

export function extensaoDoTipo(tipo: string): string {
  const mapa: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/svg+xml": "svg",
    "image/webp": "webp",
    "image/x-icon": "ico",
    "image/vnd.microsoft.icon": "ico",
  };
  return mapa[tipo] ?? "bin";
}
