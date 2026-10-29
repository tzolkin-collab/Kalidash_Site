import type { Metadata } from "next";
import SitePage from "../institucional/SitePage";
import { kognis } from "../institucional/pages";

export const metadata: Metadata = {
  title: kognis.meta.title,
  description: kognis.meta.description,
};

export default function Page() {
  return <SitePage page={kognis} />;
}
