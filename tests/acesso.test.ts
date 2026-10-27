import { describe, expect, it } from "vitest";
import { areaDoCaminho, ehUuid, pode, validarNovaSenha, verificarMudancaPapel, verificarRemocao } from "@/src/lib/regras/acesso";

describe("pode", () => {
  it("admin vê tudo", () => {
    for (const a of ["inicio", "formularios", "respostas", "integracoes", "equipe", "configuracoes"] as const) expect(pode("admin", a)).toBe(true);
  });
  it("membro vê Início, Formulários e Respostas", () => {
    expect(pode("membro", "inicio")).toBe(true);
    expect(pode("membro", "formularios")).toBe(true);
    expect(pode("membro", "respostas")).toBe(true);
    expect(pode("membro", "integracoes")).toBe(false);
    expect(pode("membro", "equipe")).toBe(false);
    expect(pode("membro", "configuracoes")).toBe(false);
  });
  it("sem linha em membros não vê nada", () => {
    expect(pode(null, "inicio")).toBe(false);
  });
});

describe("areaDoCaminho", () => {
  it("mapeia pelo primeiro trecho", () => {
    expect(areaDoCaminho("/")).toBe("inicio");
    expect(areaDoCaminho("/formularios/abc")).toBe("formularios");
    expect(areaDoCaminho("/equipe")).toBe("equipe");
    expect(areaDoCaminho("/qualquer")).toBeNull();
  });
});

describe("travas da equipe", () => {
  it("não rebaixa o último admin", () => {
    expect(verificarMudancaPapel({ admins: ["a"], alvo: "a", novoPapel: "membro", eu: "a" })).toBe("Precisa ficar pelo menos um Administrador.");
    expect(verificarMudancaPapel({ admins: ["a", "b"], alvo: "a", novoPapel: "membro", eu: "b" })).toBeNull();
    expect(verificarMudancaPapel({ admins: ["a"], alvo: "c", novoPapel: "admin", eu: "a" })).toBeNull();
  });
  it("ninguém remove a si mesmo nem o último admin", () => {
    expect(verificarRemocao({ admins: ["a", "b"], alvo: "a", eu: "a" })).toBe("Você não pode remover o próprio acesso.");
    expect(verificarRemocao({ admins: ["a"], alvo: "a", eu: "b" })).toBe("Precisa ficar pelo menos um Administrador.");
    expect(verificarRemocao({ admins: ["a"], alvo: "c", eu: "a" })).toBeNull();
  });
});

describe("ehUuid e validarNovaSenha", () => {
  it("reconhece uuid", () => {
    expect(ehUuid("2f1c9a4e-1b2c-4d3e-8f90-123456789abc")).toBe(true);
    expect(ehUuid("x")).toBe(false);
  });
  it("senha nova: mínimo 8 e confirmação igual", () => {
    expect(validarNovaSenha("1234567", "1234567")).toBe("A senha precisa ter pelo menos 8 caracteres.");
    expect(validarNovaSenha("12345678", "12345679")).toBe("As senhas não conferem.");
    expect(validarNovaSenha("12345678", "12345678")).toBeNull();
  });
});
