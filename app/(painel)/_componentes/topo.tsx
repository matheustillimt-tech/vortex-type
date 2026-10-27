"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ROTULO_PAPEL, type Papel } from "@/src/lib/regras/acesso";
import { dbNavegador } from "@/src/lib/supabase/navegador";
import { Icone } from "./icone";
import { MeuPerfil } from "./meu-perfil";

function iniciais(texto: string): string {
  const partes = texto.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return ((partes[0]?.[0] ?? "?") + (partes[1]?.[0] ?? "")).toUpperCase();
}

/** Barra do topo: ☰ no celular e o menu da pessoa (Meu perfil, Sair). */
export function Topo({ nome, email, papel, refBotaoMenu, aoAbrirMenu, menuAberto }: {
  nome: string;
  email: string;
  papel: Papel | null;
  refBotaoMenu: React.RefObject<HTMLButtonElement | null>;
  aoAbrirMenu: () => void;
  menuAberto: boolean;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [perfil, setPerfil] = useState(false);
  const refCaixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (!refCaixa.current?.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    window.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      window.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  async function sair() {
    await dbNavegador().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const item = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-vt-text-2 transition-colors hover:bg-white/5 hover:text-white";

  return (
    <>
      <header className="sticky top-0 z-30 flex h-[52px] items-center gap-2 border-b border-vt-line bg-vt-bg/90 px-4 backdrop-blur">
        <button ref={refBotaoMenu} type="button" onClick={aoAbrirMenu} aria-label="Abrir menu" aria-controls="menu-lateral" aria-expanded={menuAberto} className="rounded-lg p-1.5 text-vt-text-2 hover:bg-white/5 md:hidden">
          <Icone nome="menu" tamanho={20} />
        </button>
        <div className="flex-1" />
        <div ref={refCaixa} className="relative">
          <button type="button" onClick={() => setAberto((v) => !v)} aria-haspopup="menu" aria-expanded={aberto} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5">
            <span className="grid size-7 place-items-center rounded-full bg-vt-primario text-[11px] font-semibold text-white">{iniciais(nome || email)}</span>
            <span className="hidden max-w-[180px] truncate text-sm sm:block">{nome || email}</span>
            <Icone nome="expand_more" tamanho={18} className="text-vt-muted" />
          </button>
          {aberto && (
            <div role="menu" className="absolute right-0 mt-1 w-60 rounded-xl border border-vt-line bg-vt-panel p-1 shadow-xl">
              <p className="truncate px-3 py-2 text-xs text-vt-muted">{email}</p>
              <button role="menuitem" type="button" className={item} onClick={() => { setAberto(false); setPerfil(true); }}>
                <Icone nome="account_circle" tamanho={16} className="opacity-70" /> Meu perfil
              </button>
              <button role="menuitem" type="button" className={item} onClick={sair}>
                <Icone nome="logout" tamanho={16} className="opacity-70" /> Sair
              </button>
            </div>
          )}
        </div>
      </header>
      {perfil && <MeuPerfil aoFechar={() => setPerfil(false)} nome={nome} email={email} papel={papel ? ROTULO_PAPEL[papel] : "Sem acesso"} />}
    </>
  );
}
