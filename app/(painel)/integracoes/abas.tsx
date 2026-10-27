"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS = [
  { href: "/integracoes/webhooks", rotulo: "Webhooks" },
  { href: "/integracoes/api", rotulo: "API e MCP" },
  { href: "/integracoes/dominios", rotulo: "Domínios" },
];

export function AbasIntegracoes() {
  const atual = usePathname();
  return (
    <nav aria-label="Integrações" className="mb-6 flex flex-wrap gap-1 rounded-lg border border-vt-line bg-vt-panel p-1">
      {ABAS.map((a) => {
        const ativo = atual === a.href || atual.startsWith(`${a.href}/`);
        return (
          <Link
            key={a.href}
            href={a.href}
            aria-current={ativo ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-[13px] font-semibold ${ativo ? "bg-vt-accent/15 text-vt-accent ring-1 ring-vt-accent/60" : "text-vt-muted hover:text-vt-text"}`}
          >
            {a.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
