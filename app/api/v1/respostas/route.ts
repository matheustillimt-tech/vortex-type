import { listarRespostas } from "@/src/lib/api/consultas";
import { lerFiltro } from "@/src/lib/api/parametros";
import { comChave, json } from "@/src/lib/api/resposta";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return comChave(req, async () => {
    const f = lerFiltro(Object.fromEntries(new URL(req.url).searchParams));
    if (!f.ok) return json({ erro: f.erro }, 400);
    return json(await listarRespostas(f.filtro));
  });
}
