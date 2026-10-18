import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteUrl";
import { fetchPublishedArticles } from "@/lib/blog";

// Home, blog e cada artigo publicado. Se a API estiver fora do ar na geração, sai só o que é fixo.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await fetchPublishedArticles()
    .then((list) => list.filter((a) => a.slug !== "blog-global"))
    .catch(() => []); // API fora do ar: o sitemap sai só com as páginas fixas
  return [
    { url: `${SITE_URL}/`, changeFrequency: "monthly", priority: 1 },
    ...["sobre-nos", "treinamento-corporativo-ia", "advisory", "execucao", "solucoes"].map((slug) => ({
      url: `${SITE_URL}/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
    { url: `${SITE_URL}/blog`, changeFrequency: "weekly", priority: 0.8 },
    ...articles.map((a) => ({
      url: `${SITE_URL}/blog/${a.slug}`,
      lastModified: a.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
