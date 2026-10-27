import { describe, expect, it } from "vitest";
import { csv, fmtNum, intervalo, linkWhatsApp, pct } from "@/src/lib/formato";

describe("formato", () => {
  it("número e porcentagem em pt-BR", () => {
    expect(fmtNum(12345)).toBe("12.345");
    expect(pct(0, 0)).toBe("0%");
    expect(pct(1, 40)).toBe("2,5%");
    expect(pct(30, 40)).toBe("75%");
  });
  it("link do WhatsApp com DDI", () => {
    const cel = "5511900000000"; // fictício
    expect(linkWhatsApp("(11) 90000-0000")).toBe(`https://wa.me/${cel}`);
    expect(linkWhatsApp(cel)).toBe(`https://wa.me/${cel}`);
  });
  it("CSV com ponto e vírgula e aspas escapadas", () => {
    expect(csv([{ a: 'x "y"', b: 2 }])).toBe('a;b\n"x ""y""";"2"');
    expect(csv([])).toBe("");
  });
  it("CSV neutraliza fórmula no começo da célula", () => {
    expect(csv([{ a: "=1+1" }])).toBe('a\n"\'=1+1"');
    expect(csv([{ a: "-5" }])).toBe('a\n"\'-5"');
    expect(csv([{ a: "+55 31" }, { a: "@x" }, { a: "\tx" }])).toBe('a\n"\'+55 31"\n"\'@x"\n"\'\tx"');
    expect(csv([{ a: "Ana 1+1", b: 5 }])).toBe('a;b\n"Ana 1+1";"5"');
  });
  it("período 'tudo' começa em 2020", () => {
    expect(intervalo("tudo").from).toBe("2020-01-01T00:00:00Z");
  });
});
