import type { Article } from "./blog";
import { SITE_URL } from "./siteUrl";

// Imagem de compartilhamento quando o artigo não tem capa nem ogImageUrl.
export const DEFAULT_OG_IMAGE = "/kalidash-hero-sculpture.png";

export const absoluteUrl = (url: string) =>
  /^https?:\/\//.test(url) ? url : `${SITE_URL}${url.startsWith("/") ? "" : "/"}${url}`;

// `<` escapado para que um "</script>" no texto do artigo não feche a tag do JSON-LD.
export const jsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, "\u003c");

export function articleJsonLd(article: Article) {
  const url = article.canonicalUrl || `${SITE_URL}/blog/${article.slug}`;
  const image = absoluteUrl(article.ogImageUrl || article.coverImageUrl || DEFAULT_OG_IMAGE);
  const category = article.categories?.[0] || "Blog";
  return [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      headline: article.title,
      description: article.seoDescription || article.excerpt || undefined,
      image: [image],
      datePublished: article.publishedAt || article.createdAt,
      dateModified: article.updatedAt || article.publishedAt || article.createdAt,
      author: { "@type": "Person", name: article.authorName || "Equipe Kalidash" },
      publisher: {
        "@type": "Organization",
        name: "Kalidash",
        url: SITE_URL,
        logo: { "@type": "ImageObject", url: `${SITE_URL}/brand/logo-white.svg` },
      },
      inLanguage: "pt-BR",
      articleSection: category,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Início", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
        { "@type": "ListItem", position: 3, name: article.title, item: url },
      ],
    },
  ];
}
