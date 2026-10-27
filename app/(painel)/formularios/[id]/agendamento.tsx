"use client";

import { useRef, useState } from "react";
import { testarAgenda, urlCall } from "@/src/lib/agendamento/call";
import { MENSAGEM_WHATSAPP_PADRAO, ROTULOS_TEXTOS_AGENDA, TEXTOS_AGENDA_PADRAO } from "@/src/lib/agendamento/padroes";
import type { Agendamento, TextosAgenda } from "@/src/lib/agendamento/tipos";
import { Aviso, botaoClass, Campo, inputClass, textareaClass } from "../../_formularios/comum";

/** Aba Agendamento: liga a agenda do Vórtex Call no fim do formulário (nulo = desligado). */
export function EditorAgendamento({ valor, onChange }: { valor: Agendamento | null; onChange: (v: Agendamento | null) => void }) {
  const base = urlCall();
  // desligar guarda o que estava preenchido, pra religar sem perder (enquanto a tela está aberta)
  const guardado = useRef<Agendamento | null>(valor);
  const [teste, setTeste] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [testando, setTestando] = useState(false);

  if (!base) {
    return (
      <div className="space-y-4 rounded-2xl border border-vt-line bg-vt-panel p-5">
        <Aviso tipo="info">
          Agendamento está desligado nesta cópia. Pra ligar, cadastre <code>NEXT_PUBLIC_VORTEX_CALL_URL</code> (endereço do seu sistema de agenda, ex.: https://agenda.suaempresa.com.br) nas variáveis do projeto na Vercel e publique de novo.
        </Aviso>
        <label className="flex items-center gap-2 text-[14px] opacity-50">
          <input type="checkbox" disabled checked={!!valor} />
          Marcar a reunião no Vórtex Call no fim do formulário
        </label>
      </div>
    );
  }

  const a: Agendamento = valor ?? { agenda: "" };
  const set = (p: Partial<Agendamento>) => onChange({ ...a, ...p });
  const setTexto = (k: keyof TextosAgenda, v: string) => set({ textos: { ...a.textos, [k]: v } });

  async function testar() {
    setTestando(true);
    setTeste(null);
    const r = await testarAgenda(base!, a.agenda.trim());
    setTeste(r.ok ? { tipo: "ok", texto: r.abertos ? `Agenda encontrada: ${r.abertos} ${r.abertos === 1 ? "horário aberto" : "horários abertos"}.` : "Agenda encontrada, mas sem horários abertos agora (o lead vê a bolha de sem horários)." } : { tipo: "erro", texto: r.erro });
    setTestando(false);
  }

  return (
    <div className="space-y-5 rounded-2xl border border-vt-line bg-vt-panel p-5">
      <label className="flex items-start gap-2 text-[14px]">
        <input
          type="checkbox"
          className="mt-1"
          checked={!!valor}
          onChange={(e) => {
            if (e.target.checked) onChange(guardado.current ?? { agenda: "" });
            else {
              guardado.current = valor;
              onChange(null);
            }
          }}
        />
        <span>
          Marcar a reunião no Vórtex Call no fim do formulário
          <span className="block text-[12px] text-vt-muted">Quem termina com perfil vê a agenda dentro da conversa. Sem perfil continua sem agenda.</span>
        </span>
      </label>

      {valor && (
        <>
          <Campo label="Endereço da agenda no Vórtex Call" dica={`É o final de ${base}/agendar/… (a agenda precisa estar ativa lá).`}>
            <div className="flex gap-2">
              <input className={inputClass} value={a.agenda} placeholder="reuniao-comercial" onChange={(e) => set({ agenda: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} />
              <button type="button" className={`${botaoClass} shrink-0`} disabled={!a.agenda.trim() || testando} onClick={() => void testar()}>
                {testando ? "Testando..." : "Testar"}
              </button>
            </div>
          </Campo>
          {teste && <Aviso tipo={teste.tipo}>{teste.texto}</Aviso>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="WhatsApp do botão de confirmar presença" dica="Só números, com o DDI 55 e o DDD na frente. Vazio = sem botão.">
              <input className={inputClass} inputMode="numeric" value={a.whatsapp ?? ""} onChange={(e) => set({ whatsapp: e.target.value.replace(/\D/g, "") || null })} />
            </Campo>
            <Campo label="Mensagem pronta da conversa">
              <input className={inputClass} value={a.mensagemWhatsapp ?? ""} placeholder={MENSAGEM_WHATSAPP_PADRAO} onChange={(e) => set({ mensagemWhatsapp: e.target.value || null })} />
            </Campo>
          </div>
          <label className={`flex items-start gap-2 text-[14px] ${a.whatsapp ? "" : "opacity-50"}`}>
            <input type="checkbox" className="mt-1" disabled={!a.whatsapp} checked={!!a.whatsapp && a.abrirWhatsappSozinho === true} onChange={(e) => set({ abrirWhatsappSozinho: e.target.checked || null })} />
            <span>
              Abrir o WhatsApp sozinho depois de reservar
              <span className="block text-[12px] text-vt-muted">
                {a.whatsapp ? "Desligado, a pessoa vê “Horário reservado!” e clica no botão quando quiser. Ligado, o WhatsApp abre 2 s depois. Dentro de iframe sempre fica só o botão." : "Precisa do WhatsApp do botão preenchido."}
              </span>
            </span>
          </label>
          <div className="space-y-4">
            <h3 className="text-[15px] font-semibold">Textos da agenda</h3>
            {ROTULOS_TEXTOS_AGENDA.map((r) => (
              <Campo key={r.key} label={r.label}>
                <textarea className={textareaClass} rows={2} value={a.textos?.[r.key] ?? TEXTOS_AGENDA_PADRAO[r.key]} onChange={(e) => setTexto(r.key, e.target.value)} />
              </Campo>
            ))}
            <button type="button" className={botaoClass} onClick={() => set({ textos: {} })}>
              Voltar pros textos padrão
            </button>
          </div>
        </>
      )}
    </div>
  );
}
