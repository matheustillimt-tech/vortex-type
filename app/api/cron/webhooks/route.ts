import { timingSafeEqual } from "node:crypto";
import { envOpcional, siteUrl } from "@/src/lib/env";
import { limparEntregasAntigas, processarFila } from "@/src/lib/webhooks/entregar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function autorizado(header: string | null): boolean {
  const segredo = envOpcional("CRON_SECRET");
  if (!segredo || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${segredo}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** GET /api/cron/webhooks — chamado pela Vercel a cada minuto (vercel.json). */
export async function GET(req: Request) {
  if (!autorizado(req.headers.get("authorization"))) return new Response(null, { status: 401 });
  try {
    const r = await processarFila(siteUrl(new URL(req.url).origin));
    await limparEntregasAntigas().catch((e) => console.error("[cron webhooks] limpeza", e));
    return Response.json(r, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("[cron webhooks]", e);
    return Response.json({ erro: "falhou" }, { status: 500 });
  }
}
