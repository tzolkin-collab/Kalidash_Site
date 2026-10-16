import type { Metadata } from "next";
import HomePage from "./home/HomePage";
import { SITE_URL } from "@/lib/siteUrl";

const title = "Kalidash — Prepare sua operação para a era dos agentes";
const ogImage = `${SITE_URL}/home/metodo-reuniao.jpg`; // absoluto: o layout commitado não define metadataBase
const description =
  "A Kalidash prepara pessoas, processos e tecnologia para conectar agentes, automação e novas formas de trabalhar à operação real.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Kalidash",
    url: SITE_URL,
    title,
    description,
    images: [{ url: ogImage, width: 2000, height: 1334, alt: "Equipe da Kalidash em reunião olhando um gráfico de resultados" }],
  },
  twitter: { card: "summary_large_image", title, description, images: [ogImage] },
};

export default function Page() {
  return <HomePage />;
}
