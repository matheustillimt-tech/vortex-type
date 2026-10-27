"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { RespostaLinha } from "@/src/lib/formulario/tipos";
import { STATUS_RESPOSTA, distribuicao, funil, itensResposta, linhasCsv, resumo } from "@/src/lib/formulario/metricas";
import { csv, fmtData, fmtNum, linkWhatsApp, pct } from "@/src/lib/formato";
import { usePeriodo, SeletorPeriodo } from "../_formularios/periodo";
import { ErrorBox, Loading, PageTitle, Panel, selectClass } from "../_formularios/ui";
import { useLoad } from "../_formularios/use-load";
import { Aviso, baixarCsv, botaoClass, Gaveta, inputClass, Numero, Selo } from "../_formularios/comum";
import { dados, type EventoFunil } from "../_formularios/dados";

const semAcento = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const telefoneBonito = (t: string | null) => {
  const d = (t ?? "").replace(/\D/g, "").replace(/^55/, "");
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : t ?? "";
};

/** Promessa que não termina: a lista fica carregando até a lista de formulários chegar. */
const esperar = <T,>() => new Promise<T>(() => {});

export function ListaRespostas() {
  const params = useSearchParams();
  const { range, periodo, refreshKey, refresh } = usePeriodo();
  const [bot, setBot] = useState(params.get("formulario") ?? "");
  const [status, setStatus] = useState("");
  const [busca, setBusca] = useState("");
  const [aberta, setAberta] = useState<RespostaLinha | null>(null);
  const [erroApagar, setErroApagar] = useState("");

  // o filtro da URL (?formulario=) é o slug, pros links já mandados; o banco filtra pelo id
  const bots = useLoad(() => dados.formularios(), [refreshKey]);
  const botId = bot ? bots.data?.find((b) => b.slug === bot)?.id ?? (bots.data || bots.error ? "inexistente" : null) : "";
  const lista = useLoad(
    () => (botId === null ? esperar<RespostaLinha[]>() : botId === "inexistente" ? Promise.resolve([]) : dados.respostas({ ...range, formulario: botId || undefined })),
    [periodo, botId, refreshKey],
  );
  const eventos = useLoad(
    () => (botId === null ? esperar<EventoFunil[]>() : botId === "inexistente" ? Promise.resolve([]) : dados.eventos(range.from, range.to, botId || undefined)),
    [periodo, botId, refreshKey],
  );

  const botAtual = bots.data?.find((b) => b.slug === bot) ?? (bots.data?.length === 1 ? bots.data[0] : undefined);
  const todas = lista.data ?? [];
  const filtradas = useMemo(() => {
    const t = semAcento(busca.trim());
    const dig = busca.replace(/\D/g, "");
    return todas.filter(
      (r) =>
        (!status || r.status === status) &&
        (!t || semAcento(`${r.nome ?? ""} ${r.email ?? ""} ${r.empresa ?? ""}`).includes(t) || (dig.length >= 3 && (r.whatsapp ?? "").includes(dig))),
    );
  }, [todas, status, busca]);
  const r = resumo(todas);
  const etapas = botAtual ? funil(botAtual.perguntas, eventos.data ?? []) : [];
  const escolhas = botAtual?.perguntas.filter((p) => p.tipo === "escolha" || p.tipo === "varias") ?? [];

  function exportar() {
    const perguntas = botAtual?.perguntas ?? [];
    baixarCsv(`formulario-${bot || "todos"}-${new Date().toISOString().slice(0, 10)}.csv`, csv(linhasCsv(filtradas, perguntas)));
  }

  async function apagar(x: RespostaLinha) {
    if (!confirm(`Apagar a resposta de ${x.nome ?? "sem nome"}? Não dá pra desfazer.`)) return;
    setErroApagar("");
    try {
      await dados.apagarResposta(x.id);
    } catch {
      setErroApagar("Não foi possível salvar. Tente de novo.");
      return;
    }
    setAberta(null);
    refresh();
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageTitle title="Respostas" subtitle="Quem respondeu os seus formulários. Quem para no meio aparece como Abandonou, pra você chamar.">
        <div className="flex flex-wrap gap-2">
          <SeletorPeriodo />
          <select className={selectClass} value={bot} onChange={(e) => setBot(e.target.value)} aria-label="Formulário">
            <option value="">Todos os formulários</option>
            {bots.data?.map((b) => (
              <option key={b.id} value={b.slug}>
                {b.nome}
              </option>
            ))}
          </select>
          <button type="button" className={botaoClass} onClick={exportar} disabled={!filtradas.length}>
            Baixar CSV
          </button>
        </div>
      </PageTitle>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Numero label="Começaram (responderam a 1ª pergunta)" valor={fmtNum(r.total)} />
        <Numero label="Responderam tudo" valor={fmtNum(r.concluiu)} sub={pct(r.concluiu, r.total)} />
        <Numero label="Sem perfil" valor={fmtNum(r.desqualificado)} sub={`${pct(r.desqualificado, r.concluiu)} de quem respondeu tudo`} />
        <Numero label="Abandonaram" valor={fmtNum(r.parcial)} sub="chame no WhatsApp" />
      </div>

      {botAtual && etapas.length > 0 && (
        <div className="mb-6 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <Panel title="Onde as pessoas param" subtitle={`${botAtual.nome} · pessoas únicas por etapa`}>
            <div className="space-y-2">
              {etapas.map((e) => (
                <div key={e.key}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="truncate">{e.label}</span>
                    <span className="shrink-0 tabular-nums text-vt-muted">
                      {fmtNum(e.n)}
                      {e.queda > 0.005 && <span className="ml-2 text-red-300">−{Math.round(e.queda * 100)}%</span>}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-vt-panel-2">
                    <div className="h-full rounded-full bg-vt-accent" style={{ width: `${Math.max(1, e.doTopo * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Quem está aplicando" subtitle="respostas das perguntas de escolha">
            <div className="space-y-5">
              {escolhas.map((p) => {
                const d = distribuicao(todas, p.slug, p.tipo === "varias").slice(0, 6);
                const max = d[0]?.n ?? 1;
                return (
                  <div key={p.slug}>
                    <p className="mb-2 text-[13px] font-medium">{p.texto}</p>
                    {d.length === 0 && <p className="text-[12px] text-vt-muted">sem respostas ainda</p>}
                    {d.map((x) => (
                      <div key={x.opcao} className="mb-1.5 flex items-center gap-2 text-[12px]">
                        <span className="w-40 shrink-0 truncate text-vt-muted">{x.opcao}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-vt-panel-2">
                          <div className="h-full rounded-full bg-blue-500" style={{ width: `${(x.n / max) * 100}%` }} />
                        </div>
                        <span className="w-8 text-right tabular-nums">{x.n}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      )}

      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <input className={inputClass} placeholder="Buscar por nome, e-mail, empresa ou WhatsApp" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <div className="flex flex-wrap gap-1.5">
          {[["", "Todos"], ...Object.entries(STATUS_RESPOSTA).map(([k, v]) => [k, v.label])].map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setStatus(k)}
              className={`h-10 whitespace-nowrap rounded-lg border px-3 text-[13px] ${status === k ? "border-vt-accent/60 bg-vt-accent/15 text-vt-accent" : "border-vt-line text-vt-muted hover:text-vt-text"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {lista.loading && <Loading />}
      {lista.error ? <ErrorBox error={lista.error} /> : null}
      {!lista.loading && (
        <div className="overflow-x-auto rounded-2xl border border-vt-line">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead className="bg-vt-panel text-left text-[12px] text-vt-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Pessoa</th>
                <th className="px-4 py-3 font-medium">Empresa</th>
                <th className="px-4 py-3 font-medium">Faturamento</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Origem</th>
                <th className="px-4 py-3 font-medium">Quando</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.slice(0, 500).map((x) => (
                <tr key={x.id} onClick={() => setAberta(x)} className="cursor-pointer border-t border-vt-line hover:bg-vt-panel">
                  <td className="px-4 py-3">
                    <p className="font-medium">{x.nome ?? "Sem nome"}</p>
                    <p className="text-[12px] text-vt-muted">{telefoneBonito(x.whatsapp)}</p>
                  </td>
                  <td className="px-4 py-3 text-vt-text/90">{x.empresa ?? "—"}</td>
                  <td className="px-4 py-3 text-vt-text/90">{itensResposta(x).find((a) => a.papel === "faturamento")?.a ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Selo cor={STATUS_RESPOSTA[x.status].cor}>{STATUS_RESPOSTA[x.status].label}</Selo>
                  </td>
                  <td className="px-4 py-3 text-vt-muted">{x.utm_source ?? "direto"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-vt-muted">{fmtData(x.criado_em)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtradas.length && <p className="p-6 text-center text-[14px] text-vt-muted">Nenhuma resposta nesse filtro e período.</p>}
          {filtradas.length > 500 && <p className="border-t border-vt-line p-3 text-center text-[12px] text-vt-muted">Mostrando 500 de {fmtNum(filtradas.length)}. O CSV leva todas.</p>}
        </div>
      )}

      <Gaveta aberta={!!aberta} titulo={aberta?.nome ?? "Sem nome"} sub={aberta && `${aberta.formulario_slug} · ${fmtData(aberta.criado_em)}`} onFechar={() => {
          setAberta(null);
          setErroApagar("");
        }}>
        {aberta && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Selo cor={STATUS_RESPOSTA[aberta.status].cor}>{STATUS_RESPOSTA[aberta.status].label}</Selo>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {aberta.whatsapp && (
                <a href={linkWhatsApp(aberta.whatsapp)} target="_blank" rel="noopener noreferrer" className="flex h-10 items-center justify-center rounded-lg bg-green-600 text-[14px] font-semibold text-white hover:bg-green-500">
                  WhatsApp
                </a>
              )}
              {aberta.email && (
                <a href={`mailto:${aberta.email}`} className="flex h-10 items-center justify-center rounded-lg border border-vt-line text-[14px] font-semibold hover:bg-vt-panel-2">
                  E-mail
                </a>
              )}
            </div>
            <div className="space-y-3">
              <h3 className="text-[13px] font-semibold text-vt-muted">RESPOSTAS</h3>
              {itensResposta(aberta).map((a) => (
                <div key={a.slug}>
                  <p className="text-[12px] text-vt-muted">{a.q}</p>
                  <p className="text-[14px]">{a.papel === "whatsapp" ? telefoneBonito(a.a) : a.a}</p>
                </div>
              ))}
            </div>
            <div className="space-y-1 text-[12px] text-vt-muted">
              <h3 className="mb-2 text-[13px] font-semibold">ORIGEM</h3>
              {(["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const).map((k) => aberta[k] && <p key={k}>{k}: <span className="text-vt-text/90">{aberta[k]}</span></p>)}
              {Object.entries(aberta.origem ?? {}).map(([k, v]) => (
                <p key={k} className="truncate">
                  {k}: <span className="text-vt-text/90">{String(v)}</span>
                </p>
              ))}
            </div>
            {erroApagar && <Aviso tipo="erro">{erroApagar}</Aviso>}
            <button type="button" className={`${botaoClass} text-red-300`} onClick={() => void apagar(aberta)}>
              Apagar resposta
            </button>
          </>
        )}
      </Gaveta>
    </div>
  );
}
