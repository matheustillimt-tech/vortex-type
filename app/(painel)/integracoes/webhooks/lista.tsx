"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { fmtData } from "@/src/lib/formato";
import { Janela } from "../../_componentes/janela";
import { Botao, Campo, estiloAcao, estiloBotao, estiloCartao, estiloCartaoDestaque, estiloInput, Selo, Tabela, Vazio } from "../../_componentes/ui";
import { alternarWebhook, apagarWebhook, reenviarEntrega, salvarWebhook, testarWebhook, trocarSegredo } from "./actions";

export type WebhookListado = { id: string; nome: string; url: string; segredo: string; ativo: boolean; formularios: string[] | null; criado_em: string };
export type EntregaListada = { id: number; webhook_id: string; resposta_id: string | null; teste: boolean; status: "pendente" | "enviado" | "falhou"; tentativas: number; ultimo_status: number | null; ultimo_erro: string | null; criado_em: string; enviado_em: string | null };
type Form = { id: string; nome: string };

const COR_STATUS = { pendente: "aviso", enviado: "ok", falhou: "erro" } as const;
const ROTULO_STATUS = { pendente: "Na fila", enviado: "Entregue", falhou: "Falhou" } as const;

function JanelaWebhook({ inicial, formularios, aoFechar }: { inicial: WebhookListado | null; formularios: Form[]; aoFechar: () => void }) {
  const router = useRouter();
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [url, setUrl] = useState(inicial?.url ?? "");
  const [todos, setTodos] = useState(inicial ? inicial.formularios === null : true);
  const [escolhidos, setEscolhidos] = useState<string[]>(inicial?.formularios ?? []);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  function salvar() {
    setErro(null);
    iniciar(async () => {
      const r = await salvarWebhook({ id: inicial?.id, nome, url, formularios: todos ? null : escolhidos });
      if (r.erro) return setErro(r.erro);
      aoFechar();
      router.refresh();
    });
  }

  return (
    <Janela aberta aoFechar={aoFechar} titulo={inicial ? "Editar webhook" : "Novo webhook"} icone="webhook">
      <div className="space-y-4">
        <Campo rotulo="Nome">
          <input className={estiloInput} value={nome} maxLength={60} onChange={(e) => setNome(e.target.value)} placeholder="CRM, n8n, planilha…" autoFocus />
        </Campo>
        <Campo rotulo="Endereço (https://)" dica="Recebe um POST com a resposta assim que a pessoa termina o formulário.">
          <input className={estiloInput} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://n8n.suaempresa.com/webhook/..." />
        </Campo>
        <fieldset className="space-y-2">
          <legend className="text-[13px] text-vt-text-2">Formulários</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} /> Todos (inclusive os que forem criados depois)
          </label>
          {!todos &&
            formularios.map((f) => (
              <label key={f.id} className="ml-5 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={escolhidos.includes(f.id)} onChange={(e) => setEscolhidos((l) => (e.target.checked ? [...l, f.id] : l.filter((x) => x !== f.id)))} />
                {f.nome}
              </label>
            ))}
        </fieldset>
        {erro && <p className="text-sm text-vt-erro">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Botao type="button" variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="button" disabled={ocupado} onClick={salvar}>{ocupado ? "Salvando…" : "Salvar"}</Botao>
        </div>
      </div>
    </Janela>
  );
}

export function ListaWebhooks({ webhooks, formularios, entregas }: { webhooks: WebhookListado[]; formularios: Form[]; entregas: EntregaListada[] }) {
  const router = useRouter();
  const [janela, setJanela] = useState<WebhookListado | "novo" | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [verSegredo, setVerSegredo] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const nomeForm = new Map(formularios.map((f) => [f.id, f.nome]));
  const nomeWebhook = new Map(webhooks.map((w) => [w.id, w.nome]));

  function rodar(f: () => Promise<{ erro?: string; resultado?: string }>, confirmar?: string) {
    if (confirmar && !window.confirm(confirmar)) return;
    setAviso(null);
    iniciar(async () => {
      try {
        const r = await f();
        if (r.erro) setAviso({ tipo: "erro", texto: r.erro });
        else if (r.resultado) setAviso({ tipo: r.resultado.startsWith("Entregue") ? "ok" : "erro", texto: r.resultado });
        router.refresh();
      } catch {
        setAviso({ tipo: "erro", texto: "Não foi possível salvar. Tente de novo." });
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-[13px] text-vt-muted">
          Quando alguém termina um formulário, o sistema manda um POST pro endereço do webhook com as respostas. Se falhar, tenta de novo até 5 vezes (1, 5, 30 e 120 minutos depois).
        </p>
        <Botao type="button" onClick={() => setJanela("novo")}>Novo webhook</Botao>
      </div>

      {aviso && <p className={`text-sm ${aviso.tipo === "ok" ? "text-vt-ok" : "text-vt-erro"}`}>{aviso.texto}</p>}

      {!webhooks.length ? (
        <div className={estiloCartao}><Vazio texto="Nenhum webhook ainda." detalhe="Crie um pra mandar as respostas pro seu CRM, n8n ou Make." /></div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((w) => (
            <section key={w.id} className={`${estiloCartao} space-y-3 p-4`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-[15px] font-semibold">{w.nome}</h2>
                  <p className="truncate text-[13px] text-vt-muted">{w.url}</p>
                  <p className="text-[12px] text-vt-text-3">{w.formularios === null ? "Todos os formulários" : w.formularios.map((id) => nomeForm.get(id) ?? "formulário apagado").join(", ")}</p>
                </div>
                <Selo cor={w.ativo ? "ok" : "neutro"}>{w.ativo ? "Ligado" : "Desligado"}</Selo>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                <span className="text-vt-muted">Segredo da assinatura:</span>
                <code className="rounded bg-vt-panel-3 px-2 py-0.5">{verSegredo === w.id ? w.segredo : "vtw_••••••••"}</code>
                <button type="button" className={estiloAcao.normal} onClick={() => setVerSegredo(verSegredo === w.id ? null : w.id)}>{verSegredo === w.id ? "Esconder" : "Mostrar"}</button>
                <button type="button" className={estiloAcao.normal} onClick={() => void navigator.clipboard?.writeText(w.segredo)}>Copiar</button>
                <button type="button" className={estiloAcao.perigo} disabled={ocupado} onClick={() => rodar(() => trocarSegredo(w.id), "Gerar um segredo novo? Quem confere a assinatura vai precisar do novo.")}>Gerar outro</button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={estiloBotao("contorno")} disabled={ocupado} onClick={() => rodar(() => testarWebhook(w.id))}>Testar</button>
                <button type="button" className={estiloBotao("contorno")} onClick={() => setJanela(w)}>Editar</button>
                <button type="button" className={estiloBotao("contorno")} disabled={ocupado} onClick={() => rodar(() => alternarWebhook(w.id, !w.ativo))}>{w.ativo ? "Desligar" : "Ligar"}</button>
                <button type="button" className={estiloAcao.perigo} disabled={ocupado} onClick={() => rodar(() => apagarWebhook(w.id), `Apagar o webhook "${w.nome}"? O histórico de entregas dele também some.`)}>Apagar</button>
              </div>
            </section>
          ))}
        </div>
      )}

      <section className="space-y-2">
        <h2 className="text-[15px] font-semibold">Últimas entregas</h2>
        <Tabela colunas={["Quando", "Webhook", "O quê", "Situação", "Tentativas", "Retorno", ""]} vazio={entregas.length ? undefined : "Nenhuma entrega ainda."}>
          {entregas.map((e) => (
            <tr key={e.id}>
              <td className="px-3 py-2.5 tabular-nums text-vt-muted">{fmtData(e.criado_em)}</td>
              <td className="px-3 py-2.5">{nomeWebhook.get(e.webhook_id) ?? "—"}</td>
              <td className="px-3 py-2.5 text-vt-muted">{e.teste ? "Teste" : "Resposta"}</td>
              <td className="px-3 py-2.5"><Selo cor={COR_STATUS[e.status]}>{ROTULO_STATUS[e.status]}</Selo></td>
              <td className="px-3 py-2.5 tabular-nums">{e.tentativas}</td>
              <td className="px-3 py-2.5 text-[12px] text-vt-muted">{e.ultimo_erro ?? (e.ultimo_status ? `HTTP ${e.ultimo_status}` : "—")}</td>
              <td className="px-3 py-2.5 text-right">
                <button type="button" className={estiloAcao.normal} disabled={ocupado} onClick={() => rodar(() => reenviarEntrega(e.id))}>Reenviar</button>
              </td>
            </tr>
          ))}
        </Tabela>
      </section>

      <section className={`${estiloCartaoDestaque} space-y-2 p-4 text-[13px]`}>
        <h2 className="font-semibold">Como conferir que o aviso veio daqui</h2>
        <p>
          Todo POST traz o cabeçalho <code>X-Vortex-Type-Assinatura: sha256=…</code>, que é o HMAC-SHA256 do corpo com o segredo do webhook. Também vêm <code>X-Vortex-Type-Evento</code> (sempre <code>resposta.concluida</code>) e <code>X-Vortex-Type-Entrega</code> (número da entrega; o mesmo número pode chegar de novo numa nova tentativa).
        </p>
        <pre className="overflow-x-auto rounded-lg bg-black/30 p-3 text-[12px]">{`const esperado = "sha256=" + crypto.createHmac("sha256", SEGREDO).update(corpoCru).digest("hex");
if (esperado !== req.headers["x-vortex-type-assinatura"]) return 401;`}</pre>
      </section>

      {janela && <JanelaWebhook inicial={janela === "novo" ? null : janela} formularios={formularios} aoFechar={() => setJanela(null)} />}
    </div>
  );
}
