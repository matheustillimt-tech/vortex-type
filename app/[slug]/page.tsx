import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Conversa } from "@/app/_componentes/conversa";
import { lerMarca } from "@/src/lib/marca-servidor";
import { buscarFormulario } from "@/src/lib/formulario/api";
import { mesclar } from "@/src/lib/formulario/padroes";
import { slugReservado } from "@/src/lib/regras/rotas";

type Props = { params: Promise<{ slug: string }> };

// A RPC é um POST (Next não memoiza sozinho): `cache` garante uma leitura só por requisição.
const carregar = cache(async (slug: string) => {
  if (slugReservado(slug)) return null;
  try {
    return await buscarFormulario(slug);
  } catch (e) {
    console.error("[formulario] erro ao carregar", slug, e);
    return null;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const f = await carregar((await params).slug);
  if (!f) return { title: (await lerMarca()).nome };
  const titulo = f.titulo_pagina || f.nome;
  return {
    title: titulo,
    description: f.descricao ?? undefined,
    robots: { index: true, follow: true },
    openGraph: { title: titulo, description: f.descricao ?? undefined, type: "website", locale: "pt_BR" },
  };
}

export async function generateViewport({ params }: Props): Promise<Viewport> {
  const f = await carregar((await params).slug);
  // a barra do navegador embutido (Instagram, TikTok, Telegram) pega a cor da barra do topo
  return { themeColor: f ? mesclar(f).cores.marca : "#0d0d0d", width: "device-width", initialScale: 1 };
}

export default async function PaginaFormulario({ params }: Props) {
  const f = await carregar((await params).slug);
  if (!f) notFound();
  return <Conversa bot={f} />;
}
