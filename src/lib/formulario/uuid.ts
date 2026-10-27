/** UUID v4 do navegador. Puro (o `c` é injetável pro teste). */
type Cripto = { randomUUID?: () => string; getRandomValues?: <T extends ArrayBufferView | null>(a: T) => T };

export function uuid(c: Cripto | undefined = typeof crypto !== "undefined" ? crypto : undefined): string {
  if (c?.randomUUID) return c.randomUUID();
  // navegador antigo (ou http sem contexto seguro): monta o v4 na mão
  const b = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40; // versão 4
  b[8] = (b[8] & 0x3f) | 0x80; // variante 10xx
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
