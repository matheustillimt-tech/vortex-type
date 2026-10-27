/** Peças de tela das telas de formulário, no visual do Vórtex Type. */

export const selectClass = "h-9 rounded-lg border border-vt-line bg-vt-panel px-2.5 text-[13px] text-vt-text outline-none focus:border-vt-accent";

export function PageTitle({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{title}</h1>
        {subtitle && <p className="text-[14px] text-vt-muted">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Panel({ title, subtitle, children, className = "", right }: { title?: string; subtitle?: string; children: React.ReactNode; className?: string; right?: React.ReactNode }) {
  return (
    <section className={`rounded-2xl border border-vt-line bg-vt-panel p-5 ${className}`}>
      {(title || right) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-[15px] font-semibold">{title}</h2>}
            {subtitle && <p className="text-[12px] text-vt-muted">{subtitle}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Loading() {
  return (
    <div className="flex justify-center py-10">
      <div className="size-6 animate-spin rounded-full border-2 border-vt-line border-t-vt-accent" />
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  const texto = error instanceof Error ? error.message : String(error);
  return <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-[14px] text-red-300">Não foi possível carregar: {texto}</div>;
}
