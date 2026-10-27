export type VarObrigatoria = "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY" | "SUPABASE_SERVICE_ROLE_KEY";

export function envOpcional(nome: string): string | undefined {
  const v = process.env[nome];
  return v ? v : undefined;
}

export function env(nome: VarObrigatoria): string {
  const v = envOpcional(nome);
  if (!v) throw new Error(`Variável de ambiente ausente: ${nome}`);
  return v;
}

/** Endereço público desta cópia (ex.: https://formularios.suaempresa.com.br), sem barra no fim. Cai no endereço da
 *  requisição quando não existe (dev). */
export function siteUrl(fallback = ""): string {
  return (envOpcional("NEXT_PUBLIC_SITE_URL") ?? fallback).replace(/\/$/, "");
}
