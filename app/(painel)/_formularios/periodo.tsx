"use client";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { intervalo, PERIODOS, type Periodo } from "@/src/lib/formato";
import { selectClass } from "./ui";

type Ctx = { periodo: Periodo; setPeriodo: (p: Periodo) => void; range: { from: string; to: string }; refreshKey: number; refresh: () => void };

const PeriodoCtx = createContext<Ctx | null>(null);

/** Período escolhido (Início, Formulários, Respostas) e o "recarregar". Vale pro painel inteiro enquanto a aba está aberta. */
export function PeriodoProvider({ children }: { children: React.ReactNode }) {
  const [periodo, setPeriodo] = useState<Periodo>("30");
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- o refresh recalcula o "até agora"
  const range = useMemo(() => intervalo(periodo), [periodo, refreshKey]);
  return <PeriodoCtx.Provider value={{ periodo, setPeriodo, range, refreshKey, refresh }}>{children}</PeriodoCtx.Provider>;
}

export function usePeriodo(): Ctx {
  const ctx = useContext(PeriodoCtx);
  if (!ctx) throw new Error("usePeriodo fora do PeriodoProvider");
  return ctx;
}

export function SeletorPeriodo() {
  const { periodo, setPeriodo } = usePeriodo();
  return (
    <select className={selectClass} value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)} aria-label="Período">
      {PERIODOS.map((p) => (
        <option key={p.key} value={p.key}>
          {p.label}
        </option>
      ))}
    </select>
  );
}
