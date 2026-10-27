import type { Marca } from "@/src/lib/regras/marca";
import { MarcaVisual } from "@/app/_componentes/marca";

/** Conversa de exemplo do banner: as falas entram uma por vez (classe `surgir`, globals.css). */
const CONVERSA = [
  { de: "bot", texto: "Oi! Antes de tudo, qual é o seu nome?" },
  { de: "pessoa", texto: "Mariana" },
  { de: "bot", texto: "Prazer, Mariana. Quanto a sua empresa fatura por mês?" },
  { de: "pessoa", texto: "Entre R$ 50 e 100 mil" },
] as const;

/** Lado esquerdo do login (só no computador): marca, frase e uma prévia de formulário em conversa. */
export function BannerLogin({ marca }: { marca: Marca }) {
  return (
    <section aria-hidden className="relative hidden overflow-hidden border-r border-vt-line bg-[#060807] lg:flex lg:flex-col lg:justify-between lg:p-12">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(70%_60%_at_50%_45%,#000,transparent)]" />
      <div className="pointer-events-none absolute left-1/2 top-[55%] size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-vt-accent/20 blur-[120px]" />

      <MarcaVisual marca={marca} tamanho={34} className="relative" />

      <div className="relative mx-auto w-full max-w-[440px]">
        <div className="space-y-2.5 rounded-2xl border border-white/10 bg-[#0d1310]/80 p-4 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] backdrop-blur">
          <div className="flex items-center justify-between px-1 pb-1">
            <span className="text-xs font-medium text-vt-text-2">Formulário · Aplicação</span>
            <span className="flex items-center gap-1.5 text-[11px] text-vt-ok">
              <span className="size-1.5 animate-pulse rounded-full bg-vt-ok" /> respondendo
            </span>
          </div>
          {CONVERSA.map((f, i) => (
            <div key={i} className={`surgir flex ${f.de === "pessoa" ? "justify-end" : "justify-start"}`} style={{ animationDelay: `${0.4 + i * 0.9}s` }}>
              <p className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[13px] leading-snug ${f.de === "pessoa" ? "rounded-br-md bg-vt-primario text-white" : "rounded-bl-md border border-white/[0.07] bg-white/[0.05] text-vt-text"}`}>
                {f.texto}
              </p>
            </div>
          ))}
          <div className="surgir flex gap-1 px-1 pt-1" style={{ animationDelay: `${0.4 + CONVERSA.length * 0.9}s` }}>
            {[0, 1, 2].map((p) => (
              <span key={p} className="size-1.5 animate-pulse rounded-full bg-vt-text-3" style={{ animationDelay: `${p * 0.2}s` }} />
            ))}
          </div>
        </div>

        <div className="absolute -right-6 -top-10 flex items-center gap-2.5 rounded-xl border border-white/10 bg-[#111a15] px-3 py-2.5 shadow-xl">
          <span className="grid size-7 place-items-center rounded-lg bg-vt-accent/15 text-vt-accent-3">
            <span className="material-icons text-[16px]">mark_chat_read</span>
          </span>
          <div className="leading-tight">
            <p className="text-[12px] font-medium">Nova resposta</p>
            <p className="text-[11px] text-vt-muted">Mariana · agora</p>
          </div>
        </div>
        <div className="absolute -bottom-8 -left-6 flex items-center gap-2.5 rounded-xl border border-white/10 bg-[#111a15] px-3 py-2.5 shadow-xl">
          <span className="grid size-7 place-items-center rounded-lg bg-vt-accent/15 text-vt-accent-3">
            <span className="material-icons text-[16px]">insights</span>
          </span>
          <div className="leading-tight">
            <p className="text-[12px] font-medium">Funil por pergunta</p>
            <p className="text-[11px] text-vt-muted">veja onde as pessoas param</p>
          </div>
        </div>
      </div>

      <div className="relative space-y-2">
        <h2 className="max-w-[440px] text-[28px] font-semibold leading-[1.15] tracking-[-0.02em]">
          Formulários que <span className="text-vt-accent-3">conversam</span> com o seu lead.
        </h2>
        <p className="max-w-[420px] text-sm leading-relaxed text-vt-text-2">
          Uma pergunta por vez, no ritmo de um chat. Mais gente chega até o fim e cada resposta cai na hora no seu painel.
        </p>
      </div>
    </section>
  );
}
