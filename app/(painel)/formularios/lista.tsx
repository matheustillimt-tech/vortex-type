"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { slugify } from "@/src/lib/formulario/fluxo";
import { EXEMPLO } from "@/src/lib/formulario/exemplo";
import type { Formulario } from "@/src/lib/formulario/tipos";
import { validarSlug } from "@/src/lib/formulario/slug";
import { resumo } from "@/src/lib/formulario/metricas";
import { fmtNum } from "@/src/lib/formato";
import { usePeriodo, SeletorPeriodo } from "../_formularios/periodo";
import { ErrorBox, Loading, PageTitle } from "../_formularios/ui";
import { useLoad } from "../_formularios/use-load";
import { Aviso, botaoClass, botaoPrincipalClass, inputClass, Selo, useLinkPublico } from "../_formularios/comum";
import { dados } from "../_formularios/dados";

/** Campos que um formulário novo ou duplicado copia de outro. */
function copiar(b: Formulario): Partial<Formulario> {
  const { id: _id, criado_em: _c, atualizado_em: _a, slug: _s, nome: _n, ...resto } = b;
  return resto;
}

function slugDisponivel(base: string): string {
  const erro = validarSlug(base);
  return erro ? `${base}-form` : base;
}

export function ListaFormularios() {
  const router = useRouter();
  const { range, periodo, refreshKey, refresh } = usePeriodo();
  const linkPublico = useLinkPublico();
  const formularios = useLoad(() => dados.formularios(), [refreshKey]);
  const respostas = useLoad(() => dados.respostas(range), [periodo, refreshKey]);
  const [nome, setNome] = useState("");
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  async function criar(base?: Formulario) {
    const n = base ? `${base.nome} (cópia)` : nome.trim();
    if (!n) return;
    const nomeBase = base ? `${base.slug}-copia` : n;
    let slug = slugDisponivel(slugify(nomeBase) || "formulario");
    const usados = new Set((formularios.data ?? []).map((f) => f.slug));
    for (let i = 2; usados.has(slug); i++) slug = slugDisponivel(`${slugify(nomeBase)}-${i}`);
    try {
      const novo = await dados.criarFormulario({ ...copiar(base ?? EXEMPLO), nome: n, slug, ativo: base ? false : true });
      setNome("");
      router.push(`/formularios/${novo.id}`);
    } catch (e) {
      setMsg({ tipo: "erro", texto: e instanceof Error ? e.message : String(e) });
    }
  }

  async function alternar(f: Formulario) {
    setMsg(null);
    try {
      await dados.salvarFormulario(f.id, { ativo: !f.ativo });
    } catch {
      setMsg({ tipo: "erro", texto: "Não foi possível salvar. Tente de novo." });
      return;
    }
    refresh();
  }

  async function apagar(f: Formulario) {
    if (!confirm(`Apagar "${f.nome}"? As respostas dele também somem. Não dá pra desfazer.`)) return;
    setMsg(null);
    try {
      await dados.apagarFormulario(f.id);
    } catch {
      setMsg({ tipo: "erro", texto: "Não foi possível salvar. Tente de novo." });
      return;
    }
    refresh();
  }

  function copiarLink(slug: string) {
    navigator.clipboard?.writeText(linkPublico(slug));
    setCopiado(slug);
    setTimeout(() => setCopiado(null), 1500);
  }

  return (
    <div>
      <PageTitle title="Formulários" subtitle="Formulários de aplicação em formato de conversa. Cada um tem um link pra bio do Instagram e do TikTok.">
        <SeletorPeriodo />
      </PageTitle>

      {msg && (
        <div className="mb-4">
          <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void criar();
        }}
        className="mb-6 flex flex-col gap-2 rounded-2xl border border-vt-line bg-vt-panel p-4 sm:flex-row sm:items-center"
      >
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do novo formulário (ex.: Aplicação Mentoria)" className={inputClass} />
        <button className={`${botaoPrincipalClass} h-10 shrink-0`} disabled={!nome.trim()}>
          Criar formulário
        </button>
      </form>

      {formularios.loading && <Loading />}
      {formularios.error ? <ErrorBox error={formularios.error} /> : null}

      <div className="grid gap-4 md:grid-cols-2">
        {formularios.data?.map((f) => {
          const r = resumo((respostas.data ?? []).filter((x) => x.formulario_id === f.id));
          return (
            <section key={f.id} className="flex flex-col gap-4 rounded-2xl border border-vt-line bg-vt-panel p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-[16px] font-semibold">{f.nome}</h2>
                  <a href={linkPublico(f.slug)} target="_blank" rel="noopener" className="block truncate text-[13px] text-vt-muted hover:text-vt-accent">
                    /{f.slug}
                  </a>
                </div>
                <Selo cor={f.ativo ? "#22c55e" : "#8b8b8b"}>{f.ativo ? "No ar" : "Desligado"}</Selo>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  ["Respostas", r.total],
                  ["Concluíram", r.concluiu],
                  ["Sem perfil", r.desqualificado],
                ].map(([l, v]) => (
                  <div key={l} className="rounded-xl bg-vt-panel-2 p-2.5">
                    <p className="text-[18px] font-bold">{fmtNum(Number(v))}</p>
                    <p className="text-[11px] text-vt-muted">{l}</p>
                  </div>
                ))}
              </div>
              <p className="-mt-2 text-[12px] text-vt-muted">no período escolhido no topo · {f.perguntas.length} perguntas</p>

              <div className="flex flex-wrap gap-2">
                <Link href={`/formularios/${f.id}`} className={botaoPrincipalClass}>
                  Editar
                </Link>
                <button type="button" className={botaoClass} onClick={() => copiarLink(f.slug)}>
                  {copiado === f.slug ? "Copiado!" : "Copiar link da bio"}
                </button>
                <Link href={`/respostas?formulario=${f.slug}`} className={botaoClass}>
                  Respostas
                </Link>
                <button type="button" className={botaoClass} onClick={() => void criar(f)}>
                  Duplicar
                </button>
                <button type="button" className={botaoClass} onClick={() => void alternar(f)}>
                  {f.ativo ? "Desligar" : "Ligar"}
                </button>
                <button type="button" className={`${botaoClass} text-red-300`} onClick={() => void apagar(f)}>
                  Apagar
                </button>
              </div>
            </section>
          );
        })}
      </div>

      {formularios.data && !formularios.data.length && (
        <Aviso tipo="info">Nenhum formulário ainda. Crie o primeiro acima: ele já vem com um roteiro de exemplo pra você ajustar.</Aviso>
      )}
    </div>
  );
}
