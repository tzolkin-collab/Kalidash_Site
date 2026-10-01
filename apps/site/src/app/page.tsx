import type { Metadata } from "next";
import HomePage from "./home/HomePage";
import { SITE_URL } from "@/lib/siteUrl";

const title = "Kalidash — Consultoria em dados, automação e IA aplicada";
const description =
  "A Kalidash entende os desafios da sua operação, organiza a base e implementa soluções que conectam sistemas, automatizam rotinas e melhoram decisões.";

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
    images: [{ url: "/home/metodo-reuniao.jpg", width: 2000, height: 1334, alt: "Equipe da Kalidash em reunião olhando um gráfico de resultados" }],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/home/metodo-reuniao.jpg"] },
};

export default function Page() {
  return <HomePage />;
}
