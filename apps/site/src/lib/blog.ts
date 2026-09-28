import { API_URL } from "./api";

// Espelha o struct Article do Go (apps/api/blog.go). Sem Sanity — o body já vem como HTML
// (o editor do admin é o TipTap), não Portable Text.
export type Article = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  coverImageUrl?: string | null;
  coverImagePos: number;
  featured: boolean;
  published: boolean;
  authorName: string;
  categories: string[];
  seoTitle?: string | null;
  seoDescription?: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
};

export async function fetchPublishedArticles(): Promise<Article[]> {
  try {
    const res = await fetch(`${API_URL}/api/blog/articles?published=true`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error(`API respondeu ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error("Falha ao buscar artigos do blog", error);
    return [];
  }
}

export async function fetchArticleBySlug(slug: string): Promise<Article | null> {
  try {
    const res = await fetch(
      `${API_URL}/api/blog/article?slug=${encodeURIComponent(slug)}`,
      { next: { revalidate: 60 } },
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`API respondeu ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error("Falha ao buscar artigo do blog", error);
    return null;
  }
}
