"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { checarAdmin } from "@/src/lib/permissoes";
import { TAG_MARCA } from "@/src/lib/marca-servidor";
import { arquivoMarcaValido, extensaoDoTipo, tipoDoArquivo, validarMarca } from "@/src/lib/regras/marca";
import { dbAdmin } from "@/src/lib/supabase/admin";

const ROTULO = { logo: "o logo", favicon: "o ícone da aba" } as const;

export async function salvarMarca(form: FormData): Promise<{ erro?: string }> {
  const r = await checarAdmin();
  if (!r.ok) return { erro: "Só Administradores mudam a marca." };
  const v = validarMarca({ nome: String(form.get("nome") ?? ""), cor: String(form.get("cor") ?? "") });
  if (!v.ok) return { erro: v.erro };

  const db = dbAdmin();
  const dados: Record<string, string | null> = { nome_sistema: v.nome, cor_principal: v.cor, updated_at: new Date().toISOString() };
  for (const campo of ["logo", "favicon"] as const) {
    const coluna = campo === "logo" ? "logo_url" : "favicon_url";
    if (form.get(`remover_${campo}`) === "1") {
      dados[coluna] = null;
      continue;
    }
    const arquivo = form.get(campo);
    if (!(arquivo instanceof File) || arquivo.size === 0) continue;
    const tipo = tipoDoArquivo(arquivo.type, arquivo.name);
    const erro = arquivoMarcaValido(tipo, arquivo.size, campo);
    if (erro) return { erro: `${campo === "logo" ? "Logo" : "Ícone da aba"}: ${erro}` };
    // Nome novo a cada envio: a URL muda e o navegador não mostra a imagem antiga do cache.
    const caminho = `${campo}-${Date.now()}.${extensaoDoTipo(tipo)}`;
    const { error } = await db.storage.from("marca").upload(caminho, arquivo, { contentType: tipo });
    if (error) return { erro: `Não foi possível enviar ${ROTULO[campo]}.` };
    dados[coluna] = db.storage.from("marca").getPublicUrl(caminho).data.publicUrl;
  }

  const { error } = await db.from("configuracao").update(dados).eq("id", true);
  if (error) return { erro: "Não foi possível salvar." };
  revalidateTag(TAG_MARCA);
  revalidatePath("/", "layout");
  return {};
}
