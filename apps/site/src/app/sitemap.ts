import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteUrl";
import { fetchBlogCategories, fetchPublishedArticles, isReservedArticleSlug } from "@/lib/blog";

// Home, blog, categorias e cada artigo publicado. Se a API estiver fora do ar na geração, sai só o que é fixo.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [articles, categories] = await Promise.all([
    fetchPublishedArticles()
      .then((list) => list.filter((a) => !isReservedArticleSlug(a.slug) && !a.noindex))
      .catch(() => []),
    fetchBlogCategories(true).catch(() => []),
  ]);
  return [
    { url: `${SITE_URL}/`, changeFrequency: "monthly", priority: 1 },
    ...["sobre-nos", "treinamento-corporativo-ia", "advisory", "execucao", "solucoes"].map((slug) => ({
      url: `${SITE_URL}/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
    { url: `${SITE_URL}/blog`, changeFrequency: "weekly", priority: 0.8 },
    ...categories.map((c) => ({
      url: `${SITE_URL}/blog/categoria/${c.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...articles.map((a) => ({
      url: `${SITE_URL}/blog/${a.slug}`,
      lastModified: a.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
