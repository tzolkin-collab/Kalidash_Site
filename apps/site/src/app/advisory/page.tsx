import type { Metadata } from "next";
import { advisory } from "../institucional/pages";
import KitPage from "../solucoes/KitPage";

export const metadata: Metadata = {
  title: advisory.meta.title,
  description: advisory.meta.description,
};

/* Fecho: a linha de apoio do hero (pages.ts). */
export default function Page() {
  return <KitPage page={advisory} closing="Ao lado da liderança. Dentro da execução." />;
}
