/** Papéis e áreas do painel. Puro (sem Supabase). Admin vê tudo; Membro só Início, Formulários e Respostas. */

export type Papel = "admin" | "membro";
export type Area = "inicio" | "formularios" | "respostas" | "integracoes" | "equipe" | "configuracoes";

export const ROTULO_PAPEL: Record<Papel, string> = { admin: "Administrador", membro: "Membro" };

const SO_ADMIN: readonly Area[] = ["integracoes", "equipe", "configuracoes"];

export function pode(papel: Papel | null, area: Area): boolean {
  if (!papel) return false;
  return papel === "admin" || !SO_ADMIN.includes(area);
}

const AREA_DO_TRECHO: Record<string, Area> = {
  formularios: "formularios",
  respostas: "respostas",
  integracoes: "integracoes",
  equipe: "equipe",
  configuracoes: "configuracoes",
};

export function areaDoCaminho(caminho: string): Area | null {
  const primeiro = caminho.split("/")[1] ?? "";
  if (primeiro === "") return "inicio";
  return AREA_DO_TRECHO[primeiro] ?? null;
}

type ErroOuNull = string | null;

/** Nunca fica sem Administrador: não dá pra rebaixar o último. */
export function verificarMudancaPapel(args: { admins: string[]; alvo: string; novoPapel: Papel; eu: string }): ErroOuNull {
  const { admins, alvo, novoPapel } = args;
  if (novoPapel === "admin" || !admins.includes(alvo)) return null;
  if (admins.filter((id) => id !== alvo).length === 0) return "Precisa ficar pelo menos um Administrador.";
  return null;
}

/** Ninguém remove o próprio acesso; nunca fica sem Administrador. */
export function verificarRemocao(args: { admins: string[]; alvo: string; eu: string }): ErroOuNull {
  const { admins, alvo, eu } = args;
  if (alvo === eu) return "Você não pode remover o próprio acesso.";
  if (admins.includes(alvo) && admins.filter((id) => id !== alvo).length === 0) return "Precisa ficar pelo menos um Administrador.";
  return null;
}

export function ehUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

export function validarNovaSenha(senha: string, confirmacao: string): ErroOuNull {
  if (senha.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  if (senha !== confirmacao) return "As senhas não conferem.";
  return null;
}
