import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { assinar, gerarSegredo } from "@/src/lib/webhooks/assinatura";
import { enviarEntrega, PRAZO_CRON_MS, processarAteAcabar, processarItens, type ItemFila, type ResultadoEnvio } from "@/src/lib/webhooks/entregar";
import { ipInterno, montarPayload, proximaTentativa, urlWebhookValida } from "@/src/lib/webhooks/regras";
import type { RespostaLinha } from "@/src/lib/formulario/tipos";

const AGORA = new Date("2026-10-23T12:00:00Z");
const RESPOSTA: RespostaLinha = {
  id: "r1", formulario_id: "f1", formulario_slug: "aplicacao", status: "completo", nome: "Ana Souza", whatsapp: "5511900000000", // fictício
  email: "ana@x.com", empresa: "Loja", respostas: [{ slug: "nome", q: "Nome?", a: "Ana Souza", papel: "nome" }],
  utm_source: "ig", utm_medium: null, utm_campaign: "c1", utm_content: null, utm_term: null, origem: {},
  criado_em: "2026-10-23T11:59:00Z", atualizado_em: "2026-10-23T12:00:00Z", concluido_em: "2026-10-23T12:00:00Z",
};

describe("proximaTentativa", () => {
  it("espera 1, 5, 30 e 120 min e desiste na 5ª", () => {
    const min = (n: number) => (proximaTentativa(n, AGORA)!.getTime() - AGORA.getTime()) / 60000;
    expect([min(1), min(2), min(3), min(4)]).toEqual([1, 5, 30, 120]);
    expect(proximaTentativa(5, AGORA)).toBeNull();
  });
});

describe("urlWebhookValida", () => {
  it("aceita https público", () => {
    expect(urlWebhookValida("https://n8n.cliente.com/webhook/abc")).toBeNull();
  });
  it("recusa http, rede interna e lixo", () => {
    for (const u of ["http://cliente.com", "https://localhost/x", "https://127.0.0.1/x", "https://10.0.0.5/x", "https://192.168.1.2/x", "https://172.20.0.1/x", "https://169.254.169.254/x", "https://[::1]/x", "https://algo.internal/x", "nao-e-url", `https://x.com/${"a".repeat(500)}`]) {
      expect(urlWebhookValida(u)).not.toBeNull();
    }
  });
  it("recusa qualquer IP literal, até disfarçado, e aceita nome de domínio", () => {
    for (const u of ["https://[::ffff:169.254.169.254]/x", "https://[::ffff:7f00:1]/x", "https://8.8.8.8/x", "https://2130706433/x"]) {
      expect(urlWebhookValida(u)).not.toBeNull();
    }
    expect(urlWebhookValida("https://hooks.exemplo.com.br/a")).toBeNull();
  });
  it("ponto no fim do host não escapa da checagem (DNS ignora o ponto final)", () => {
    for (const u of ["https://localhost./x", "https://algo.internal./x", "https://127.0.0.1./x"]) {
      expect(urlWebhookValida(u)).not.toBeNull();
    }
    // Nome de domínio público com ponto final é só um detalhe de DNS: continua aceito.
    expect(urlWebhookValida("https://hooks.exemplo.com./x")).toBeNull();
  });
});

describe("montarPayload", () => {
  it("formato do aviso", () => {
    const p = montarPayload(RESPOSTA, { slug: "aplicacao", nome: "Aplicação" }, "https://type.exemplo.com");
    expect(p).toMatchObject({
      evento: "resposta.concluida", id: "r1", formulario: "aplicacao", formularioNome: "Aplicação",
      link: "https://type.exemplo.com/aplicacao", status: "completo", nome: "Ana Souza", primeiroNome: "Ana",
      whatsapp: RESPOSTA.whatsapp, email: "ana@x.com", empresa: "Loja", criadoEm: "2026-10-23T11:59:00Z", concluidoEm: "2026-10-23T12:00:00Z",
      origem: { utm_source: "ig", utm_medium: null, utm_campaign: "c1", utm_content: null, utm_term: null },
    });
    expect(p.respostas).toEqual(RESPOSTA.respostas);
  });
});

describe("assinatura", () => {
  it("sha256= + HMAC hex do corpo", () => {
    expect(assinar("seg", '{"a":1}')).toBe("sha256=" + createHmac("sha256", "seg").update('{"a":1}').digest("hex"));
  });
  it("segredo novo a cada chamada", () => {
    const a = gerarSegredo();
    expect(a).toMatch(/^vtw_[A-Za-z0-9_-]{32}$/);
    expect(gerarSegredo()).not.toBe(a);
  });
});

describe("processarItens", () => {
  const item = (over: Partial<ItemFila> = {}): ItemFila => ({
    id: 1, tentativas: 0, teste: false, evento: "resposta.concluida",
    webhook: { url: "https://a.com/x", segredo: "s", ativo: true },
    resposta: { ...RESPOSTA, formularios: { slug: "aplicacao", nome: "Aplicação" } }, ...over,
  });

  async function rodar(itens: ItemFila[], resultado: ResultadoEnvio) {
    const patches: Record<number, Record<string, unknown>> = {};
    const corpos: string[] = [];
    const r = await processarItens(itens, {
      enviar: async (e) => { corpos.push(e.corpo); return resultado; },
      atualizar: async (id, patch) => { patches[id] = patch; },
      siteUrl: "https://type.exemplo.com",
      agora: () => AGORA,
    });
    return { r, patches, corpos };
  }

  it("sucesso marca enviado", async () => {
    const { r, patches, corpos } = await rodar([item()], { ok: true, status: 200, erro: null });
    expect(r).toEqual({ enviadas: 1, falhas: 0 });
    expect(patches[1]).toMatchObject({ status: "enviado", tentativas: 1, ultimo_status: 200, ultimo_erro: null });
    expect(JSON.parse(corpos[0]).nome).toBe("Ana Souza");
  });
  it("falha agenda a próxima tentativa", async () => {
    const { patches } = await rodar([item()], { ok: false, status: 500, erro: "HTTP 500" });
    expect(patches[1]).toMatchObject({ status: "pendente", tentativas: 1, ultimo_status: 500, ultimo_erro: "HTTP 500", proxima_em: "2026-10-23T12:01:00.000Z" });
  });
  it("5ª falha desiste", async () => {
    const { patches } = await rodar([item({ tentativas: 4 })], { ok: false, status: null, erro: "tempo esgotado" });
    expect(patches[1]).toMatchObject({ status: "falhou", tentativas: 5 });
  });
  it("webhook com URL que não passa mais na validação não envia", async () => {
    const { r, patches, corpos } = await rodar([item({ webhook: { url: "https://8.8.8.8/x", segredo: "s", ativo: true } })], { ok: true, status: 200, erro: null });
    expect(corpos).toHaveLength(0);
    expect(r.falhas).toBe(1);
    expect(patches[1]).toMatchObject({ status: "falhou", ultimo_erro: "Use o endereço com nome de domínio (não um IP)." });
  });
  it("webhook desligado ou apagado não envia", async () => {
    const { r, patches, corpos } = await rodar([item({ webhook: { url: "https://a.com", segredo: "s", ativo: false } })], { ok: true, status: 200, erro: null });
    expect(corpos).toHaveLength(0);
    expect(r.falhas).toBe(1);
    expect(patches[1]).toMatchObject({ status: "falhou", ultimo_erro: "Webhook desligado." });
  });
  it("teste que falha não tenta de novo", async () => {
    const { patches } = await rodar([item({ teste: true, resposta: null })], { ok: false, status: 500, erro: "HTTP 500" });
    expect(patches[1]).toMatchObject({ status: "falhou", tentativas: 1 });
  });
  it("falha definitiva (DNS pra rede interna) não tenta de novo", async () => {
    const { patches } = await rodar([item()], { ok: false, status: null, erro: "O endereço aponta pra rede interna.", definitivo: true });
    expect(patches[1]).toMatchObject({ status: "falhou", tentativas: 1, ultimo_erro: "O endereço aponta pra rede interna." });
  });
  it("teste manda o payload de exemplo", async () => {
    const { corpos } = await rodar([item({ teste: true, resposta: null })], { ok: true, status: 200, erro: null });
    expect(JSON.parse(corpos[0])).toMatchObject({ evento: "resposta.concluida", teste: true });
  });
});

describe("ipInterno", () => {
  it("rede interna em IPv4 e IPv6", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.0.10", "169.254.169.254", "100.64.0.1", "100.127.255.255", "0.0.0.0", "224.0.0.1",
      "::1", "::", "fd00::1", "fc12:3456::9", "fe80::1", "FE80::abcd%en0", "ff02::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:10.0.0.1", "::ffff:169.254.169.254", "[::1]"]) {
      expect(ipInterno(ip), ip).toBe(true);
    }
  });
  it("IP público e texto que não é IP", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "100.63.255.255", "100.128.0.1", "172.32.0.1", "2001:4860:4860::8888", "::ffff:8.8.8.8", "2606:4700::1111", "exemplo.com", "", "999.1.1.1", "1::2::3"]) {
      expect(ipInterno(ip), ip).toBe(false);
    }
  });
});

describe("enviarEntrega confere o DNS antes", () => {
  const envio = { url: "https://hooks.exemplo.com/x", segredo: "s", corpo: "{}", entregaId: 1, evento: "resposta.concluida" };
  const fetchOk = (chamadas: string[]) => (async (u: string) => { chamadas.push(u); return new Response(null, { status: 204 }); }) as unknown as typeof fetch;

  it("nome que aponta pra rede interna não é enviado (falha definitiva)", async () => {
    const chamadas: string[] = [];
    const r = await enviarEntrega(envio, fetchOk(chamadas), async () => ["93.184.216.34", "::ffff:127.0.0.1"]);
    expect(r).toEqual({ ok: false, status: null, erro: "O endereço aponta pra rede interna.", definitivo: true });
    expect(chamadas).toHaveLength(0);
  });
  it("DNS que falha vira falha comum (tenta de novo)", async () => {
    const chamadas: string[] = [];
    const r = await enviarEntrega(envio, fetchOk(chamadas), async () => { throw new Error("ENOTFOUND"); });
    expect(r).toEqual({ ok: false, status: null, erro: "Não deu para encontrar o endereço." });
    expect(chamadas).toHaveLength(0);
  });
  it("nome público envia, sem o ponto final na consulta", async () => {
    const chamadas: string[] = [];
    const hosts: string[] = [];
    const r = await enviarEntrega({ ...envio, url: "https://hooks.exemplo.com./x" }, fetchOk(chamadas), async (h) => { hosts.push(h); return ["93.184.216.34"]; });
    expect(r).toEqual({ ok: true, status: 204, erro: null });
    expect(hosts).toEqual(["hooks.exemplo.com"]);
    expect(chamadas).toHaveLength(1);
  });
});

describe("processarAteAcabar", () => {
  const itens = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i } as unknown as ItemFila));

  it("reserva de novo até a fila vir vazia e soma os totais", async () => {
    const lotes = [itens(25), itens(25), itens(3), []];
    let reservas = 0;
    const r = await processarAteAcabar(async () => lotes[reservas++], async (l) => ({ enviadas: l.length - 1, falhas: 1 }), () => 0, 45_000);
    expect(r).toEqual({ enviadas: 50, falhas: 3, rodadas: 3 });
    expect(reservas).toBe(4);
  });
  it("para de reservar depois do prazo (o que já reservou é enviado)", async () => {
    let t = 0;
    let reservas = 0;
    const r = await processarAteAcabar(
      async () => { reservas++; return itens(25); },
      async (l) => { t += 20_000; return { enviadas: l.length, falhas: 0 }; },
      () => t,
      45_000,
    );
    // 0 s, 20 s e 40 s reservam; aos 60 s já passou de 45 s.
    expect(reservas).toBe(3);
    expect(r).toEqual({ enviadas: 75, falhas: 0, rodadas: 3 });
  });
  it("prazo padrão: não reserva depois de 30 s (pior caso 30 + 24 s cabe nos 60 s da rota)", async () => {
    expect(PRAZO_CRON_MS).toBe(30_000);
    let t = 0;
    let reservas = 0;
    await processarAteAcabar(
      async () => { reservas++; return itens(25); },
      async () => { t += 15_000; return { enviadas: 25, falhas: 0 }; },
      () => t,
    );
    // 0 s e 15 s reservam; aos 30 s já não.
    expect(reservas).toBe(2);
  });
  it("fila vazia: uma reserva e nada mais", async () => {
    let reservas = 0;
    const r = await processarAteAcabar(async () => { reservas++; return []; }, async () => ({ enviadas: 0, falhas: 0 }), () => 0);
    expect(r).toEqual({ enviadas: 0, falhas: 0, rodadas: 0 });
    expect(reservas).toBe(1);
  });
});
