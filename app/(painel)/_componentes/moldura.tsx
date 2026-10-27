"use client";
import { useCallback, useRef, useState } from "react";
import type { Papel } from "@/src/lib/regras/acesso";
import type { Marca } from "@/src/lib/regras/marca";
import { Menu } from "./menu";
import { Topo } from "./topo";
import { PeriodoProvider } from "../_formularios/periodo";

/** Dona do estado da gaveta do menu (celular): Menu + Topo + conteúdo. */
export function Moldura({ marca, nome, email, papel, children }: { marca: Marca; nome: string; email: string; papel: Papel | null; children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const refBotaoMenu = useRef<HTMLButtonElement>(null);
  const fechar = useCallback((moverFoco: boolean = true) => {
    setAberto(false);
    if (moverFoco) refBotaoMenu.current?.focus();
  }, []);

  return (
    <>
      <Menu marca={marca} papel={papel} aberto={aberto} aoFechar={fechar} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topo nome={nome} email={email} papel={papel} refBotaoMenu={refBotaoMenu} aoAbrirMenu={() => setAberto(true)} menuAberto={aberto} />
        <main className="min-w-0 flex-1" style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}>
          <PeriodoProvider>{children}</PeriodoProvider>
        </main>
      </div>
    </>
  );
}
