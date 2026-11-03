import { Fraunces } from "next/font/google";

/* Serifa do menu mobile (a mesma da marca, Fraunces). Instancia propria e sem preload: o CSS so a usa depois que o
 * SidebarMenu liga a variavel (em tempo ocioso, apos o load), entao nao entra no caminho do LCP. */
export const menuFont = Fraunces({ subsets: ["latin"], variable: "--font-menu", display: "swap", preload: false, axes: ["opsz"] });
