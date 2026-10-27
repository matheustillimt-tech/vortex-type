import { createHmac, randomBytes } from "node:crypto";

/** `sha256=` + HMAC-SHA256 (hex) do corpo, com o segredo do webhook (cabeçalho X-Vortex-Type-Assinatura). */
export function assinar(segredo: string, corpo: string): string {
  return "sha256=" + createHmac("sha256", segredo).update(corpo).digest("hex");
}

/** Segredo novo de webhook: `vtw_` + 32 caracteres base64url. */
export function gerarSegredo(): string {
  return "vtw_" + randomBytes(24).toString("base64url");
}
