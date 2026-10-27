import "server-only";
import { membroAtual } from "@/src/lib/permissoes";
import { pode, type Area } from "@/src/lib/regras/acesso";
import { SemAcesso } from "./sem-acesso";

/** Guarda por página (o layout não renderiza de novo entre páginas filhas). No topo da página:
 *  `const b = await bloqueio("equipe"); if (b) return b;` */
export async function bloqueio(area: Area): Promise<React.ReactNode | null> {
  const { membro } = await membroAtual();
  return pode(membro?.papel ?? null, area) ? null : <SemAcesso />;
}
