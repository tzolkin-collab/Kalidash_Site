import type { Metadata, Viewport } from "next";
import { Archivo, Inter, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  weight: ["400", "500", "600", "700"],
});

// Fontes do design system, carregadas uma única vez no layout raiz e disponíveis em todas as rotas.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
// Texto corrido: Source Sans 3, alternativa aberta (da Adobe) no mesmo estilo da Myriad e da Acumin do brand guide.
const sourceSans = Source_Sans_3({ subsets: ["latin"], variable: "--font-source-sans", display: "swap" });

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

const PRE_PAINT_HEADER_SCRIPT = `(function(){try{var nav=performance.getEntriesByType("navigation")[0];var isReload=nav&&nav.type==="reload";var saved=sessionStorage.getItem("kalidash:header-collapsed")==="1";var samePath=sessionStorage.getItem("kalidash:header-path")===location.pathname;var collapsed=window.scrollY>15||(isReload&&samePath&&saved);document.documentElement.setAttribute("data-header-collapsed",collapsed?"true":"false");}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${archivo.variable} ${inter.variable} ${sourceSans.variable}`}
      style={{ backgroundColor: "#ffffff" }}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: PRE_PAINT_HEADER_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
