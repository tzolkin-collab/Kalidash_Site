import type { Metadata } from "next";

// Rotas só para o iframe do admin: fora do índice e nunca em cache (ver next.config.ts).
export const metadata: Metadata = {
  title: "Pré-visualização",
  robots: { index: false, follow: false },
};

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
