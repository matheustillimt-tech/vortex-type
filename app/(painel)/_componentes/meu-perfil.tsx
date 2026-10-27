"use client";
import { useState } from "react";
import { validarNovaSenha } from "@/src/lib/regras/acesso";
import { dbNavegador } from "@/src/lib/supabase/navegador";
import { Janela } from "./janela";
import { Botao, Campo, estiloInput } from "./ui";

/** Dados de quem está logado + troca de senha (quem recebeu a senha gerada pela Equipe troca aqui). */
export function MeuPerfil({ aoFechar, nome, email, papel }: { aoFechar: () => void; nome: string; email: string; papel: string }) {
  const [senhaAtual, setSenhaAtual] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function trocar(e: React.FormEvent) {
    e.preventDefault();
    if (!senhaAtual) return setAviso({ tipo: "erro", texto: "Informe a senha atual." });
    const erro = validarNovaSenha(senha, confirmacao);
    if (erro) return setAviso({ tipo: "erro", texto: erro });
    setSalvando(true);
    const db = dbNavegador();
    const { error: erroAtual } = await db.auth.signInWithPassword({ email, password: senhaAtual });
    if (erroAtual) {
      setSalvando(false);
      return setAviso({ tipo: "erro", texto: "Senha atual incorreta." });
    }
    const { error } = await db.auth.updateUser({ password: senha });
    setSalvando(false);
    if (error) return setAviso({ tipo: "erro", texto: "Não foi possível trocar a senha." });
    await db.auth.signOut({ scope: "others" });
    setSenhaAtual("");
    setSenha("");
    setConfirmacao("");
    setAviso({ tipo: "ok", texto: "Senha trocada." });
  }

  return (
    <Janela aberta aoFechar={aoFechar} titulo="Meu perfil" icone="account_circle">
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-vt-text-3">Nome</dt>
          <dd className="mt-0.5 font-medium">{nome || "—"}</dd>
        </div>
        <div>
          <dt className="text-vt-text-3">E-mail</dt>
          <dd className="mt-0.5 font-medium">{email}</dd>
        </div>
        <div>
          <dt className="text-vt-text-3">Papel</dt>
          <dd className="mt-0.5 font-medium">{papel}</dd>
        </div>
      </dl>
      <form onSubmit={trocar} className="mt-6 space-y-3 border-t border-vt-line pt-5">
        <h3 className="text-sm font-medium">Trocar senha</h3>
        <Campo rotulo="Senha atual">
          <input className={estiloInput} type="password" autoComplete="current-password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} />
        </Campo>
        <Campo rotulo="Nova senha">
          <input className={estiloInput} type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
        </Campo>
        <Campo rotulo="Repita a nova senha">
          <input className={estiloInput} type="password" autoComplete="new-password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} />
        </Campo>
        {aviso && <p className={`text-sm ${aviso.tipo === "ok" ? "text-vt-ok" : "text-vt-erro"}`}>{aviso.texto}</p>}
        <div className="flex justify-end gap-2">
          <Botao type="button" variante="secundario" onClick={aoFechar}>Fechar</Botao>
          <Botao disabled={salvando}>{salvando ? "Salvando…" : "Trocar senha"}</Botao>
        </div>
      </form>
    </Janela>
  );
}
