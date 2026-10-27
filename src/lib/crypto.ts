import "server-only";
import { randomInt } from "node:crypto";

const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** Senha aleatória (letras e dígitos) com sorteio criptográfico sem viés. */
export function senhaAleatoria(tamanho = 16): string {
  return Array.from({ length: tamanho }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");
}
