import type { Metadata } from "next";
import { spectra } from "../institucional/pages";
import ProductPage from "../solucoes/ProductPage";

export const metadata: Metadata = {
  title: spectra.meta.title,
  description: spectra.meta.description,
};

/* Fecho: primeira frase do lead do hero (pages.ts). */
export default function Page() {
  return <ProductPage page={spectra} kind="photo" closing="A operação fala e o Spectra AI traduz." />;
}
