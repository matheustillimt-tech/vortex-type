import type { NextConfig } from "next";

/** Telas que nunca podem ir dentro de iframe de outro site (clickjacking). A página pública do formulário (`/{slug}`)
 *  fica de fora de propósito: o cliente coloca o formulário no site dele (código em Editor → Publicação). */
const TELAS_SEM_IFRAME = ["/", "/login", "/formularios/:caminho*", "/respostas/:caminho*", "/integracoes/:caminho*", "/equipe/:caminho*", "/configuracoes/:caminho*"];

const config: NextConfig = {
  // Logo e favicon da marca sobem por server action (Configurações): o limite padrão de 1 MB não cabe o arquivo + o resto do form.
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      ...TELAS_SEM_IFRAME.map((source) => ({
        source,
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      })),
    ];
  },
};

export default config;
