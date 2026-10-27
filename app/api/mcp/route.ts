import { metodoNaoPermitido, tratarPostMcp } from "@/src/lib/mcp/servidor";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** POST /api/mcp — servidor MCP do Vórtex Type (Streamable HTTP sem estado, respostas JSON). */
export function POST(req: Request) {
  return tratarPostMcp(req);
}

export function GET() {
  return metodoNaoPermitido();
}

export function DELETE() {
  return metodoNaoPermitido();
}
