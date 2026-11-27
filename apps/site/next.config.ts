import type { NextConfig } from "next";
import { ADMIN_ORIGINS } from "./src/lib/adminOrigins";

// Projeto da Kalidash no Microsoft Clarity. O ID é público (vai no HTML). Vale só no deploy de produção, para o
// local e as prévias não gravarem sessões; a variável NEXT_PUBLIC_CLARITY_PROJECT_ID, se preenchida, tem prioridade.
const CLARITY_PROJECT_ID =
  process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID || (process.env.VERCEL_ENV === "production" ? "zk8398z5in" : "");

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_CLARITY_PROJECT_ID: CLARITY_PROJECT_ID },
  images: {
    qualities: [75, 90], // 90 só na foto de abertura da Advisory
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.r2.dev",
      },
      {
        protocol: "https",
        hostname: "**.kalidash.com",
      },
      {
        protocol: "https",
        hostname: "**.kalidash.com.br",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  // "Cases" agora é uma categoria do Blog (/blog?categoria=cases). Links antigos continuam funcionando.
  async redirects() {
    return [
      { source: "/cases", destination: "/blog/categoria/cases", permanent: false },
      { source: "/cases/:slug", destination: "/blog/:slug", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        // Rotas de preview: só o admin pode embutir (frame-ancestors), fora do índice, sem cache.
        source: "/preview/:path*",
        headers: [
          { key: "Content-Security-Policy", value: `frame-ancestors 'self' ${ADMIN_ORIGINS.join(" ")}` },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
      {
        // Ambientes de visualização na Vercel (*.vercel.app) não entram no Google: o canonical e o
        // sitemap apontam para o domínio final, e o preview não deve competir com ele.
        source: "/:path*",
        has: [{ type: "host", value: ".*\\.vercel\\.app" }],
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
