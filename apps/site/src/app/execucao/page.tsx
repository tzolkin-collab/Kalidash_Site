import type { Metadata } from "next";
import { execucao } from "../institucional/pages";
import KitPage from "../solucoes/KitPage";

export const metadata: Metadata = {
  title: execucao.meta.title,
  description: execucao.meta.description,
};

/* Fecho: a linha de apoio do hero (pages.ts). */
export default function Page() {
  return <KitPage page={execucao} closing="Escopo, prazo e métricas definidos antes de começar." />;
}
