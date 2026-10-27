"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import type { Papel } from "@/src/lib/regras/acesso";
import type { Marca } from "@/src/lib/regras/marca";
import { itensVisiveis, menuAtivo, type ItemMenu } from "@/src/lib/regras/menu";
import { MarcaVisual } from "@/app/_componentes/marca";
import { Icone } from "./icone";

function ItemDoMenu({ item, atual, onClick }: { item: ItemMenu; atual: string; onClick: () => void }) {
  const ativo = menuAtivo(item, atual);
  return (
    <Link
      href={item.href}
      title={item.rotulo}
      onClick={onClick}
      aria-current={ativo ? "page" : undefined}
      className={`relative flex h-10 items-center gap-4 rounded-md pl-[22px] pr-3 text-[13px] transition-colors ${ativo ? "text-vt-accent" : "text-vt-text-2 hover:bg-white/5 hover:text-white"}`}
    >
      {ativo && <span aria-hidden className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-vt-accent" />}
      <Icone nome={item.icone} tamanho={20} className={ativo ? "text-vt-accent" : ""} />
      <span className="truncate whitespace-nowrap md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">{item.rotulo}</span>
    </Link>
  );
}

/** Menu lateral: faixa de 64 px com ícones que abre com 230 px no hover (computador); gaveta no celular. */
export function Menu({ marca, papel, aberto, aoFechar }: { marca: Marca; papel: Papel | null; aberto: boolean; aoFechar: (moverFoco?: boolean) => void }) {
  const atual = usePathname();
  const itens = itensVisiveis(papel);

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") aoFechar();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberto, aoFechar]);

  return (
    <>
      {aberto && <div aria-hidden onClick={() => aoFechar()} className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] md:hidden" />}

      <aside className="sticky top-0 z-40 hidden h-screen w-16 shrink-0 md:block">
        <nav aria-label="Menu principal" className="group absolute inset-y-0 left-0 z-40 w-16 overflow-hidden bg-vt-side transition-[width] duration-200 hover:w-[230px] focus-within:w-[230px]">
          <div className="flex h-[52px] items-center pl-[18px] pr-2">
            <MarcaVisual marca={marca} comNome={false} />
            <span className="ml-2 truncate whitespace-nowrap text-[15px] font-semibold tracking-[-0.01em] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">{marca.nome}</span>
          </div>
          <div className="space-y-0.5 px-2 py-2">
            {itens.map((i) => (
              <ItemDoMenu key={i.href} item={i} atual={atual} onClick={() => aoFechar(false)} />
            ))}
          </div>
        </nav>
      </aside>

      <aside
        id="menu-lateral"
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col bg-vt-side px-2 py-4 transition-[transform,visibility] duration-200 md:hidden ${aberto ? "visible translate-x-0" : "invisible -translate-x-full"}`}
      >
        <div className="mb-5 flex items-center justify-between px-2.5">
          <MarcaVisual marca={marca} />
          <button type="button" onClick={() => aoFechar()} aria-label="Fechar menu" className="rounded-lg p-1.5 text-vt-text-2 hover:bg-white/5">
            <Icone nome="close" tamanho={16} />
          </button>
        </div>
        <nav aria-label="Menu principal" className="flex-1 space-y-0.5 overflow-y-auto">
          {itens.map((i) => (
            <ItemDoMenu key={i.href} item={i} atual={atual} onClick={() => aoFechar(false)} />
          ))}
        </nav>
      </aside>
    </>
  );
}
