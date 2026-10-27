import { lerMarca } from "@/src/lib/marca-servidor";
import { bloqueio } from "../_componentes/guarda";
import { Pagina } from "../_componentes/ui";
import { FormMarca } from "./form";

export const dynamic = "force-dynamic";

export default async function Configuracoes() {
  const b = await bloqueio("configuracoes");
  if (b) return b;
  const marca = await lerMarca();
  return (
    <Pagina titulo="Configurações" subtitulo="Marca do sistema: o que a sua equipe vê no painel e no login.">
      <FormMarca marca={marca} />
    </Pagina>
  );
}
