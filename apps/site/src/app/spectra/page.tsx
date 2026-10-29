import type { Metadata } from "next";
import SitePage from "../institucional/SitePage";
import { spectra } from "../institucional/pages";

export const metadata: Metadata = {
  title: spectra.meta.title,
  description: spectra.meta.description,
};

export default function Page() {
  return <SitePage page={spectra} />;
}
