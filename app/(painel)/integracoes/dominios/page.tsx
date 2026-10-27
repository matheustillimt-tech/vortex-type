import { dbAdmin } from "@/src/lib/supabase/admin";
import { vercelConfigurada } from "@/src/lib/vercel/dominios";
import { bloqueio } from "../../_componentes/guarda";
import { ListaDominios, type DominioListado } from "./lista";

export const dynamic = "force-dynamic";

export default async function Dominios() {
  const b = await bloqueio("integracoes");
  if (b) return b;
  const db = dbAdmin();
  const [{ data: dominios }, { data: formularios }] = await Promise.all([
    db.from("dominios").select("id, host, formulario_id, status, verificado_em, criado_em").order("criado_em"),
    db.from("formularios").select("id, nome, slug").order("criado_em"),
  ]);
  return <ListaDominios ligado={vercelConfigurada()} dominios={(dominios ?? []) as DominioListado[]} formularios={(formularios ?? []) as { id: string; nome: string; slug: string }[]} />;
}
