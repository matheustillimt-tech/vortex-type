"use server";
import { revalidatePath } from "next/cache";
import { senhaAleatoria } from "@/src/lib/crypto";
import { checarAdmin } from "@/src/lib/permissoes";
import { ehUuid, verificarMudancaPapel, verificarRemocao, type Papel } from "@/src/lib/regras/acesso";
import { dbAdmin } from "@/src/lib/supabase/admin";

const SO_ADMIN = "Só Administradores mudam a equipe.";

/** `null` se a leitura falhar: sem a lista certa as travas de "último Administrador" não valem, então a ação para. */
async function listarAdmins(): Promise<string[] | null> {
  const { data, error } = await dbAdmin().from("membros").select("usuario_id").eq("papel", "admin");
  if (error) return null;
  return ((data ?? []) as { usuario_id: string }[]).map((m) => m.usuario_id);
}

function papelValido(v: unknown): v is Papel {
  return v === "admin" || v === "membro";
}

export type ResultadoCriarAcesso = { erro?: string; aviso?: string; senha?: string };

/** Cria o acesso já confirmado, com senha gerada aqui (volta só nesta resposta: não é salva nem logada) e grava
 *  nome e papel em `membros` (sem linha lá, a pessoa não acessa nada). */
export async function criarAcesso(email: string, nome: string, papel: Papel): Promise<ResultadoCriarAcesso> {
  const r = await checarAdmin();
  if (!r.ok) return { erro: SO_ADMIN };
  const e = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return { erro: "E-mail inválido." };
  const n = nome.trim().slice(0, 60);
  if (!n) return { erro: "Nome é obrigatório." };
  if (!papelValido(papel)) return { erro: "Papel inválido." };

  const senha = senhaAleatoria(16);
  const db = dbAdmin();
  const { data, error } = await db.auth.admin.createUser({ email: e, password: senha, email_confirm: true });
  if (error) return { erro: error.message.includes("already") ? "Esse e-mail já tem acesso." : "Não foi possível criar o acesso." };
  const usuarioId = data?.user?.id;
  if (!usuarioId) return { erro: "Não foi possível criar o acesso." };

  const { error: erroUpsert } = await db.from("membros").upsert({ usuario_id: usuarioId, nome: n, papel }, { onConflict: "usuario_id" });
  revalidatePath("/equipe");
  if (erroUpsert) return { senha, aviso: "O papel não pôde ser salvo agora. Edite essa pessoa pra corrigir." };
  return { senha };
}

export async function editarMembro(usuarioId: string, dados: { nome: string; papel: Papel }): Promise<{ erro?: string }> {
  const r = await checarAdmin();
  if (!r.ok) return { erro: SO_ADMIN };
  if (!ehUuid(usuarioId)) return { erro: "Pessoa inválida." };
  const n = dados.nome.trim().slice(0, 60);
  if (!n) return { erro: "Nome é obrigatório." };
  if (!papelValido(dados.papel)) return { erro: "Papel inválido." };

  const admins = await listarAdmins();
  if (!admins) return { erro: "Não foi possível conferir os administradores. Tente de novo." };
  const erroPapel = verificarMudancaPapel({ admins, alvo: usuarioId, novoPapel: dados.papel, eu: r.usuario.id });
  if (erroPapel) return { erro: erroPapel };

  const db = dbAdmin();
  const { data: usuario, error: erroUsuario } = await db.auth.admin.getUserById(usuarioId);
  if (erroUsuario || !usuario?.user) return { erro: "Pessoa não encontrada." };

  // upsert (não update): quem tem login no auth mas ainda não tem linha em `membros` ("Sem acesso" na lista) também pode receber acesso aqui.
  const { error } = await db
    .from("membros")
    .upsert({ usuario_id: usuarioId, nome: n, papel: dados.papel, updated_at: new Date().toISOString() }, { onConflict: "usuario_id" });
  if (error) return { erro: "Não foi possível salvar." };
  // Admin que vira membro perde as chaves de API/MCP (só admin cria chave; a chave tem acesso de admin).
  if (dados.papel === "membro" && admins.includes(usuarioId)) {
    const chaves = await db.from("chaves_api").update({ revogada_em: new Date().toISOString() }).eq("criada_por", usuarioId).is("revogada_em", null);
    if (chaves.error) {
      revalidatePath("/equipe");
      return { erro: "O papel foi salvo, mas não deu para revogar as chaves de API dessa pessoa. Revogue em Integrações." };
    }
  }
  revalidatePath("/equipe");
  return {};
}

export async function removerAcesso(usuarioId: string): Promise<{ erro?: string }> {
  const r = await checarAdmin();
  if (!r.ok) return { erro: SO_ADMIN };
  if (!ehUuid(usuarioId)) return { erro: "Pessoa inválida." };

  const admins = await listarAdmins();
  if (!admins) return { erro: "Não foi possível conferir os administradores. Tente de novo." };
  const erro = verificarRemocao({ admins, alvo: usuarioId, eu: r.usuario.id });
  if (erro) return { erro };

  // As chaves de API/MCP dessa pessoa param de valer antes do acesso sumir (depois o criada_por vira null).
  const chaves = await dbAdmin().from("chaves_api").update({ revogada_em: new Date().toISOString() }).eq("criada_por", usuarioId).is("revogada_em", null);
  if (chaves.error) return { erro: "Não foi possível revogar as chaves de API dessa pessoa. Tente de novo." };

  const { error } = await dbAdmin().auth.admin.deleteUser(usuarioId);
  if (error) return { erro: "Não foi possível remover o acesso dessa pessoa." };
  revalidatePath("/equipe");
  return {};
}
