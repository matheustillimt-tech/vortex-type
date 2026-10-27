import { listarFormularios } from "@/src/lib/api/consultas";
import { comChave, json } from "@/src/lib/api/resposta";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return comChave(req, async () => json({ formularios: await listarFormularios() }));
}
