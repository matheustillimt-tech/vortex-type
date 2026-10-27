import { bloqueio } from "./_componentes/guarda";
import { Inicio } from "./inicio";

export default async function PaginaInicio() {
  const b = await bloqueio("inicio");
  if (b) return b;
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8">
      <Inicio />
    </div>
  );
}
