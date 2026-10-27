import { dbAdmin } from "@/src/lib/supabase/admin";
import { exigirUsuario } from "@/src/lib/supabase/usuario";
import { bloqueio } from "../_componentes/guarda";
import { Pagina, estiloCartaoDestaque } from "../_componentes/ui";
import { montarListaMembros, type LinhaMembroDb, type UsuarioAuthResumo } from "./comum";
import { BotaoAdicionar } from "./convidar";
import { BotaoAtualizar, ListaEquipe } from "./lista";

export const dynamic = "force-dynamic";

export default async function Equipe() {
  const b = await bloqueio("equipe");
  if (b) return b;
  const eu = await exigirUsuario();
  const db = dbAdmin();
  const [{ data: usuarios }, { data: membros }] = await Promise.all([
    db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    db.from("membros").select("usuario_id, nome, papel"),
  ]);
  const lista = montarListaMembros((usuarios?.users ?? []) as UsuarioAuthResumo[], (membros ?? []) as LinhaMembroDb[]);

  return (
    <Pagina titulo="Equipe" acoes={<><BotaoAtualizar /><BotaoAdicionar /></>}>
      <p className={`${estiloCartaoDestaque} p-3 text-sm`}>
        <strong>Administradores</strong> veem e mudam tudo, inclusive a equipe, a marca e as integrações.{" "}
        <strong>Membros</strong> veem Início, Formulários e Respostas.
      </p>
      <ListaEquipe membros={lista} euId={eu.id} />
    </Pagina>
  );
}
