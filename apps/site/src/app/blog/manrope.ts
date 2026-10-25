import { Manrope } from "next/font/google";

// Só a galeria do /blog usa Manrope; fora do layout raiz e sem preload, para não ser baixada nas outras páginas.
export const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  preload: false,
  weight: ["400", "500", "600", "700", "800"],
});
