"use client";
import { useId } from "react";
import type { Marca } from "@/src/lib/regras/marca";

/** Símbolo padrão do Vórtex Type (cópia sem logo própria): "T" com a barra em três pontos de "digitando…". */
export function SimboloType({ tamanho = 28, className = "" }: { tamanho?: number; className?: string }) {
  // Id próprio por cópia: degradê num SVG escondido (banner no celular) não pode apagar a cor das outras cópias.
  const id = `vt${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 32 32" aria-hidden className={`shrink-0 ${className}`}>
      <defs>
        <linearGradient id={`${id}f`} x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2bd391" />
          <stop offset="0.55" stopColor="#13a066" />
          <stop offset="1" stopColor="#0b5e3c" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${id}f)`} />
      <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" fill="none" stroke="#fff" strokeOpacity="0.14" />
      <path d="M16 12.5v11" fill="none" stroke="#fff" strokeWidth="3.1" strokeLinecap="round" />
      <circle cx="10.5" cy="9.5" r="1.7" fill="#fff" fillOpacity="0.55" />
      <circle cx="16" cy="9.5" r="1.7" fill="#fff" fillOpacity="0.78" />
      <circle cx="21.5" cy="9.5" r="1.7" fill="#fff" />
    </svg>
  );
}

/** Logo da marca (ou o símbolo padrão) + nome do sistema. */
export function MarcaVisual({ marca, tamanho = 28, comNome = true, className = "" }: { marca: Marca; tamanho?: number; comNome?: boolean; className?: string }) {
  return (
    <span className={`flex items-center gap-2 ${comNome ? "min-w-0" : "shrink-0"} ${className}`}>
      {marca.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- logo vem do Storage do cliente, tamanho fixo
        <img src={marca.logoUrl} alt="" className="shrink-0 max-w-none rounded-[9px] object-contain" style={{ width: tamanho, height: tamanho }} />
      ) : (
        <SimboloType tamanho={tamanho} />
      )}
      {comNome && (
        <span className="truncate font-semibold tracking-[-0.02em]" style={{ fontSize: tamanho * 0.56 }}>
          {marca.nome}
        </span>
      )}
    </span>
  );
}
