import { describe, expect, it } from "vitest";
import { itensVisiveis, menuAtivo } from "@/src/lib/regras/menu";

describe("menu", () => {
  it("admin vê os seis itens na ordem", () => {
    expect(itensVisiveis("admin").map((i) => i.rotulo)).toEqual(["Início", "Formulários", "Respostas", "Integrações", "Equipe", "Configurações"]);
  });
  it("membro vê três", () => {
    expect(itensVisiveis("membro").map((i) => i.rotulo)).toEqual(["Início", "Formulários", "Respostas"]);
  });
  it("sem papel não vê nada", () => {
    expect(itensVisiveis(null)).toEqual([]);
  });
  it("Início só acende na raiz; os outros acendem nas subpáginas", () => {
    const inicio = { href: "/", rotulo: "Início", icone: "home" };
    const forms = { href: "/formularios", rotulo: "Formulários", icone: "forum" };
    expect(menuAtivo(inicio, "/")).toBe(true);
    expect(menuAtivo(inicio, "/formularios")).toBe(false);
    expect(menuAtivo(forms, "/formularios/abc")).toBe(true);
    expect(menuAtivo(forms, "/formularios-x")).toBe(false);
  });
});
