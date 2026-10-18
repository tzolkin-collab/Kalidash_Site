import type { Metadata } from "next";
import SitePage from "../institucional/SitePage";
import { sobreNos } from "../institucional/pages";

export const metadata: Metadata = {
  title: sobreNos.meta.title,
  description: sobreNos.meta.description,
};

export default function Page() {
  return <SitePage page={sobreNos} />;
}
