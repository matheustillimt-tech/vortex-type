"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Marca } from "@/src/lib/regras/marca";
import { Botao, Campo, estiloInput } from "../_componentes/ui";
import { salvarMarca } from "./actions";

function CampoArquivo({ nome, rotulo, dica, atual, aceita }: { nome: "logo" | "favicon"; rotulo: string; dica: string; atual: string | null; aceita: string }) {
  const [remover, setRemover] = useState(false);
  return (
    <Campo rotulo={rotulo} dica={dica}>
      <div className="flex flex-wrap items-center gap-3">
        {atual && !remover && (
          // eslint-disable-next-line @next/next/no-img-element -- prévia do arquivo do Storage
          <img src={atual} alt="" className="size-10 rounded-lg border border-vt-line object-contain" />
        )}
        <input type="file" name={nome} accept={aceita} disabled={remover} className="text-sm text-vt-text-2 file:mr-3 file:rounded-lg file:border-0 file:bg-vt-panel-2 file:px-3 file:py-1.5 file:text-vt-text" />
        {atual && (
          <label className="flex items-center gap-1.5 text-xs text-vt-muted">
            <input type="checkbox" name={`remover_${nome}`} value="1" checked={remover} onChange={(e) => setRemover(e.target.checked)} /> Remover
          </label>
        )}
      </div>
    </Campo>
  );
}

export function FormMarca({ marca }: { marca: Marca }) {
  const router = useRouter();
  const [nome, setNome] = useState(marca.nome);
  const [cor, setCor] = useState(marca.cor);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pendente, iniciar] = useTransition();

  function enviar(form: FormData) {
    iniciar(async () => {
      try {
        const r = await salvarMarca(form);
        setErro(r.erro ?? null);
        setSalvo(!r.erro);
        if (!r.erro) router.refresh();
      } catch {
        setErro("Não foi possível salvar. Tente um arquivo menor.");
        setSalvo(false);
      }
    });
  }

  return (
    <form action={enviar} className="max-w-xl space-y-5">
      <Campo rotulo="Nome do sistema" dica="Aparece no menu, no login e na aba do navegador.">
        <input name="nome" className={estiloInput} value={nome} maxLength={40} onChange={(e) => setNome(e.target.value)} required />
      </Campo>
      <Campo rotulo="Cor principal" dica="Botões, item ativo do menu e destaques.">
        <div className="flex items-center gap-2">
          <input type="color" aria-label="Escolher cor" value={cor} onChange={(e) => setCor(e.target.value)} className="h-9 w-12 cursor-pointer rounded-lg border border-vt-line bg-transparent" />
          <input name="cor" className={estiloInput} value={cor} maxLength={7} onChange={(e) => setCor(e.target.value)} />
        </div>
      </Campo>
      <CampoArquivo nome="logo" rotulo="Logo" dica="PNG, JPG, SVG ou WebP, até 1 MB. Quadrado fica melhor." atual={marca.logoUrl} aceita="image/png,image/jpeg,image/svg+xml,image/webp" />
      <CampoArquivo nome="favicon" rotulo="Ícone da aba (favicon)" dica="PNG, SVG ou ICO, até 1 MB." atual={marca.faviconUrl} aceita="image/png,image/jpeg,image/svg+xml,image/webp,image/x-icon,.ico" />
      {erro && <p className="text-sm text-vt-erro">{erro}</p>}
      {salvo && !erro && <p className="text-sm text-vt-ok">Marca salva.</p>}
      <Botao disabled={pendente}>{pendente ? "Salvando…" : "Salvar"}</Botao>
    </form>
  );
}
