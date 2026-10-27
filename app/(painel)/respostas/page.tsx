import { Suspense } from "react";
import { bloqueio } from "../_componentes/guarda";
import { Loading } from "../_formularios/ui";
import { ListaRespostas } from "./lista";

export default async function Respostas() {
  const b = await bloqueio("respostas");
  if (b) return b;
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">
      <Suspense fallback={<Loading />}>
        <ListaRespostas />
      </Suspense>
    </div>
  );
}
