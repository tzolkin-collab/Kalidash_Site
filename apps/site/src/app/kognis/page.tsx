import type { Metadata } from "next";
import { kognis } from "../institucional/pages";
import ProductPage from "../solucoes/ProductPage";

export const metadata: Metadata = {
  title: kognis.meta.title,
  description: kognis.meta.description,
};

/* Fecho: última frase do passo "Você escala" (pages.ts). */
export default function Page() {
  return <ProductPage page={kognis} kind="cutout" closing="Sobra tempo pra fazer o que você faz de melhor: advogar." />;
}
