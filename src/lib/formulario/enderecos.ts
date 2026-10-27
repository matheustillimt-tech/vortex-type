/** Links do formulário (privacidade, termos, logo, avatar). Puro. */
import type { Formulario } from "./tipos";

export const ERRO_ENDERECO = "Use um endereço que comece com https://.";

/**
 * Vazio ou https://. Logo e avatar (`imagem`) também aceitam caminho do próprio site (`/…`, não `//…`)
 * e o http://localhost / 127.0.0.1 do Supabase local (é o que o upload devolve em desenvolvimento).
 */
export function enderecoValido(v: string | null | undefined, imagem = false): boolean {
  const t = (v ?? "").trim();
  if (!t) return true;
  if (/\s/.test(t)) return false;
  if (/^https:\/\/./i.test(t)) return true;
  if (!imagem) return false;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(t)) return true;
  return t.startsWith("/") && !t.startsWith("//");
}

/** Mensagem de erro se algum link estiver fora do padrão; null se está tudo certo. */
export function conferirEnderecos(f: Pick<Formulario, "privacidade_url" | "termos_url" | "logo_url" | "avatar_url">): string | null {
  const ok =
    enderecoValido(f.privacidade_url) && enderecoValido(f.termos_url) && enderecoValido(f.logo_url, true) && enderecoValido(f.avatar_url, true);
  return ok ? null : ERRO_ENDERECO;
}
