import type { Metadata } from "next";
import { spectra } from "../institucional/pages";
import SpectraPage from "./SpectraPage";

export const metadata: Metadata = {
  title: spectra.meta.title,
  description: spectra.meta.description,
};

/* Fecho: primeira frase do lead do hero (pages.ts). */
export default function Page() {
  return <SpectraPage page={spectra} closing="A operação fala e o Spectra AI traduz." />;
}
