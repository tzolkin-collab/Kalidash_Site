import type { Metadata, Viewport } from "next";
import { Archivo, Inter, Source_Sans_3 } from "next/font/google";
import GoogleTagManager from "./components/GoogleTagManager";
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
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://kalidash.com"),
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
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: "/apple-icon.png",
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

/* Abertura com o logo (components/LogoIntro): decide antes da pintura se ela roda nesta visita.
 * Roda uma vez por sessão, nunca em reload e nunca com movimento reduzido; sem a marca no <html> o overlay é display:none. */
const LOGO_INTRO_SCRIPT = `try{var n=performance.getEntriesByType("navigation")[0];if(!sessionStorage.getItem("kalidash:intro-played")&&!(n&&n.type==="reload")&&!matchMedia("(prefers-reduced-motion: reduce)").matches){document.documentElement.setAttribute("data-intro","1")}}catch(e){}`;

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
        <script dangerouslySetInnerHTML={{ __html: LOGO_INTRO_SCRIPT }} />
      </head>
      <body>
        <GoogleTagManager gtmId={process.env.NEXT_PUBLIC_GTM_ID} />
        {children}
      </body>
    </html>
  );
}
