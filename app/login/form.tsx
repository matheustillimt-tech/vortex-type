"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { dbNavegador } from "@/src/lib/supabase/navegador";
import type { Marca } from "@/src/lib/regras/marca";
import { MarcaVisual } from "@/app/_componentes/marca";
import { Botao, Campo, estiloInput } from "../(painel)/_componentes/ui";

export function FormLogin({ marca }: { marca: Marca }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro(null);
    const { error } = await dbNavegador().auth.signInWithPassword({ email, password: senha });
    setCarregando(false);
    if (error) return setErro("E-mail ou senha incorretos.");
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={entrar} className="w-full max-w-sm space-y-6">
      <div className="space-y-5">
        <MarcaVisual marca={marca} tamanho={40} className="lg:hidden" />
        <div className="space-y-1">
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Entrar</h1>
          <p className="text-sm text-vt-muted">Use o acesso que a sua equipe criou pra você.</p>
        </div>
      </div>
      <div className="space-y-3">
        <Campo rotulo="E-mail">
          <input className={estiloInput} type="email" autoComplete="email" placeholder="voce@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Campo>
        <Campo rotulo="Senha">
          <input className={estiloInput} type="password" autoComplete="current-password" placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        </Campo>
      </div>
      {erro && <p className="text-sm text-vt-erro">{erro}</p>}
      <Botao disabled={carregando} className="w-full">{carregando ? "Entrando…" : "Entrar"}</Botao>
    </form>
  );
}
