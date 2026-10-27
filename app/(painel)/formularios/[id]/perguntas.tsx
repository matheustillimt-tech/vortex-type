"use client";

import type { Papel, Pergunta, TipoPergunta } from "@/src/lib/formulario/tipos";
import { botaoClass, Campo, inputClass, textareaClass } from "../../_formularios/comum";

const TIPOS: { key: TipoPergunta; label: string }[] = [
  { key: "texto", label: "Texto" },
  { key: "telefone", label: "WhatsApp (telefone)" },
  { key: "email", label: "E-mail" },
  { key: "escolha", label: "Escolha (botões)" },
  { key: "varias", label: "Várias opções (marca mais de uma)" },
];

const PAPEIS: { key: Papel | ""; label: string }[] = [
  { key: "", label: "Nenhum (só a resposta)" },
  { key: "nome", label: "Nome" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "email", label: "E-mail" },
  { key: "empresa", label: "Empresa" },
  { key: "nicho", label: "Segmento" },
  { key: "cargo", label: "Cargo" },
  { key: "faturamento", label: "Faturamento" },
];

const linhas = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

function novoSlug(perguntas: Pergunta[]) {
  let i = perguntas.length + 1;
  while (perguntas.some((p) => p.slug === `pergunta_${i}`)) i++;
  return `pergunta_${i}`;
}

export function EditorPerguntas({ perguntas, onChange }: { perguntas: Pergunta[]; onChange: (p: Pergunta[]) => void }) {
  const mudar = (i: number, patch: Partial<Pergunta>) => onChange(perguntas.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const mover = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= perguntas.length) return;
    const n = [...perguntas];
    [n[i], n[j]] = [n[j], n[i]];
    onChange(n);
  };

  return (
    <div className="space-y-4">
      {perguntas.map((p, i) => {
        const anteriores = perguntas.slice(0, i).filter((x) => x.tipo === "escolha");
        const alvo = perguntas.find((x) => x.slug === p.condicao?.slug);
        return (
          <section key={i} className="space-y-3 rounded-2xl border border-vt-line bg-vt-panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-vt-panel-2 text-[13px] font-bold">{i + 1}</span>
              <div className="flex gap-1.5">
                <button type="button" className={botaoClass} onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir">
                  ↑
                </button>
                <button type="button" className={botaoClass} onClick={() => mover(i, 1)} disabled={i === perguntas.length - 1} aria-label="Descer">
                  ↓
                </button>
                <button type="button" className={botaoClass} onClick={() => onChange([...perguntas.slice(0, i + 1), { ...p, slug: novoSlug(perguntas) }, ...perguntas.slice(i + 1)])}>
                  Duplicar
                </button>
                <button type="button" className={`${botaoClass} text-red-300`} onClick={() => confirm("Remover esta pergunta?") && onChange(perguntas.filter((_, j) => j !== i))}>
                  Remover
                </button>
              </div>
            </div>

            <Campo label="Pergunta">
              <input className={inputClass} value={p.texto} onChange={(e) => mudar(i, { texto: e.target.value })} />
            </Campo>

            <div className="grid gap-3 sm:grid-cols-3">
              <Campo label="Tipo">
                <select className={inputClass} value={p.tipo} onChange={(e) => mudar(i, { tipo: e.target.value as TipoPergunta })}>
                  {TIPOS.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo label="O que é" dica="vira coluna no painel e no webhook">
                <select className={inputClass} value={p.papel ?? ""} onChange={(e) => mudar(i, { papel: (e.target.value || null) as Papel | null })}>
                  {PAPEIS.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo label="Identificador" dica="nome da coluna no CSV">
                <input className={inputClass} value={p.slug} onChange={(e) => mudar(i, { slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "_") })} />
              </Campo>
            </div>

            <Campo label="Mensagens antes da pergunta" dica="uma por linha; use {nome} pro primeiro nome e **assim** pra negrito">
              <textarea className={textareaClass} rows={Math.max(2, (p.bolhas ?? []).length + 1)} value={(p.bolhas ?? []).join("\n")} onChange={(e) => mudar(i, { bolhas: linhas(e.target.value) })} />
            </Campo>

            {p.tipo === "varias" ? (
              <>
                <Campo label="Opções" dica="uma por linha">
                  <textarea className={textareaClass} rows={Math.min(10, Math.max(3, (p.opcoes ?? []).length + 1))} value={(p.opcoes ?? []).join("\n")} onChange={(e) => mudar(i, { opcoes: e.target.value.split("\n") })} onBlur={(e) => mudar(i, { opcoes: linhas(e.target.value) })} />
                </Campo>
                <Campo label="Quantas a pessoa pode marcar" dica="vazio = todas">
                  <input className={`${inputClass} max-w-32`} inputMode="numeric" value={p.maximo ?? ""} onChange={(e) => mudar(i, { maximo: e.target.value.replace(/\D/g, "") ? Number(e.target.value.replace(/\D/g, "")) : null })} />
                </Campo>
                <Campo label="Opções que valem sozinhas" dica="ex.: “Todas as áreas”. Marcar uma delas desmarca as outras, e marcar outra opção tira ela.">
                  <div className="flex flex-wrap gap-1.5">
                    {(p.opcoes ?? []).filter(Boolean).map((o) => {
                      const on = (p.exclusivas ?? []).includes(o);
                      return (
                        <button
                          key={o}
                          type="button"
                          aria-pressed={on}
                          onClick={() => mudar(i, { exclusivas: on ? (p.exclusivas ?? []).filter((x) => x !== o) : [...(p.exclusivas ?? []), o] })}
                          className={`rounded-full border px-2.5 py-1 text-[12px] ${on ? "border-vt-accent/60 bg-vt-accent/15 text-vt-accent" : "border-vt-line text-vt-muted hover:text-vt-text"}`}
                        >
                          {o}
                        </button>
                      );
                    })}
                  </div>
                </Campo>
              </>
            ) : p.tipo === "escolha" ? (
              <>
                <Campo label="Opções" dica="uma por linha; com mais de 8 vira lista com busca">
                  <textarea className={textareaClass} rows={Math.min(10, Math.max(3, (p.opcoes ?? []).length + 1))} value={(p.opcoes ?? []).join("\n")} onChange={(e) => mudar(i, { opcoes: e.target.value.split("\n") })} onBlur={(e) => mudar(i, { opcoes: linhas(e.target.value) })} />
                </Campo>
                <label className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" checked={!!p.outro} onChange={(e) => mudar(i, { outro: e.target.checked ? { rotulo: "", placeholder: "Conta pra gente..." } : null })} />
                  A última opção (&quot;{(p.opcoes ?? []).at(-1) ?? "Outro"}&quot;) abre um campo pra pessoa escrever
                </label>
                {p.outro && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Campo label="Rótulo do campo">
                      <input className={inputClass} value={p.outro.rotulo ?? ""} onChange={(e) => mudar(i, { outro: { ...p.outro, rotulo: e.target.value } })} />
                    </Campo>
                    <Campo label="Texto de exemplo do campo">
                      <input className={inputClass} value={p.outro.placeholder ?? ""} onChange={(e) => mudar(i, { outro: { ...p.outro, placeholder: e.target.value } })} />
                    </Campo>
                  </div>
                )}
                <Campo label="Quem escolher estas opções não tem perfil" dica="recebem a mensagem de 'sem perfil' no fim (configure em Textos)">
                  <div className="flex flex-wrap gap-1.5">
                    {(p.opcoes ?? []).filter(Boolean).map((o) => {
                      const on = (p.desqualifica ?? []).includes(o);
                      return (
                        <button
                          key={o}
                          type="button"
                          onClick={() => mudar(i, { desqualifica: on ? (p.desqualifica ?? []).filter((x) => x !== o) : [...(p.desqualifica ?? []), o] })}
                          className={`rounded-full border px-2.5 py-1 text-[12px] ${on ? "border-red-500/60 bg-red-500/15 text-red-300" : "border-vt-line text-vt-muted hover:text-vt-text"}`}
                        >
                          {o}
                        </button>
                      );
                    })}
                  </div>
                </Campo>
              </>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo label="Rótulo acima do campo" dica="ex.: NOME COMPLETO (opcional)">
                  <input className={inputClass} value={p.rotulo ?? ""} onChange={(e) => mudar(i, { rotulo: e.target.value })} />
                </Campo>
                <Campo label="Texto de exemplo dentro do campo">
                  <input className={inputClass} value={p.placeholder ?? ""} onChange={(e) => mudar(i, { placeholder: e.target.value })} />
                </Campo>
              </div>
            )}

            {anteriores.length > 0 && (
              <details className="rounded-xl border border-vt-line p-3" open={!!p.condicao?.slug}>
                <summary className="cursor-pointer text-[13px] font-medium">Só mostrar esta pergunta se...</summary>
                <div className="mt-3 space-y-3">
                  <select className={inputClass} value={p.condicao?.slug ?? ""} onChange={(e) => mudar(i, { condicao: e.target.value ? { slug: e.target.value, valores: [] } : null })}>
                    <option value="">Sempre mostrar</option>
                    {anteriores.map((a) => (
                      <option key={a.slug} value={a.slug}>
                        a resposta de &quot;{a.texto}&quot; for...
                      </option>
                    ))}
                  </select>
                  {alvo && (
                    <div className="flex flex-wrap gap-1.5">
                      {(alvo.opcoes ?? []).map((o) => {
                        const on = p.condicao!.valores.includes(o);
                        return (
                          <button
                            key={o}
                            type="button"
                            onClick={() => mudar(i, { condicao: { slug: alvo.slug, valores: on ? p.condicao!.valores.filter((x) => x !== o) : [...p.condicao!.valores, o] } })}
                            className={`rounded-full border px-2.5 py-1 text-[12px] ${on ? "border-vt-accent/60 bg-vt-accent/15 text-vt-accent" : "border-vt-line text-vt-muted hover:text-vt-text"}`}
                          >
                            {o}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </details>
            )}
          </section>
        );
      })}

      <button type="button" className={`${botaoClass} w-full`} onClick={() => onChange([...perguntas, { slug: novoSlug(perguntas), tipo: "texto", texto: "Nova pergunta" }])}>
        + Adicionar pergunta
      </button>
    </div>
  );
}
