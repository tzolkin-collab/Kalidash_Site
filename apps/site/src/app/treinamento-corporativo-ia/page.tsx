import type { Metadata } from "next";
import SitePage from "../institucional/SitePage";
import { aiCulture } from "../institucional/pages";

export const metadata: Metadata = {
  title: aiCulture.meta.title,
  description: aiCulture.meta.description,
};

export default function Page() {
  return <SitePage page={aiCulture} />;
}
