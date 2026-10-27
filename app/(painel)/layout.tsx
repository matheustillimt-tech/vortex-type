import { lerMarca } from "@/src/lib/marca-servidor";
import { membroAtual } from "@/src/lib/permissoes";
import { Moldura } from "./_componentes/moldura";

export const dynamic = "force-dynamic";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const [{ usuario, membro }, marca] = await Promise.all([membroAtual(), lerMarca()]);
  return (
    <div className="min-h-screen md:flex">
      <Moldura marca={marca} nome={membro?.nome ?? ""} email={usuario.email ?? ""} papel={membro?.papel ?? null}>
        {children}
      </Moldura>
    </div>
  );
}
