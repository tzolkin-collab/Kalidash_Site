import type { Metadata } from "next";
import { kognis } from "../institucional/pages";
import ProductPage from "../solucoes/ProductPage";

export const metadata: Metadata = {
  title: kognis.meta.title,
  description: kognis.meta.description,
};

/* Só o hero (decisão D23). Os blocos de pages.ts abaixo do hero não renderizam; o `closing` fica para quando voltarem.
 * Sem FAQ visível, o JSON-LD FAQPage também não é emitido. */
export default function Page() {
  return <ProductPage page={kognis} kind="cutout" closing="Sobra tempo pra fazer o que você faz de melhor: advogar." heroOnly />;
}
