"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { registroDns } from "@/src/lib/regras/dominio";
import { Botao, Campo, estiloAcao, estiloCartao, estiloCartaoDestaque, estiloInput, Selo, Vazio } from "../../_componentes/ui";
import { adicionarDominio, removerDominio, verificarDominio } from "./actions";

export type DominioListado = { id: string; host: string; formulario_id: string; status: "pendente" | "ativo" | "erro"; verificado_em: string | null; criado_em: string };
type Form = { id: string; nome: string; slug: string };

export function ListaDominios({ ligado, dominios, formularios }: { ligado: boolean; dominios: DominioListado[]; formularios: Form[] }) {
  const router = useRouter();
  const [host, setHost] = useState("");
  const [formulario, setFormulario] = useState(formularios[0]?.id ?? "");
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, iniciar] = useTransition();
  const nomeForm = new Map(formularios.map((f) => [f.id, f.nome]));

  function rodar(f: () => Promise<{ erro?: string; verificado?: boolean }>, ok?: (r: { verificado?: boolean }) => string) {
    setAviso(null);
    iniciar(async () => {
      try {
        const r = await f();
        if (r.erro) setAviso({ tipo: "erro", texto: r.erro });
        else if (ok) setAviso({ tipo: r.verificado === false ? "erro" : "ok", texto: ok(r) });
        router.refresh();
      } catch {
        setAviso({ tipo: "erro", texto: "Não foi possível salvar. Tente de novo." });
      }
    });
  }

  if (!ligado)
    return (
      <p className={`${estiloCartaoDestaque} p-4 text-sm`}>
        Domínios estão desligados nesta cópia. Pra ligar, cadastre <code>VERCEL_TOKEN</code>, <code>VERCEL_PROJECT_ID</code> e <code>VERCEL_TEAM_ID</code> nas variáveis do projeto na Vercel e publique de novo.
      </p>
    );

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-[13px] text-vt-muted">Coloque um formulário no domínio do cliente (ex.: aplicacao.cliente.com). Nesse domínio só o formulário abre; o painel continua só aqui.</p>
      <form
        className={`${estiloCartao} grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end`}
        onSubmit={(e) => {
          e.preventDefault();
          rodar(() => adicionarDominio(host, formulario), () => "Domínio adicionado. Agora crie o registro no DNS e clique em Verificar.");
          setHost("");
        }}
      >
        <Campo rotulo="Domínio">
          <input className={estiloInput} value={host} onChange={(e) => setHost(e.target.value)} placeholder="aplicacao.suaempresa.com" />
        </Campo>
        <Campo rotulo="Formulário">
          <select className={estiloInput} value={formulario} onChange={(e) => setFormulario(e.target.value)}>
            {formularios.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </Campo>
        <Botao disabled={ocupado || !host.trim() || !formulario}>Adicionar</Botao>
      </form>
      {aviso && <p className={`text-sm ${aviso.tipo === "ok" ? "text-vt-ok" : "text-vt-erro"}`}>{aviso.texto}</p>}
      {!dominios.length ? (
        <div className={estiloCartao}><Vazio texto="Nenhum domínio ainda." /></div>
      ) : (
        <div className="space-y-3">
          {dominios.map((d) => {
            const dns = registroDns(d.host);
            return (
              <section key={d.id} className={`${estiloCartao} space-y-2 p-4`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <a href={`https://${d.host}`} target="_blank" rel="noopener" className="text-[15px] font-semibold hover:text-vt-accent-3">{d.host}</a>
                    <p className="text-[12px] text-vt-muted">{nomeForm.get(d.formulario_id) ?? "formulário apagado"}</p>
                  </div>
                  <Selo cor={d.status === "ativo" ? "ok" : d.status === "erro" ? "erro" : "aviso"}>{d.status === "ativo" ? "No ar" : d.status === "erro" ? "Erro" : "Esperando o DNS"}</Selo>
                </div>
                {d.status !== "ativo" && (
                  <p className="text-[13px] text-vt-text-2">
                    No DNS do domínio, crie: <code>{dns.tipo}</code> com nome <code>{dns.nome}</code> e valor <code>{dns.valor}</code>. Pode levar alguns minutos pra valer.
                  </p>
                )}
                <div className="flex gap-3">
                  <button type="button" className={estiloAcao.normal} disabled={ocupado} onClick={() => rodar(() => verificarDominio(d.id), (r) => (r.verificado ? "Domínio no ar." : "Ainda não: o DNS não está apontando pra cá."))}>Verificar</button>
                  <button type="button" className={estiloAcao.perigo} disabled={ocupado} onClick={() => window.confirm(`Remover ${d.host}? O formulário sai desse domínio.`) && rodar(() => removerDominio(d.id))}>Remover</button>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
