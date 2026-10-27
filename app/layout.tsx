import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@fontsource/material-icons/400.css";
import "./globals.css";
import { lerMarca } from "@/src/lib/marca-servidor";
import { variaveisDaCor } from "@/src/lib/regras/marca";

// Marca vem do banco a cada requisição (cada cópia muda a dela em Configurações).
export const dynamic = "force-dynamic";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-inter", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const marca = await lerMarca();
  return { title: marca.nome, robots: { index: false, follow: false }, icons: { icon: marca.faviconUrl ?? "/icon.svg" } };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const marca = await lerMarca();
  return (
    <html lang="pt-BR" className={inter.variable} style={variaveisDaCor(marca.cor) as React.CSSProperties}>
      <body className="min-h-screen font-sans text-[13px] antialiased">{children}</body>
    </html>
  );
}
