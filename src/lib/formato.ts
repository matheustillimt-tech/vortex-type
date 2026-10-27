/** Formatos do painel (pt-BR, horário de Brasília). Puro. */
const TZ = "America/Sao_Paulo";

export function fmtNum(n: number) {
  return n.toLocaleString("pt-BR");
}

export function pct(part: number, total: number) {
  if (!total) return "0%";
  const v = (part / total) * 100;
  return `${v < 10 && v > 0 ? v.toFixed(1).replace(".", ",") : Math.round(v)}%`;
}

export function fmtData(iso: string) {
  return new Date(iso)
    .toLocaleString("pt-BR", { timeZone: TZ, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    .replace(".", "")
    .replace(",", "");
}

export function linkWhatsApp(tel: string) {
  let d = tel.replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return `https://wa.me/${d}`;
}

export type Periodo = "1" | "7" | "30" | "90" | "tudo";

export function intervalo(p: Periodo) {
  const to = new Date(Date.now() + 60000).toISOString();
  if (p === "tudo") return { from: "2020-01-01T00:00:00Z", to };
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (Number(p) - 1));
  return { from: d.toISOString(), to };
}

export const PERIODOS: { key: Periodo; label: string }[] = [
  { key: "1", label: "Hoje" },
  { key: "7", label: "7 dias" },
  { key: "30", label: "30 dias" },
  { key: "90", label: "90 dias" },
  { key: "tudo", label: "Todo período" },
];

export function csv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  // célula que começa com = + - @ tab ou CR vira fórmula no Excel/Sheets: o ' na frente deixa como texto
  const esc = (v: unknown) => {
    const t = String(v ?? "");
    return `"${(/^[=+\-@\t\r]/.test(t) ? `'${t}` : t).replace(/"/g, '""')}"`;
  };
  return [cols.join(";"), ...rows.map((r) => cols.map((c) => esc(r[c])).join(";"))].join("\n");
}
