import { describe, expect, it } from "vitest";
import { exigeLogin } from "@/middleware";

describe("exigeLogin", () => {
  it("painel exige; login, api e formulário não", () => {
    expect(exigeLogin("/")).toBe(true);
    expect(exigeLogin("/equipe")).toBe(true);
    expect(exigeLogin("/login")).toBe(false);
    expect(exigeLogin("/api/mcp")).toBe(false);
    expect(exigeLogin("/aplicacao")).toBe(false);
  });
});
