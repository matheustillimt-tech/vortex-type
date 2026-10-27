/** Painel × rota pública (formulário). Puro: usado no middleware e na validação de slug. */

export const ROTAS_PAINEL: readonly string[] = ["formularios", "respostas", "integracoes", "equipe", "configuracoes"];

const OUTROS_RESERVADOS: readonly string[] = ["login", "api", "_next"];

export function tipoRota(pathname: string): "painel" | "publica" {
  if (pathname === "/") return "painel";
  const primeiro = pathname.split("/")[1] ?? "";
  return ROTAS_PAINEL.includes(primeiro) ? "painel" : "publica";
}

export function slugReservado(slug: string): boolean {
  const s = slug.trim().toLowerCase();
  return s.startsWith("_") || ROTAS_PAINEL.includes(s) || OUTROS_RESERVADOS.includes(s);
}
