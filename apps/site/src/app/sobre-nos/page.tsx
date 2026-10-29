import type { Metadata } from "next";
import SitePage from "../institucional/SitePage";
import { sobreNos } from "../institucional/pages";
import { SITE_URL } from "@/lib/siteUrl";

const { title, description } = sobreNos.meta;
const ogImage = `${SITE_URL}/founders-studio.jpg`;

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: {
    canonical: `${SITE_URL}/sobre-nos`,
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Kalidash",
    url: `${SITE_URL}/sobre-nos`,
    title,
    description,
    images: [
      {
        url: ogImage,
        width: 1600,
        height: 1067,
        alt: "César Germano e Iago Braz, fundadores da Kalidash",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [ogImage],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Kalidash",
      url: SITE_URL,
      foundingDate: "2022",
      description,
      founders: [
        { "@id": `${SITE_URL}/sobre-nos#cesar-germano` },
        { "@id": `${SITE_URL}/sobre-nos#iago-braz` },
      ],
    },
    {
      "@type": "Person",
      "@id": `${SITE_URL}/sobre-nos#cesar-germano`,
      name: "César Germano",
      jobTitle: "CEO e Co-fundador",
      worksFor: { "@id": `${SITE_URL}/#organization` },
      sameAs: ["https://www.linkedin.com/in/cesargermano/"],
    },
    {
      "@type": "Person",
      "@id": `${SITE_URL}/sobre-nos#iago-braz`,
      name: "Iago Braz",
      jobTitle: "COO e Co-fundador",
      worksFor: { "@id": `${SITE_URL}/#organization` },
      sameAs: ["https://www.linkedin.com/in/iagobraz/"],
    },
  ],
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <SitePage page={sobreNos} />
    </>
  );
}
