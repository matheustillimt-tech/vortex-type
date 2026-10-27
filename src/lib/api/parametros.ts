/** Filtros da API e do MCP (respostas, período). Puro. Datas AAAA-MM-DD em horário de Brasília (UTC−3). */

export type FiltroApi = { formulario?: string; status?: "parcial" | "completo" | "desqualificado"; de?: string; ate?: string; limite: number; antes?: { criadoEm: string; id: string } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIA = /^\d{4}-\d{2}-\d{2}$/;
const STATUS = ["parcial", "completo", "desqualificado"] as const;
/** Timestamp do cursor: o que o Postgres devolveu, com microssegundos e offset (não é "sempre .000Z"). */
const TS_CURSOR = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;

/** Meia-noite de Brasília do dia, em ISO UTC. `fim` = meia-noite do dia seguinte (fim inclusivo). */
function meiaNoite(dia: string, fim = false): string | null {
  if (!DIA.test(dia)) return null;
  const d = new Date(`${dia}T03:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  if (fim) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : undefined);

export function lerFiltro(v: Record<string, unknown>): { ok: true; filtro: FiltroApi } | { ok: false; erro: string } {
  const filtro: FiltroApi = { limite: 100 };
  const formulario = texto(v.formulario);
  if (formulario !== undefined) {
    if (!UUID.test(formulario)) return { ok: false, erro: "formulario: use o id (uuid) do formulário." };
    filtro.formulario = formulario;
  }
  const status = texto(v.status);
  if (status !== undefined) {
    if (!(STATUS as readonly string[]).includes(status)) return { ok: false, erro: "status: use parcial, completo ou desqualificado." };
    filtro.status = status as FiltroApi["status"];
  }
  const de = texto(v.de);
  const ate = texto(v.ate);
  if (de !== undefined) {
    const iso = meiaNoite(de);
    if (!iso) return { ok: false, erro: "de/ate: use AAAA-MM-DD." };
    filtro.de = iso;
  }
  if (ate !== undefined) {
    const iso = meiaNoite(ate, true);
    if (!iso) return { ok: false, erro: "de/ate: use AAAA-MM-DD." };
    filtro.ate = iso;
  }
  const limite = texto(v.limite);
  if (limite !== undefined) {
    const n = Math.floor(Number(limite));
    if (!Number.isFinite(n) || n < 1) return { ok: false, erro: "limite: número de 1 a 500." };
    filtro.limite = Math.min(500, n);
  }
  const antes = texto(v.antes);
  if (antes !== undefined) {
    // Guarda o timestamp tal como veio (não reserializa): reserializar com Date/toISOString arredonda pra
    // milissegundos e perde os microssegundos que o Postgres manda, quebrando o desempate de `listarRespostas`.
    const m = /^(.+)_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(antes);
    const ts = m?.[1];
    if (!m || !ts || !TS_CURSOR.test(ts) || Number.isNaN(Date.parse(ts))) return { ok: false, erro: "antes: use o valor do campo proximo." };
    filtro.antes = { criadoEm: ts, id: m[2] };
  }
  return { ok: true, filtro };
}

/** Período das métricas. Sem datas: últimos 30 dias até agora. */
export function lerPeriodo(de?: unknown, ate?: unknown): { ok: true; de: string; ate: string } | { ok: false; erro: string } {
  const d = texto(de);
  const a = texto(ate);
  const inicio = d ? meiaNoite(d) : new Date(Date.now() - 30 * 86400000).toISOString();
  const fim = a ? meiaNoite(a, true) : new Date(Date.now() + 60000).toISOString();
  if (!inicio || !fim) return { ok: false, erro: "de/ate: use AAAA-MM-DD." };
  return { ok: true, de: inicio, ate: fim };
}
