"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { fmtData } from "@/src/lib/formato";
import { Janela } from "../../_componentes/janela";
import { Botao, Campo, estiloAcao, estiloCartaoDestaque, estiloInput, Selo, Tabela } from "../../_componentes/ui";
import { criarChaveApi, revogarChaveApi } from "./actions";

export type ChaveListada = { id: string; nome: string; permissao: "leitura" | "escrita"; prefixo: string; ultimo_uso: string | null; revogada_em: string | null; criado_em: string };

function JanelaNovaChave({ base, aoFechar }: { base: string; aoFechar: () => void }) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [permissao, setPermissao] = useState<"leitura" | "escrita">("leitura");
  const [chave, setChave] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  function criar() {
    setErro(null);
    iniciar(async () => {
      const r = await criarChaveApi(nome, permissao);
      if (r.erro || !r.chave) return setErro(r.erro ?? "Não deu para criar a chave.");
      setChave(r.chave);
      router.refresh();
    });
  }

  if (chave)
    return (
      <Janela aberta aoFechar={aoFechar} titulo="Chave criada" icone="key">
        <div className="space-y-4 text-sm">
          <p className={`${estiloCartaoDestaque} p-3`}>Guarde a chave agora: ela não aparece de novo.</p>
          <code className="block select-all break-all rounded-lg border border-vt-line-2 bg-vt-panel-3 px-3 py-2">{chave}</code>
          <p className="text-vt-muted">Conectar no Claude Code (MCP):</p>
          <pre className="overflow-x-auto rounded-lg bg-black/30 p-3 text-[12px]">{`claude mcp add --transport http vortex-type ${base}/api/mcp --header "Authorization: Bearer ${chave}"`}</pre>
          <p className="text-vt-muted">Ou chamar a API:</p>
          <pre className="overflow-x-auto rounded-lg bg-black/30 p-3 text-[12px]">{`curl -H "Authorization: Bearer ${chave}" ${base}/api/v1/respostas`}</pre>
          <div className="flex justify-end gap-2">
            <Botao type="button" variante="secundario" onClick={() => void navigator.clipboard?.writeText(chave)}>Copiar chave</Botao>
            <Botao type="button" onClick={aoFechar}>Fechar</Botao>
          </div>
        </div>
      </Janela>
    );

  return (
    <Janela aberta aoFechar={aoFechar} titulo="Nova chave" icone="key">
      <div className="space-y-4">
        <Campo rotulo="Nome">
          <input className={estiloInput} value={nome} maxLength={60} onChange={(e) => setNome(e.target.value)} placeholder="Claude Code, n8n, BI…" autoFocus />
        </Campo>
        <fieldset className="space-y-2 text-sm">
          <legend className="text-[13px] text-vt-text-2">Permissão</legend>
          <label className="flex items-center gap-2"><input type="radio" checked={permissao === "leitura"} onChange={() => setPermissao("leitura")} /> Leitura (formulários, respostas e números)</label>
          <label className="flex items-center gap-2"><input type="radio" checked={permissao === "escrita"} onChange={() => setPermissao("escrita")} /> Leitura e escrita (também cria e edita formulários pelo MCP)</label>
        </fieldset>
        {erro && <p className="text-sm text-vt-erro">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Botao type="button" variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="button" disabled={ocupado} onClick={criar}>{ocupado ? "Criando…" : "Criar chave"}</Botao>
        </div>
      </div>
    </Janela>
  );
}

export function ListaChaves({ chaves, base }: { chaves: ChaveListada[]; base: string }) {
  const router = useRouter();
  const [nova, setNova] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  function revogar(c: ChaveListada) {
    if (!window.confirm(`Revogar a chave "${c.nome}"? Quem usa ela para de ter acesso na hora.`)) return;
    setErro(null);
    iniciar(async () => {
      try {
        const r = await revogarChaveApi(c.id);
        if (r.erro) setErro(r.erro);
        router.refresh();
      } catch {
        setErro("Não foi possível salvar. Tente de novo.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-[13px] text-vt-muted">
          A mesma chave vale pra API (<code>{base}/api/v1</code>) e pro MCP (<code>{base}/api/mcp</code>). Limite de 120 chamadas por minuto por chave. A chave para de valer se quem criou sair da equipe ou deixar de ser Administrador.
        </p>
        <Botao type="button" onClick={() => setNova(true)}>Nova chave</Botao>
      </div>
      {erro && <p className="text-sm text-vt-erro">{erro}</p>}
      <Tabela colunas={["Nome", "Chave", "Permissão", "Criada", "Último uso", ""]} vazio={chaves.length ? undefined : "Nenhuma chave ainda."}>
        {chaves.map((c) => (
          <tr key={c.id} className={c.revogada_em ? "opacity-50" : ""}>
            <td className="px-3 py-2.5">{c.nome}</td>
            <td className="px-3 py-2.5 font-mono text-[12px] text-vt-muted">vt_{c.prefixo}…</td>
            <td className="px-3 py-2.5"><Selo cor={c.permissao === "escrita" ? "aviso" : "neutro"}>{c.permissao === "escrita" ? "Leitura e escrita" : "Leitura"}</Selo></td>
            <td className="px-3 py-2.5 tabular-nums text-vt-muted">{fmtData(c.criado_em)}</td>
            <td className="px-3 py-2.5 tabular-nums text-vt-muted">{c.ultimo_uso ? fmtData(c.ultimo_uso) : "—"}</td>
            <td className="px-3 py-2.5 text-right">
              {c.revogada_em ? <span className="text-[12px] text-vt-muted">Revogada</span> : <button type="button" className={estiloAcao.perigo} disabled={ocupado} onClick={() => revogar(c)}>Revogar</button>}
            </td>
          </tr>
        ))}
      </Tabela>
      <section className={`${estiloCartaoDestaque} space-y-1 p-4 text-[13px]`}>
        <h2 className="font-semibold">Endereços da API</h2>
        <pre className="overflow-x-auto text-[12px]">{`GET ${base}/api/v1/formularios
GET ${base}/api/v1/formularios/{id}
GET ${base}/api/v1/formularios/{id}/metricas?de=AAAA-MM-DD&ate=AAAA-MM-DD
GET ${base}/api/v1/respostas?formulario={id}&status=completo&de=AAAA-MM-DD&ate=AAAA-MM-DD&limite=100&antes={proximo}
GET ${base}/api/v1/respostas/{id}`}</pre>
      </section>
      {nova && <JanelaNovaChave base={base} aoFechar={() => setNova(false)} />}
    </div>
  );
}
