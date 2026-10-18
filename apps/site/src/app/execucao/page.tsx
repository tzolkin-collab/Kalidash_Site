import type { Metadata } from "next";
import SitePage from "../institucional/SitePage";
import { execucao } from "../institucional/pages";

export const metadata: Metadata = {
  title: execucao.meta.title,
  description: execucao.meta.description,
};

export default function Page() {
  return <SitePage page={execucao} />;
}
