"use client";

/**
 * Dados dos formulários no painel: lê e grava direto nas tabelas (RLS: quem está em `membros`).
 */
import { dbNavegador } from "@/src/lib/supabase/navegador";
import type { Formulario, RespostaLinha } from "@/src/lib/formulario/tipos";

export type EventoFunil = { formulario_id: string; formulario_slug: string; anon_id: string; evento: string; meta: Record<string, unknown>; criado_em: string };

/** `formulario` é o id do formulário. */
export type FiltroRespostas = { from: string; to: string; formulario?: string; status?: string; busca?: string };

export type Dados = {
  formularios(): Promise<Formulario[]>;
  formulario(id: string): Promise<Formulario | null>;
  criarFormulario(f: Partial<Formulario>): Promise<Formulario>;
  salvarFormulario(id: string, patch: Partial<Formulario>): Promise<void>;
  apagarFormulario(id: string): Promise<void>;
  respostas(f: FiltroRespostas): Promise<RespostaLinha[]>;
  apagarResposta(id: string): Promise<void>;
  /** `formularioId`: id do formulário (sem ele, todos). */
  eventos(from: string, to: string, formularioId?: string): Promise<EventoFunil[]>;
  subirArquivo(arquivo: File, pasta: string): Promise<string>;
};

function falhou(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export const dados: Dados = {
  async formularios() {
    const { data, error } = await dbNavegador().from("formularios").select("*").order("criado_em");
    falhou(error);
    return (data ?? []) as Formulario[];
  },
  async formulario(id) {
    const { data, error } = await dbNavegador().from("formularios").select("*").eq("id", id).maybeSingle();
    falhou(error);
    return data as Formulario | null;
  },
  async criarFormulario(f) {
    const { data, error } = await dbNavegador().from("formularios").insert(f).select("*").single();
    falhou(error);
    return data as Formulario;
  },
  async salvarFormulario(id, patch) {
    const { error } = await dbNavegador()
      .from("formularios")
      .update({ ...patch, atualizado_em: new Date().toISOString() })
      .eq("id", id);
    falhou(error);
  },
  async apagarFormulario(id) {
    const { error } = await dbNavegador().from("formularios").delete().eq("id", id);
    falhou(error);
  },
  async respostas(f) {
    const out: RespostaLinha[] = [];
    for (let p = 0; p < 50; p++) {
      let q = dbNavegador().from("respostas").select("*").gte("criado_em", f.from).lt("criado_em", f.to);
      if (f.formulario) q = q.eq("formulario_id", f.formulario);
      if (f.status) q = q.eq("status", f.status);
      const { data, error } = await q.order("criado_em", { ascending: false }).range(p * 1000, p * 1000 + 999);
      falhou(error);
      out.push(...((data ?? []) as RespostaLinha[]));
      if ((data ?? []).length < 1000) break;
    }
    return out;
  },
  async apagarResposta(id) {
    const { error } = await dbNavegador().from("respostas").delete().eq("id", id);
    falhou(error);
  },
  async eventos(from, to, formularioId) {
    const out: EventoFunil[] = [];
    for (let p = 0; p < 50; p++) {
      let q = dbNavegador().from("eventos").select("formulario_id, formulario_slug, anon_id, evento, meta, criado_em").gte("criado_em", from).lt("criado_em", to);
      if (formularioId) q = q.eq("formulario_id", formularioId);
      const { data, error } = await q.order("id").range(p * 1000, p * 1000 + 999);
      falhou(error);
      out.push(...((data ?? []) as EventoFunil[]));
      if ((data ?? []).length < 1000) break;
    }
    return out;
  },
  async subirArquivo(arquivo, pasta) {
    const ext = (arquivo.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
    const caminho = `${pasta}/${Date.now()}.${ext}`;
    const { error } = await dbNavegador().storage.from("formularios").upload(caminho, arquivo, { upsert: true, contentType: arquivo.type });
    falhou(error);
    return dbNavegador().storage.from("formularios").getPublicUrl(caminho).data.publicUrl;
  },
};
