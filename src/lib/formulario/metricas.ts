/** Contas do painel do formulário, sem React. */
import { separar } from "@/src/lib/formulario/fluxo";
import type { Pergunta, Resposta, RespostaLinha, StatusResposta } from "@/src/lib/formulario/tipos";

export const STATUS_RESPOSTA: Record<StatusResposta, { label: string; cor: string }> = {
  parcial: { label: "Abandonou", cor: "#8b8b8b" },
  completo: { label: "Respondeu tudo", cor: "#3b82f6" },
  desqualificado: { label: "Sem perfil", cor: "#ef4444" },
};

/**
 * Itens de resposta que dá pra mostrar: objeto com `slug` e `a` texto.
 * Linha antiga ou adulterada (null, `a` objeto, array fora do formato) é ignorada em vez de quebrar a tela.
 */
export function itensResposta(r: Pick<RespostaLinha, "respostas">): Resposta[] {
  const lista: unknown = r.respostas;
  if (!Array.isArray(lista)) return [];
  return lista.filter((x): x is Resposta => !!x && typeof x === "object" && !Array.isArray(x) && typeof (x as Resposta).a === "string" && typeof (x as Resposta).slug === "string");
}

type Ev = { anon_id: string; evento: string; meta: Record<string, unknown> };

/**
 * Funil por pessoa (anon_id): abriu → respondeu cada pergunta → concluiu → (agendamento) viu a agenda → agendou.
 * As etapas da agenda aparecem quando o formulário tem agendamento (`comAgenda`) ou quando há evento delas no período.
 * Cada etapa conta quem chegou nela; a queda é em relação à etapa anterior.
 */
export function funil(perguntas: Pergunta[], eventos: Ev[], comAgenda = false) {
  const por = (filtro: (e: Ev) => boolean) => new Set(eventos.filter(filtro).map((e) => e.anon_id)).size;
  const agenda = comAgenda || eventos.some((e) => e.evento === "abriu_agenda" || e.evento === "agendou");
  const etapas = [
    { key: "abriu", label: "Abriu a página", n: por((e) => e.evento === "abriu") },
    ...perguntas.map((p, i) => ({
      key: `p:${p.slug}`,
      label: `${i + 1}. ${p.texto}`,
      n: por((e) => e.evento === "respondeu" && e.meta?.pergunta === p.slug),
    })),
    { key: "concluiu", label: "Concluiu", n: por((e) => e.evento === "concluiu" || e.evento === "desqualificado") },
    ...(agenda
      ? [
          { key: "abriu_agenda", label: "Viu a agenda", n: por((e) => e.evento === "abriu_agenda") },
          { key: "agendou", label: "Agendou", n: por((e) => e.evento === "agendou") },
        ]
      : []),
  ];
  return etapas.map((e, i) => {
    const antes = i === 0 ? e.n : etapas[i - 1].n;
    return { ...e, queda: antes > 0 ? Math.max(0, antes - e.n) / antes : 0, doTopo: etapas[0].n ? e.n / etapas[0].n : 0 };
  });
}

/** Quantas pessoas escolheram cada opção de uma pergunta de escolha (`varias`: conta cada opção marcada). */
export function distribuicao(respostas: RespostaLinha[], slug: string, varias = false) {
  const m = new Map<string, number>();
  for (const r of respostas) {
    const a = itensResposta(r).find((x) => x.slug === slug)?.a;
    for (const o of a ? (varias ? separar(a) : [a]) : []) m.set(o, (m.get(o) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([opcao, n]) => ({ opcao, n }));
}

export function resumo(respostas: RespostaLinha[]) {
  const n = (s: StatusResposta) => respostas.filter((r) => r.status === s).length;
  const concluiu = n("completo") + n("desqualificado");
  return { total: respostas.length, parcial: n("parcial"), concluiu, desqualificado: n("desqualificado") };
}

/** Uma linha por resposta, com uma coluna por pergunta (na ordem do formulário). */
export function linhasCsv(respostas: RespostaLinha[], perguntas: Pergunta[]): Record<string, string>[] {
  return respostas.map((r) => {
    const itens = itensResposta(r);
    const base: Record<string, string> = {
      data: r.criado_em,
      formulario: r.formulario_slug,
      status: STATUS_RESPOSTA[r.status].label,
      nome: r.nome ?? "",
      whatsapp: r.whatsapp ?? "",
      email: r.email ?? "",
      empresa: r.empresa ?? "",
    };
    for (const p of perguntas) if (!["nome", "whatsapp", "email", "empresa"].includes(p.papel ?? "")) base[p.slug] = itens.find((x) => x.slug === p.slug)?.a ?? "";
    return { ...base, utm_source: r.utm_source ?? "", utm_medium: r.utm_medium ?? "", utm_campaign: r.utm_campaign ?? "", utm_content: r.utm_content ?? "" };
  });
}
