import { headers } from "next/headers";
import { siteUrl } from "@/src/lib/env";
import { dbAdmin } from "@/src/lib/supabase/admin";
import { bloqueio } from "../../_componentes/guarda";
import { ListaChaves, type ChaveListada } from "./lista";

export const dynamic = "force-dynamic";

export default async function ApiMcp() {
  const b = await bloqueio("integracoes");
  if (b) return b;
  const h = await headers();
  const base = siteUrl(h.get("host") ? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}` : "");
  const { data } = await dbAdmin().from("chaves_api").select("id, nome, permissao, prefixo, ultimo_uso, revogada_em, criado_em").order("criado_em", { ascending: false });
  return <ListaChaves chaves={(data ?? []) as ChaveListada[]} base={base} />;
}
