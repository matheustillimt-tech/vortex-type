import { bloqueio } from "../../_componentes/guarda";
import { Editor } from "./editor";

export default async function EditarFormulario({ params }: { params: Promise<{ id: string }> }) {
  const b = await bloqueio("formularios");
  if (b) return b;
  const { id } = await params;
  return (
    <div className="px-4 py-6 md:px-8">
      <Editor id={id} />
    </div>
  );
}
