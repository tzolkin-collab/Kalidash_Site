import { Fraunces } from "next/font/google";

/* Mesma serifa do kit-font, mas sem preload: na Home o preload da Fraunces disputava banda com a imagem do herói e
 * atrasava o LCP (medido: 4,6 s -> 4,2 s e ~80 KB a menos sem ele). As demais páginas seguem com o kit-font. */
export const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap", preload: false, axes: ["opsz"], style: ["normal", "italic"] });
