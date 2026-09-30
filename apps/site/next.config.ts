import type { NextConfig } from "next";
import { ADMIN_ORIGINS } from "./src/lib/adminOrigins";

const nextConfig: NextConfig = {
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
    ];
  },
};

export default nextConfig;
