import { bloqueio } from "../_componentes/guarda";
import { ListaFormularios } from "./lista";

export default async function Formularios() {
  const b = await bloqueio("formularios");
  if (b) return b;
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8">
      <ListaFormularios />
    </div>
  );
}
