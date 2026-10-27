import { describe, expect, it } from "vitest";
import { montarListaMembros } from "@/app/(painel)/equipe/comum";

describe("montarListaMembros", () => {
  it("junta auth com membros, admins primeiro e por nome", () => {
    const lista = montarListaMembros(
      [
        { id: "1", email: "zeca@x.com", last_sign_in_at: null },
        { id: "2", email: "ana@x.com", last_sign_in_at: "2026-10-22T10:00:00Z" },
        { id: "3", email: "bia@x.com" },
        { id: "4", email: "sem@x.com" },
      ],
      [
        { usuario_id: "1", nome: "Zeca", papel: "admin" },
        { usuario_id: "2", nome: "Ana", papel: "membro" },
        { usuario_id: "3", nome: "", papel: "membro" },
      ],
    );
    expect(lista.map((m) => [m.nome, m.papel, m.temAcesso])).toEqual([
      ["Zeca", "admin", true],
      ["Ana", "membro", true],
      ["bia@x.com", "membro", true],
      ["sem@x.com", "membro", false],
    ]);
    expect(lista[1].ultimoAcesso).toBe("2026-10-22T10:00:00Z");
  });
});
