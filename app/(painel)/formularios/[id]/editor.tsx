"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Conversa } from "@/app/_componentes/conversa";
import { conferirAgendamento } from "@/src/lib/agendamento/padroes";
import { conferirPerguntas, slugify } from "@/src/lib/formulario/fluxo";
import { CORES_PADRAO, mesclar, ROTULOS_TEXTOS, TEXTOS_PADRAO } from "@/src/lib/formulario/padroes";
import { validarSlug } from "@/src/lib/formulario/slug";
import { codigoIframe } from "@/src/lib/formulario/incorporar";
import { conferirEnderecos } from "@/src/lib/formulario/enderecos";
import type { AcoesPixel, Formulario, Cores, Pixels, Textos } from "@/src/lib/formulario/tipos";
import { usePeriodo } from "../../_formularios/periodo";
import { ErrorBox, Loading } from "../../_formularios/ui";
import { Aviso, botaoClass, botaoPrincipalClass, Campo, inputClass, textareaClass, useLinkPublico } from "../../_formularios/comum";
import { dados } from "../../_formularios/dados";
import { EditorAgendamento } from "./agendamento";
import { EditorPerguntas } from "./perguntas";

const ABAS = ["Perguntas", "Aparência", "Textos", "Agendamento", "Pixels", "Publicação"] as const;
type Aba = (typeof ABAS)[number];

const ROTULO_COR: Record<keyof Cores, string> = {
  marca: "Barra do topo, botões e suas bolhas",
  marca2: "Botão de enviar (passando o mouse)",
  verde: "Barra de progresso",
  fundo: "Fundo da página",
  bolha: "Bolhas do bot",
  texto: "Texto",
};

const lista = (s: string) => s.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);

function Upload({ label, valor, onValor, pasta, dica }: { label: string; valor: string | null; onValor: (v: string | null) => void; pasta: string; dica: string }) {
  const [subindo, setSubindo] = useState(false);
  const [erro, setErro] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  return (
    <Campo label={label} dica={dica}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-14 min-w-28 items-center justify-center rounded-lg border border-vt-line bg-black px-3">
          {valor ? <img src={valor} alt="" className="max-h-9 max-w-48 object-contain" /> : <span className="text-[12px] text-vt-muted">sem imagem</span>}
        </div>
        <button type="button" className={botaoClass} disabled={subindo} onClick={() => ref.current?.click()}>
          {subindo ? "Enviando..." : "Enviar imagem"}
        </button>
        {valor && (
          <button type="button" className={botaoClass} onClick={() => onValor(null)}>
            Tirar
          </button>
        )}
        <input
          ref={ref}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            if (f.size > 2 * 1024 * 1024) return setErro("Imagem até 2 MB.");
            setErro("");
            setSubindo(true);
            try {
              onValor(await dados.subirArquivo(f, pasta));
            } catch (err) {
              setErro(err instanceof Error ? err.message : String(err));
            }
            setSubindo(false);
          }}
        />
      </div>
      <input className={`${inputClass} mt-2`} placeholder="ou cole o link da imagem" value={valor ?? ""} onChange={(e) => onValor(e.target.value || null)} />
      {erro && <span className="block text-[12px] text-red-300">{erro}</span>}
    </Campo>
  );
}

function EditorAcoes({ titulo, acoes, onChange }: { titulo: string; acoes: AcoesPixel; onChange: (a: AcoesPixel) => void }) {
  return (
    <div className="space-y-3 rounded-xl border border-vt-line p-4">
      <p className="text-[14px] font-semibold">{titulo}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo label="Meta" dica="ex.: Lead, CompleteRegistration">
          <input className={inputClass} value={acoes.meta.join(", ")} onChange={(e) => onChange({ ...acoes, meta: lista(e.target.value) })} />
        </Campo>
        <Campo label="TikTok" dica="ex.: SubmitForm">
          <input className={inputClass} value={acoes.tiktok.join(", ")} onChange={(e) => onChange({ ...acoes, tiktok: lista(e.target.value) })} />
        </Campo>
        <Campo label="Google Ads" dica="AW-123/rótulo da conversão">
          <input className={inputClass} value={acoes.google.join(", ")} onChange={(e) => onChange({ ...acoes, google: lista(e.target.value) })} />
        </Campo>
      </div>
    </div>
  );
}

export function Editor({ id }: { id: string }) {
  const linkPublico = useLinkPublico();
  const [iframeCopiado, setIframeCopiado] = useState(false);
  const { refreshKey } = usePeriodo();
  const [original, setOriginal] = useState<Formulario | null>(null);
  const [b, setB] = useState<Formulario | null>(null);
  const [erroCarga, setErroCarga] = useState<unknown>(null);
  const [carregou, setCarregou] = useState(false);
  const [aba, setAba] = useState<Aba>("Perguntas");
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [chavePrevia, setChavePrevia] = useState(0);

  useEffect(() => {
    dados
      .formulario(id)
      .then((x) => {
        setOriginal(x);
        setB(x);
        setCarregou(true);
      })
      .catch(setErroCarga);
  }, [id, refreshKey]);

  // a prévia recomeça sozinha um pouco depois de cada mudança
  const assinatura = useMemo(() => JSON.stringify(b), [b]);
  useEffect(() => {
    const t = setTimeout(() => setChavePrevia((k) => k + 1), 700);
    return () => clearTimeout(t);
  }, [assinatura]);

  const efetivo = useMemo(() => (b ? mesclar(b) : null), [b]);
  const erros = useMemo(() => (b ? conferirPerguntas(b.perguntas) : []), [b]);
  const mudou = assinatura !== JSON.stringify(original);

  useEffect(() => {
    const avisar = (e: BeforeUnloadEvent) => mudou && e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [mudou]);

  if (erroCarga) return <ErrorBox error={erroCarga} />;
  if (!b || !efetivo) return carregou ? <Aviso tipo="erro">Formulário não encontrado.</Aviso> : <Loading />;

  const set = (patch: Partial<Formulario>) => setB({ ...b, ...patch });
  const setTexto = (k: keyof Textos, v: string | string[]) => set({ textos: { ...b.textos, [k]: v } });
  const setCor = (k: keyof Cores, v: string) => set({ cores: { ...b.cores, [k]: v } });
  const pixels = efetivo.pixels;
  const setPixels = (p: Partial<Pixels>) => set({ pixels: { ...pixels, ...p } });

  async function salvar() {
    if (!b || erros.length) return;
    const slug = slugify(b.slug) || original!.slug;
    const erroSlug = validarSlug(slug);
    if (erroSlug) {
      setMsg({ tipo: "erro", texto: erroSlug });
      return;
    }
    const erroEndereco = conferirEnderecos(b);
    if (erroEndereco) {
      setMsg({ tipo: "erro", texto: erroEndereco });
      return;
    }
    const erroAgenda = conferirAgendamento(b.agendamento);
    if (erroAgenda) {
      setMsg({ tipo: "erro", texto: erroAgenda });
      return;
    }
    setSalvando(true);
    setMsg(null);
    try {
      const { id: _i, criado_em: _c, atualizado_em: _a, ...patch } = b;
      await dados.salvarFormulario(b.id, { ...patch, slug });
      setOriginal({ ...b, slug });
      setB({ ...b, slug });
      setMsg({ tipo: "ok", texto: "Salvo. A página pública atualiza em até 30 segundos." });
    } catch (e) {
      const t = e instanceof Error ? e.message : String(e);
      setMsg({ tipo: "erro", texto: t.includes("duplicate") ? "Já existe um formulário com esse endereço. Troque em Publicação." : t });
    }
    setSalvando(false);
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link href="/formularios" className="text-[13px] text-vt-muted hover:text-vt-text">
            ← Formulários
          </Link>
          <h1 className="truncate text-[24px] font-bold tracking-tight">{b.nome}</h1>
          <a href={linkPublico(original!.slug)} target="_blank" rel="noopener" className="text-[13px] text-vt-muted hover:text-vt-accent">
            {linkPublico(original!.slug)}
          </a>
        </div>
        <div className="flex items-center gap-2">
          {mudou && <span className="text-[12px] text-vt-accent">alterações não salvas</span>}
          <button type="button" className={botaoClass} disabled={!mudou} onClick={() => setB(original)}>
            Desfazer
          </button>
          <button type="button" className={botaoPrincipalClass} disabled={!mudou || salvando || erros.length > 0} onClick={() => void salvar()}>
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      {msg && (
        <div className="mb-4">
          <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>
        </div>
      )}
      {erros.length > 0 && (
        <div className="mb-4">
          <Aviso tipo="erro">
            Arrume antes de salvar:
            <ul className="mt-1 list-disc pl-5">
              {erros.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </Aviso>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          <nav className="mb-5 flex flex-wrap gap-1 rounded-lg border border-vt-line bg-vt-panel p-1" aria-label="Partes do formulário">
            {ABAS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAba(a)}
                className={`rounded-md px-3 py-1.5 text-[13px] font-semibold ${aba === a ? "bg-vt-accent/15 text-vt-accent ring-1 ring-vt-accent/60" : "text-vt-muted hover:text-vt-text"}`}
              >
                {a}
              </button>
            ))}
          </nav>

          {aba === "Perguntas" && <EditorPerguntas perguntas={b.perguntas} onChange={(perguntas) => set({ perguntas })} />}

          {aba === "Aparência" && (
            <div className="space-y-5 rounded-2xl border border-vt-line bg-vt-panel p-5">
              <Upload label="Logo da barra do topo" valor={b.logo_url} onValor={(v) => set({ logo_url: v })} pasta={`${b.slug}/logo`} dica="PNG ou SVG com fundo transparente, de preferência horizontal e clara (a barra é escura). Sem logo, aparece o nome." />
              <Upload label="Foto do bot (avatar)" valor={b.avatar_url} onValor={(v) => set({ avatar_url: v })} pasta={`${b.slug}/avatar`} dica="Quadrada. Rosto de quem atende passa mais confiança." />
              <div className="grid gap-3 sm:grid-cols-2">
                {(Object.keys(CORES_PADRAO) as (keyof Cores)[]).map((k) => (
                  <Campo key={k} label={ROTULO_COR[k]}>
                    <div className="flex gap-2">
                      <input type="color" className="h-10 w-12 cursor-pointer rounded-lg border border-vt-line bg-vt-panel" value={efetivo.cores[k]} onChange={(e) => setCor(k, e.target.value)} />
                      <input className={inputClass} value={b.cores[k] ?? ""} placeholder={CORES_PADRAO[k]} onChange={(e) => setCor(k, e.target.value)} />
                    </div>
                  </Campo>
                ))}
              </div>
              <button type="button" className={botaoClass} onClick={() => set({ cores: {} })}>
                Voltar pras cores padrão
              </button>
            </div>
          )}

          {aba === "Textos" && (
            <div className="space-y-6 rounded-2xl border border-vt-line bg-vt-panel p-5">
              {(["Fechamento"] as const).map((g) => (
                <div key={g} className="space-y-4">
                  <h3 className="text-[15px] font-semibold">{g}</h3>
                  {ROTULOS_TEXTOS.filter((r) => r.grupo === g).map((r) =>
                    r.key === "perfilIdeal" ? (
                      <Campo key={r.key} label={r.label}>
                        <textarea className={textareaClass} rows={3} value={(Array.isArray(b.textos.perfilIdeal) ? b.textos.perfilIdeal : TEXTOS_PADRAO.perfilIdeal).join("\n")} onChange={(e) => setTexto("perfilIdeal", e.target.value.split("\n"))} />
                      </Campo>
                    ) : (
                      <Campo key={r.key} label={r.label}>
                        <textarea className={textareaClass} rows={2} value={(b.textos[r.key] as string | undefined) ?? (TEXTOS_PADRAO[r.key] as string)} onChange={(e) => setTexto(r.key, e.target.value)} />
                      </Campo>
                    ),
                  )}
                </div>
              ))}
              <button type="button" className={botaoClass} onClick={() => set({ textos: {} })}>
                Voltar pros textos padrão
              </button>
            </div>
          )}

          {aba === "Agendamento" && <EditorAgendamento valor={b.agendamento ?? null} onChange={(agendamento) => set({ agendamento })} />}

          {aba === "Pixels" && (
            <div className="space-y-5 rounded-2xl border border-vt-line bg-vt-panel p-5">
              <p className="text-[13px] text-vt-muted">IDs separados por vírgula. Só carrega o pixel que tiver ID. O PageView dispara ao abrir a página.</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Campo label="Pixel da Meta">
                  <input className={inputClass} value={pixels.meta.join(", ")} onChange={(e) => setPixels({ meta: lista(e.target.value) })} placeholder="1771504616925012" />
                </Campo>
                <Campo label="Pixel do TikTok">
                  <input className={inputClass} value={pixels.tiktok.join(", ")} onChange={(e) => setPixels({ tiktok: lista(e.target.value) })} placeholder="C61D3J3A1SKNL8BP97A0" />
                </Campo>
                <Campo label="Google Ads (tag)">
                  <input className={inputClass} value={pixels.google.join(", ")} onChange={(e) => setPixels({ google: lista(e.target.value) })} placeholder="AW-968561720" />
                </Campo>
              </div>
              <EditorAcoes titulo="Quando a pessoa termina de responder" acoes={pixels.acoes.lead} onChange={(lead) => setPixels({ acoes: { ...pixels.acoes, lead } })} />
              <label className="flex items-start gap-2 text-[14px]">
                <input type="checkbox" className="mt-1" checked={pixels.leadSemPerfil} onChange={(e) => setPixels({ leadSemPerfil: e.target.checked })} />
                <span>
                  Disparar o evento de conversão também pra quem ficar sem perfil
                  <span className="block text-[12px] text-vt-muted">Desligado, só quem tem perfil vira Lead nas campanhas (melhor pra otimizar o tráfego pago).</span>
                </span>
              </label>
            </div>
          )}

          {aba === "Publicação" && (
            <div className="space-y-5 rounded-2xl border border-vt-line bg-vt-panel p-5">
              <label className="flex items-center gap-2 text-[14px]">
                <input type="checkbox" checked={b.ativo} onChange={(e) => set({ ativo: e.target.checked })} />
                No ar (desligado, o link mostra página não encontrada)
              </label>
              <Campo label="Nome (só aparece no painel)">
                <input className={inputClass} value={b.nome} onChange={(e) => set({ nome: e.target.value })} />
              </Campo>
              <Campo label="Endereço" dica={`${linkPublico(slugify(b.slug) || "...")} · trocar quebra os links que já foram pra bio`}>
                <input className={inputClass} value={b.slug} onChange={(e) => set({ slug: e.target.value.toLowerCase() })} onBlur={(e) => set({ slug: slugify(e.target.value) })} />
              </Campo>
              <Campo label="Colocar no seu site (iframe)" dica="Cole esse código na página do seu site onde o formulário deve aparecer. Ajuste a altura (height) se precisar.">
                <div className="flex items-start gap-2">
                  <textarea className={`${textareaClass} font-mono text-[12px]`} rows={3} readOnly value={codigoIframe(linkPublico(original!.slug))} onFocus={(e) => e.currentTarget.select()} />
                  <button type="button" className={`${botaoClass} shrink-0`} onClick={() => { void navigator.clipboard?.writeText(codigoIframe(linkPublico(original!.slug))); setIframeCopiado(true); setTimeout(() => setIframeCopiado(false), 1500); }}>
                    {iframeCopiado ? "Copiado!" : "Copiar"}
                  </button>
                </div>
              </Campo>
              <Campo label="Título da aba e da prévia do link (WhatsApp, Instagram)">
                <input className={inputClass} value={b.titulo_pagina ?? ""} onChange={(e) => set({ titulo_pagina: e.target.value || null })} />
              </Campo>
              <Campo label="Descrição da prévia do link">
                <textarea className={textareaClass} rows={2} value={b.descricao ?? ""} onChange={(e) => set({ descricao: e.target.value || null })} />
              </Campo>
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo label="Link da Política de Privacidade" dica="aparece embaixo dos campos de texto">
                  <input className={inputClass} value={b.privacidade_url ?? ""} onChange={(e) => set({ privacidade_url: e.target.value || null })} />
                </Campo>
                <Campo label="Link do Termo de Consentimento (opcional)">
                  <input className={inputClass} value={b.termos_url ?? ""} onChange={(e) => set({ termos_url: e.target.value || null })} />
                </Campo>
              </div>
            </div>
          )}
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[13px] font-semibold">Prévia (não grava nada)</p>
            <button type="button" className="text-[12px] text-vt-muted hover:text-vt-text" onClick={() => setChavePrevia((k) => k + 1)}>
              Recomeçar
            </button>
          </div>
          {/* transform faz o position:fixed da conversa ficar preso dentro da moldura */}
          <div className="relative mx-auto h-[680px] w-full max-w-[380px] overflow-hidden rounded-[28px] border-[6px] border-vt-panel-2 bg-white" style={{ transform: "translateZ(0)" }}>
            <Conversa key={chavePrevia} bot={b} previa />
          </div>
        </aside>
      </div>
    </div>
  );
}
