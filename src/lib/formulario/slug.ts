import { slugReservado } from "../regras/rotas";

/** Endereço público de um formulário (`/{slug}`). Erro em português ou `null` se serve. */
export function validarSlug(slug: string): string | null {
  if (!/^[a-z0-9][a-z0-9-]{1,59}$/.test(slug)) return "Endereço inválido: use letras minúsculas, números e hífen (2 a 60 caracteres).";
  if (slugReservado(slug)) return "Esse endereço é usado pelo sistema. Escolha outro.";
  return null;
}
