"use client";

import { useEffect, useState } from "react";

/** Link público de um formulário neste site. Começa sem domínio no servidor e completa no navegador. */
export function useLinkPublico() {
  const [origem, setOrigem] = useState("");
  useEffect(() => setOrigem(window.location.origin), []);
  return (slug: string) => `${origem}/${slug}`;
}

export const inputClass =
  "h-10 w-full rounded-lg border border-vt-line bg-vt-panel px-3 text-[14px] text-vt-text outline-none placeholder:text-vt-muted focus:border-vt-accent";
export const textareaClass =
  "w-full rounded-lg border border-vt-line bg-vt-panel px-3 py-2 text-[14px] text-vt-text outline-none placeholder:text-vt-muted focus:border-vt-accent";
export const botaoClass = "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-vt-line bg-vt-panel px-3 text-[13px] font-medium hover:bg-vt-panel-2 disabled:opacity-40";
export const botaoPrincipalClass = "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-vt-primario px-4 text-[13px] font-semibold text-white hover:bg-vt-primario-hover disabled:opacity-40";

export function Selo({ cor, children }: { cor: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-[12px] font-medium" style={{ borderColor: `${cor}55`, color: cor, background: `${cor}14` }}>
      <span className="size-1.5 rounded-full" style={{ background: cor }} />
      {children}
    </span>
  );
}

export function Campo({ label, dica, children }: { label: string; dica?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[13px] font-medium text-vt-text/90">{label}</span>
      {children}
      {dica && <span className="block text-[12px] text-vt-muted">{dica}</span>}
    </label>
  );
}

export function Aviso({ tipo = "ok", children }: { tipo?: "ok" | "erro" | "info"; children: React.ReactNode }) {
  const cls =
    tipo === "erro" ? "border-red-500/30 bg-red-500/10 text-red-300" : tipo === "info" ? "border-vt-line bg-vt-panel-2 text-vt-text/90" : "border-green-500/30 bg-green-500/10 text-green-300";
  return <div className={`rounded-xl border p-3 text-[14px] ${cls}`}>{children}</div>;
}

export function Numero({ label, valor, sub, cor }: { label: string; valor: React.ReactNode; sub?: React.ReactNode; cor?: string }) {
  return (
    <div className="rounded-2xl border border-vt-line bg-vt-panel p-4">
      <p className="text-[12px] text-vt-muted">{label}</p>
      <p className="mt-1 text-[26px] font-bold tracking-tight" style={cor ? { color: cor } : undefined}>
        {valor}
      </p>
      {sub && <p className="text-[12px] text-vt-muted">{sub}</p>}
    </div>
  );
}

export function baixarCsv(nome: string, conteudo: string) {
  const blob = new Blob(["﻿" + conteudo], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function Gaveta({ aberta, titulo, sub, onFechar, children }: { aberta: boolean; titulo: React.ReactNode; sub?: React.ReactNode; onFechar: () => void; children: React.ReactNode }) {
  if (!aberta) return null;
  return (
    <div className="fixed inset-0 z-50" onKeyDown={(e) => e.key === "Escape" && onFechar()}>
      <div className="absolute inset-0 bg-black/60" onClick={onFechar} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-vt-line bg-vt-bg shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-vt-line p-5">
          <div className="min-w-0">
            <h2 className="truncate text-[18px] font-bold">{titulo}</h2>
            {sub && <p className="text-[13px] text-vt-muted">{sub}</p>}
          </div>
          <button onClick={onFechar} className="rounded-lg p-1.5 text-vt-muted hover:bg-vt-panel-2 hover:text-vt-text" aria-label="Fechar">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto p-5">{children}</div>
      </aside>
    </div>
  );
}
