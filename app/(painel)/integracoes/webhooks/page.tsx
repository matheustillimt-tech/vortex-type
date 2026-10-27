import { dbAdmin } from "@/src/lib/supabase/admin";
import { bloqueio } from "../../_componentes/guarda";
import { ListaWebhooks, type EntregaListada, type WebhookListado } from "./lista";

export const dynamic = "force-dynamic";

export default async function Webhooks() {
  const b = await bloqueio("integracoes");
  if (b) return b;
  const db = dbAdmin();
  const [{ data: webhooks }, { data: formularios }, { data: entregas }] = await Promise.all([
    db.from("webhooks").select("id, nome, url, segredo, ativo, formularios, criado_em").order("criado_em"),
    db.from("formularios").select("id, nome").order("criado_em"),
    db.from("webhook_entregas").select("id, webhook_id, resposta_id, teste, status, tentativas, ultimo_status, ultimo_erro, criado_em, enviado_em").order("criado_em", { ascending: false }).limit(50),
  ]);
  return (
    <ListaWebhooks
      webhooks={(webhooks ?? []) as WebhookListado[]}
      formularios={(formularios ?? []) as { id: string; nome: string }[]}
      entregas={(entregas ?? []) as EntregaListada[]}
    />
  );
}
