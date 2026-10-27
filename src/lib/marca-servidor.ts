import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { marcaDaLinha, type LinhaConfiguracao, type Marca } from "./regras/marca";
import { dbAdmin } from "./supabase/admin";

/** Tag do cache da marca: `salvarMarca` limpa com `revalidateTag(TAG_MARCA)`. */
export const TAG_MARCA = "marca";

// Cache entre requisições (páginas públicas abrem muito): 5 min ou até a marca ser salva. Erro não entra no cache.
const lerDoBanco = unstable_cache(
  async (): Promise<LinhaConfiguracao | null> => {
    const { data, error } = await dbAdmin().from("configuracao").select("nome_sistema, logo_url, favicon_url, cor_principal").maybeSingle();
    if (error) throw error;
    return (data as LinhaConfiguracao | null) ?? null;
  },
  ["marca"],
  { tags: [TAG_MARCA], revalidate: 300 },
);

/** Uma leitura por requisição. Nunca derruba a página: erro volta a marca padrão. */
export const lerMarca = cache(async (): Promise<Marca> => {
  try {
    return marcaDaLinha(await lerDoBanco());
  } catch (e) {
    console.error("[marca] não foi possível ler a configuração", e);
    return marcaDaLinha(null);
  }
});
