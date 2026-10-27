/** Datas da agenda. Tudo no horário de Brasília (America/Sao_Paulo, sem horário de verão desde 2019). Puro. */
import type { SessaoCall } from "./tipos";

export const TZ = "America/Sao_Paulo";
export const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const DIAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

const p2 = (n: number) => String(n).padStart(2, "0");
const maiuscula = (s: string) => s.replace(/^./, (c) => c.toUpperCase());

/** "2026-10-23" e "14:30" do instante, no horário de Brasília. */
export function partesBrasilia(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const o = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { dia: `${o.year}-${o.month}-${o.day}`, hora: `${o.hour}:${o.minute}` };
}

/** Instante (ISO) de uma data + hora em Brasília. Brasília é UTC-3 o ano inteiro. */
export function instanteBrasilia(dia: string, hora: string) {
  return new Date(`${dia}T${hora.length === 5 ? `${hora}:00` : hora}-03:00`).toISOString();
}

/** "23 de outubro" */
export function diaPorExtenso(dia: string) {
  const [, m, d] = dia.split("-").map(Number);
  return `${d} de ${MESES[(m || 1) - 1]}`;
}

/** "23 de outubro às 15:00" (cabeçalho do confirmar e do reservado). */
export function diaEHora(iso: string) {
  const { dia, hora } = partesBrasilia(iso);
  return `${diaPorExtenso(dia)} às ${hora}`;
}

/** "Outubro 2026" (mês de 0 a 11). */
export function mesAno(ano: number, mes: number) {
  return `${maiuscula(MESES[mes])} ${ano}`;
}

/** "2026-10" (mês de 0 a 11), pra comparar com o começo da chave do dia. */
export function chaveMes(ano: number, mes: number) {
  return `${ano}-${p2(mes + 1)}`;
}

/** "Hoje é Sexta-feira, 13:45" */
export function hojeTexto(agora: Date) {
  const { dia, hora } = partesBrasilia(agora);
  return `Hoje é ${maiuscula(DIAS[new Date(`${dia}T12:00:00Z`).getUTCDay()])}, ${hora}`;
}

/** Agrupa horários pelo dia (em Brasília), cada dia em ordem de hora. */
export function porDia<T extends { inicio: string }>(lista: T[]) {
  const m = new Map<string, T[]>();
  for (const h of [...lista].sort((a, b) => a.inicio.localeCompare(b.inicio))) {
    const { dia } = partesBrasilia(h.inicio);
    m.set(dia, [...(m.get(dia) ?? []), h]);
  }
  return m;
}

/** Células do calendário do mês (0 a 11): null nos espaços antes do dia 1. */
export function celulasDoMes(ano: number, mes: number) {
  const primeiro = new Date(Date.UTC(ano, mes, 1)).getUTCDay();
  const dias = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  const out: ({ dia: number; chave: string } | null)[] = Array(primeiro).fill(null);
  for (let d = 1; d <= dias; d++) out.push({ dia: d, chave: `${ano}-${p2(mes + 1)}-${p2(d)}` });
  return out;
}

/** Dia (Brasília) do primeiro horário da lista: é o que o cartão abre escolhido. */
export function primeiroDia(lista: { inicio: string }[]): string | null {
  if (!lista.length) return null;
  const primeiro = [...lista].sort((a, b) => a.inicio.localeCompare(b.inicio))[0];
  return partesBrasilia(primeiro.inicio).dia;
}

/** Primeiro dia com horário dentro do mês (0 a 11), pra quando a pessoa troca de mês. */
export function primeiroDiaDoMes(dias: Map<string, unknown[]>, ano: number, mes: number): string | null {
  const prefixo = `${chaveMes(ano, mes)}-`;
  return [...dias.keys()].filter((d) => d.startsWith(prefixo)).sort()[0] ?? null;
}

/** Dia (Brasília) do primeiro horário que ainda não passou: é o que o cartão abre escolhido (a pessoa pode ter
 *  esperado e o primeiro dia da lista já ter ficado todo no passado). */
export function primeiroDiaComHorarioFuturo(lista: { inicio: string }[], agora: Date): string | null {
  return primeiroDia(lista.filter((h) => new Date(h.inicio) > agora));
}

/** Horários de mentira pro editor do painel: próximos 5 dias úteis, 10h, 14h e 15h. */
export function horariosDePrevia(agora: Date): SessaoCall[] {
  const out: SessaoCall[] = [];
  const d = new Date(`${partesBrasilia(agora).dia}T12:00:00Z`);
  while (out.length < 15) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
    const dia = d.toISOString().slice(0, 10);
    for (const h of ["10:00", "14:00", "15:00"]) out.push({ id: `previa-${dia}-${h}`, inicio: instanteBrasilia(dia, h), restantes: 15, lotada: false });
  }
  return out;
}
