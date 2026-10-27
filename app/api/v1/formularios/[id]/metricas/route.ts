import { metricasFormulario } from "@/src/lib/api/consultas";
import { lerPeriodo } from "@/src/lib/api/parametros";
import { comChave, json, UUID } from "@/src/lib/api/resposta";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return comChave(req, async () => {
    if (!UUID.test(id)) return json({ erro: "id inválido." }, 400);
    const sp = new URL(req.url).searchParams;
    const p = lerPeriodo(sp.get("de") ?? undefined, sp.get("ate") ?? undefined);
    if (!p.ok) return json({ erro: p.erro }, 400);
    const m = await metricasFormulario(id, p.de, p.ate);
    return m ? json(m) : json({ erro: "Não encontrado." }, 404);
  });
}
