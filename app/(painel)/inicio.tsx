"use client";
import Link from "next/link";
import { useState } from "react";
import { funil, resumo } from "@/src/lib/formulario/metricas";
import { fmtNum, pct } from "@/src/lib/formato";
import { Aviso, Numero } from "./_formularios/comum";
import { dados } from "./_formularios/dados";
import { SeletorPeriodo, usePeriodo } from "./_formularios/periodo";
import { ErrorBox, Loading, PageTitle, Panel, selectClass } from "./_formularios/ui";
import { useLoad } from "./_formularios/use-load";

/** Início: como os formulários estão indo no período, e onde as pessoas param no formulário escolhido. */
export function Inicio() {
  const { range, periodo, refreshKey } = usePeriodo();
  const [formularioId, setFormularioId] = useState("");
  const formularios = useLoad(() => dados.formularios(), [refreshKey]);
  const respostas = useLoad(() => dados.respostas({ ...range, formulario: formularioId || undefined }), [periodo, formularioId, refreshKey]);

  const atual = formularios.data?.find((f) => f.id === formularioId) ?? (formularios.data?.length === 1 ? formularios.data[0] : null);
  const idEfetivo = atual?.id ?? "";
  const eventos = useLoad(() => (idEfetivo ? dados.eventos(range.from, range.to, idEfetivo) : Promise.resolve([])), [periodo, idEfetivo, refreshKey]);

  const r = resumo(respostas.data ?? []);
  const etapas = atual ? funil(atual.perguntas, eventos.data ?? [], !!atual.agendamento) : [];

  return (
    <>
      <PageTitle title="Início" subtitle="Como os seus formulários estão indo no período.">
        <select className={selectClass} value={formularioId} onChange={(e) => setFormularioId(e.target.value)} aria-label="Formulário">
          <option value="">Todos os formulários</option>
          {formularios.data?.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
        </select>
        <SeletorPeriodo />
      </PageTitle>

      {formularios.error ? <ErrorBox error={formularios.error} /> : null}
      {respostas.error ? <ErrorBox error={respostas.error} /> : null}

      {formularios.data && !formularios.data.length ? (
        <Aviso tipo="info">
          Nenhum formulário ainda.{" "}
          <Link href="/formularios" className="underline">
            Crie o primeiro
          </Link>
          .
        </Aviso>
      ) : (
        <div className="space-y-6">
          {respostas.loading ? (
            <Loading />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Numero label="Respostas" valor={fmtNum(r.total)} sub="começaram a responder" />
              <Numero label="Concluíram" valor={fmtNum(r.concluiu)} sub={`${pct(r.concluiu, r.total)} de quem começou`} />
              <Numero label="Sem perfil" valor={fmtNum(r.desqualificado)} sub={`${pct(r.desqualificado, r.concluiu)} de quem concluiu`} />
              <Numero label="Abandonaram" valor={fmtNum(r.parcial)} sub="pararam no meio" />
            </div>
          )}

          {atual ? (
            <Panel title="Onde as pessoas param" subtitle={`${atual.nome} · pessoas únicas por etapa`}>
              {eventos.loading ? (
                <Loading />
              ) : (
                <ol className="space-y-2.5">
                  {etapas.map((e) => (
                    <li key={e.key} className="space-y-1">
                      <div className="flex items-center justify-between gap-3 text-[13px]">
                        <span className="truncate">{e.label}</span>
                        <span className="shrink-0 tabular-nums text-vt-muted">
                          {fmtNum(e.n)} · {pct(e.n, etapas[0]?.n ?? 0)}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                        <div className="h-full rounded-full bg-vt-accent" style={{ width: `${Math.max(2, e.doTopo * 100)}%` }} />
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          ) : (
            <p className="text-[13px] text-vt-muted">Escolha um formulário no topo pra ver onde as pessoas param.</p>
          )}
        </div>
      )}
    </>
  );
}
