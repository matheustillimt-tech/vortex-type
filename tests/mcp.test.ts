import { describe, expect, it } from "vitest";
import { tratarMensagem } from "@/src/lib/mcp/servidor";
import type { Ferramenta } from "@/src/lib/mcp/ferramentas";

const CHAVE_LEITURA = { id: "k", nome: "teste", permissao: "leitura" as const, usuarioId: "u" };
const ECO: Ferramenta = {
  name: "eco", title: "Eco", description: "devolve o texto", escrita: false, annotations: {},
  inputSchema: { type: "object", properties: { t: { type: "string" } } },
  executar: async (_c, a) => ({ content: [{ type: "text", text: String(a.t) }] }),
};
const MUDA: Ferramenta = { ...ECO, name: "muda", escrita: true };

describe("servidor MCP", () => {
  it("initialize devolve o nome e a versão pedida", async () => {
    const r = (await tratarMensagem({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } }, CHAVE_LEITURA, [ECO])) as { result: { protocolVersion: string; serverInfo: { name: string } } };
    expect(r.result.protocolVersion).toBe("2025-03-26");
    expect(r.result.serverInfo.name).toBe("Vórtex Type");
  });
  it("tools/list e tools/call", async () => {
    const lista = (await tratarMensagem({ jsonrpc: "2.0", id: 2, method: "tools/list" }, CHAVE_LEITURA, [ECO])) as { result: { tools: { name: string }[] } };
    expect(lista.result.tools.map((t) => t.name)).toEqual(["eco"]);
    const r = (await tratarMensagem({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "eco", arguments: { t: "oi" } } }, CHAVE_LEITURA, [ECO])) as { result: { content: { text: string }[] } };
    expect(r.result.content[0].text).toBe("oi");
  });
  it("chave de leitura não roda ferramenta de escrita", async () => {
    const r = (await tratarMensagem({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "muda", arguments: {} } }, CHAVE_LEITURA, [MUDA])) as { result: { isError: boolean; content: { text: string }[] } };
    expect(r.result.isError).toBe(true);
    expect(r.result.content[0].text).toBe("Esta chave só tem permissão de leitura.");
  });
  it("notificação não responde; método desconhecido dá erro", async () => {
    expect(await tratarMensagem({ jsonrpc: "2.0", method: "notifications/initialized" }, CHAVE_LEITURA, [ECO])).toBeNull();
    const r = (await tratarMensagem({ jsonrpc: "2.0", id: 5, method: "nada" }, CHAVE_LEITURA, [ECO])) as { error: { code: number } };
    expect(r.error.code).toBe(-32601);
  });
});
