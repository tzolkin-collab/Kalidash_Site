import type { Metadata } from "next";
import SitePage from "../institucional/SitePage";
import { advisory } from "../institucional/pages";

export const metadata: Metadata = {
  title: advisory.meta.title,
  description: advisory.meta.description,
};

export default function Page() {
  return <SitePage page={advisory} />;
}
