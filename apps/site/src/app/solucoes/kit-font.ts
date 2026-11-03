import { Fraunces } from "next/font/google";

/* Serifa provisória da marca (Kepler Std é Adobe Fonts, sem licença no projeto). Carregada só nas páginas do KitPage;
 * o corpo usa a Archivo, que já vem do layout raiz. Para trocar pela fonte oficial, mude só esta variável. */
export const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap", axes: ["opsz"], style: ["normal", "italic"] });
