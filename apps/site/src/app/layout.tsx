import type { Metadata, Viewport } from "next";
import { Fraunces, Archivo, Newsreader, Manrope } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["opsz", "SOFT", "WONK"],
  style: ["normal", "italic"],
  weight: "variable",
});

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  weight: ["400", "500", "600", "700"],
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  style: ["normal", "italic"],
  weight: "variable",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://kalidash.com.br"),
  title: {
    default: "Kalidash — Eficiência operacional na era dos agentes",
    template: "%s | Kalidash",
  },
  description:
    "A Kalidash prepara empresas, processos e tecnologia para a era dos agentes de IA — cultura, advisory e execução em operações complexas.",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Kalidash",
    title: "Kalidash — Eficiência operacional na era dos agentes",
    description:
      "Cultura, advisory e execução para empresas na era dos agentes de IA.",
    images: ["/kalidash-hero-sculpture.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kalidash — Eficiência operacional na era dos agentes",
    description:
      "Cultura, advisory e execução para empresas na era dos agentes de IA.",
    images: ["/kalidash-hero-sculpture.png"],
  },
  icons: {
    icon: "/kalidash-symbol.svg",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`${fraunces.variable} ${archivo.variable} ${newsreader.variable} ${manrope.variable}`}
      style={{ backgroundColor: "#ffffff" }}
    >
      <body>{children}</body>
    </html>
  );
}
