import type { Metadata } from "next";
import { aiCulture } from "../institucional/pages";
import KitPage from "../solucoes/KitPage";

export const metadata: Metadata = {
  title: aiCulture.meta.title,
  description: aiCulture.meta.description,
};

/* Fecho: o título da seção de depoimentos, que fica desligada até haver vídeo aprovado (pages.ts). */
export default function Page() {
  return <KitPage page={aiCulture} closing="O resultado não aparece no certificado. Aparece no trabalho." />;
}
