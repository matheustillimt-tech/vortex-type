import { describe, expect, it } from "vitest";
import { ehHostDoSistema, hostValido, normalizarHost, registroDns, rotaNoDominioDoCliente, usarRoteamentoDeDominio } from "@/src/lib/regras/dominio";

describe("normalizarHost / hostValido", () => {
  it("tira protocolo, caminho, porta e ponto final", () => {
    expect(normalizarHost(" https://Aplicacao.Cliente.com.br:443/x?y ")).toBe("aplicacao.cliente.com.br");
    expect(normalizarHost("cliente.com.")).toBe("cliente.com");
  });
  it("só domínio de verdade", () => {
    expect(hostValido("aplicacao.cliente.com")).toBe(true);
    for (const h of ["localhost", "cliente", "-a.com", "a_b.com", "127.0.0.1", "formularios.exemplo.com.vercel.app"]) expect(hostValido(h)).toBe(false);
  });
});

describe("ehHostDoSistema", () => {
  it("o próprio endereço, vercel.app e local são do sistema", () => {
    for (const h of ["formularios.exemplo.com", "meu-projeto.vercel.app", "meu-projeto-abc-time.vercel.app", "localhost:3007", "127.0.0.1:3007"]) expect(ehHostDoSistema(h, "formularios.exemplo.com")).toBe(true);
    expect(ehHostDoSistema("aplicacao.cliente.com", "formularios.exemplo.com")).toBe(false);
  });
  it("ponto final no host não escapa (DNS ignora o ponto)", () => {
    expect(ehHostDoSistema("formularios.exemplo.com.", "formularios.exemplo.com")).toBe(true);
    expect(ehHostDoSistema("formularios.exemplo.com.:443", "formularios.exemplo.com")).toBe(true);
    expect(usarRoteamentoDeDominio("formularios.exemplo.com.", "formularios.exemplo.com")).toBe(false);
  });
});

describe("usarRoteamentoDeDominio", () => {
  it("sem endereço principal, nunca roteia (painel não derruba)", () => {
    expect(usarRoteamentoDeDominio("aplicacao.cliente.com", null)).toBe(false);
    expect(usarRoteamentoDeDominio("qualquer.coisa", null)).toBe(false);
  });
  it("com endereço principal, só roteia quem não é do sistema", () => {
    expect(usarRoteamentoDeDominio("formularios.exemplo.com", "formularios.exemplo.com")).toBe(false);
    expect(usarRoteamentoDeDominio("localhost:3007", "formularios.exemplo.com")).toBe(false);
    expect(usarRoteamentoDeDominio("aplicacao.cliente.com", "formularios.exemplo.com")).toBe(true);
  });
});

describe("rotaNoDominioDoCliente", () => {
  it("raiz vira o formulário; assets e API passam; painel não abre", () => {
    expect(rotaNoDominioDoCliente("/", "aplicacao")).toBe("reescrever");
    expect(rotaNoDominioDoCliente("/aplicacao", "aplicacao")).toBe("passar");
    expect(rotaNoDominioDoCliente("/_next/static/x.js", "aplicacao")).toBe("passar");
    expect(rotaNoDominioDoCliente("/icon.svg", "aplicacao")).toBe("passar");
    for (const p of ["/login", "/formularios", "/equipe", "/api/v1/respostas", "/outro-form"]) expect(rotaNoDominioDoCliente(p, "aplicacao")).toBe("404");
  });
});

describe("registroDns", () => {
  it("subdomínio usa CNAME; domínio raiz usa A", () => {
    expect(registroDns("aplicacao.cliente.com")).toEqual({ tipo: "CNAME", nome: "aplicacao", valor: "cname.vercel-dns.com" });
    expect(registroDns("cliente.com")).toEqual({ tipo: "A", nome: "@", valor: "76.76.21.21" });
    expect(registroDns("cliente.com.br")).toEqual({ tipo: "A", nome: "@", valor: "76.76.21.21" });
    expect(registroDns("form.cliente.com.br")).toEqual({ tipo: "CNAME", nome: "form", valor: "cname.vercel-dns.com" });
  });
});
