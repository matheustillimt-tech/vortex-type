import { describe, expect, it } from "vitest";
import { webcrypto } from "node:crypto";
import { uuid } from "@/src/lib/formulario/uuid";

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("uuid", () => {
  it("usa o randomUUID quando existe", () => {
    expect(uuid({ randomUUID: () => "do-navegador" })).toBe("do-navegador");
  });
  it("sem randomUUID monta um v4 válido com getRandomValues", () => {
    const c = { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) as never };
    for (let i = 0; i < 200; i++) expect(uuid(c)).toMatch(V4);
    expect(uuid({ getRandomValues: ((a: Uint8Array) => a.fill(255)) as never })).toMatch(V4);
    expect(uuid({ getRandomValues: ((a: Uint8Array) => a.fill(0)) as never })).toMatch(V4);
  });
  it("sem crypto nenhum ainda sai um v4 válido", () => {
    expect(uuid({})).toMatch(V4);
  });
});
