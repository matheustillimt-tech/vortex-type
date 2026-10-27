import type { Papel } from "@/src/lib/regras/acesso";

/** Só os campos de `auth.admin.listUsers()` usados aqui. */
export type UsuarioAuthResumo = { id: string; email?: string | null; last_sign_in_at?: string | null };

export type LinhaMembroDb = { usuario_id: string; nome: string; papel: Papel };

export type MembroListado = {
  id: string;
  email: string | null;
  nome: string;
  papel: Papel;
  /** false = tem usuário no `auth.users` mas nenhuma linha em `membros` (aparece "Sem acesso"). */
  temAcesso: boolean;
  ultimoAcesso: string | null;
};

/** Junta `auth.admin.listUsers()` com `membros`. Administradores primeiro, depois por nome (ou e-mail). */
export function montarListaMembros(usuarios: UsuarioAuthResumo[], membros: LinhaMembroDb[]): MembroListado[] {
  const porId = new Map(membros.map((m) => [m.usuario_id, m]));
  const lista: MembroListado[] = usuarios.map((u) => {
    const m = porId.get(u.id);
    const nome = m?.nome?.trim();
    return { id: u.id, email: u.email ?? null, nome: nome || u.email || "Sem nome", papel: m?.papel ?? "membro", temAcesso: !!m, ultimoAcesso: u.last_sign_in_at ?? null };
  });
  return lista.sort((a, b) => {
    if (a.papel !== b.papel) return a.papel === "admin" ? -1 : 1;
    return a.nome.localeCompare(b.nome, "pt-BR");
  });
}
