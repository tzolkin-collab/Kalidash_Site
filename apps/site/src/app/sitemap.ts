import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteUrl";
import { fetchPublishedArticles } from "@/lib/blog";

// Home, blog e cada artigo publicado. Se a API estiver fora do ar na geração, sai só o que é fixo.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = (await fetchPublishedArticles()).filter((a) => a.slug !== "blog-global");
  return [
    { url: `${SITE_URL}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/blog`, changeFrequency: "weekly", priority: 0.8 },
    ...articles.map((a) => ({
      url: `${SITE_URL}/blog/${a.slug}`,
      lastModified: a.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
