import type { Metadata } from "next";
import SitePage from "../institucional/SitePage";
import { solucoes } from "../institucional/pages";

export const metadata: Metadata = {
  title: solucoes.meta.title,
  description: solucoes.meta.description,
};

export default function Page() {
  return <SitePage page={solucoes} />;
}
