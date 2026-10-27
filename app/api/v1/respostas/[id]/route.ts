import { verResposta } from "@/src/lib/api/consultas";
import { comChave, json, UUID } from "@/src/lib/api/resposta";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return comChave(req, async () => {
    if (!UUID.test(id)) return json({ erro: "id inválido." }, 400);
    const r = await verResposta(id);
    return r ? json({ resposta: r }) : json({ erro: "Não encontrado." }, 404);
  });
}
