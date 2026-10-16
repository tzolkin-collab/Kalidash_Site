import { API_URL } from "./api";

// Espelha o struct Article do Go (apps/api/blog.go). Sem Sanity — o body já vem como HTML
// (o editor do admin é o TipTap), não Portable Text.
export type Article = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  // Documento nativo do BlockNote; na Galeria Principal (slug "blog-global") guarda a ordem
  // dos cartões de artigo — ver galleryOrder em blog/page.tsx.
  bodyJson?: string | null;
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

// Falha de rede ou erro 5xx NÃO pode virar "artigo não existe": com ISR, um 404 trocaria a última
// página boa por "não encontrado" só porque a API caiu por um instante. Em runtime a gente lança
// o erro (o Next mantém a página anterior); só um 404 da própria API significa "não existe".
// Durante `next build` a API pode estar fora do ar (EasyPanel/Vercel): aí devolvemos vazio e a
// página é gerada no primeiro acesso.
const building = () => process.env.NEXT_PHASE === "phase-production-build";
const unreachable = (what: string, error: unknown) =>
  new Error(
    `Não consegui buscar ${what} na API (${API_URL}). Confira se a API está no ar e se API_URL aponta para ela. ${
      error instanceof Error ? error.message : String(error)
    }`,
  );

export async function fetchPublishedArticles(): Promise<Article[]> {
  try {
    const res = await fetch(`${API_URL}/api/blog/articles?published=true`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error(`API respondeu ${res.status}`);
    return await res.json();
  } catch (error) {
    if (building()) {
      console.error("Falha ao buscar artigos do blog durante o build", error);
      return [];
    }
    throw unreachable("os artigos do blog", error);
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
    if (building()) {
      console.error("Falha ao buscar artigo do blog durante o build", error);
      return null;
    }
    throw unreachable(`o artigo "${slug}"`, error);
  }
}

export type BlogSettings = {
  preTitle: string;
  titlePrefix: string;
  titleSpan: string;
  description: string;
};

export async function fetchBlogSettings(): Promise<BlogSettings | null> {
  // force turbopack invalidation
  try {
    const res = await fetch(`${API_URL}/api/blog/settings`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error(`API respondeu ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error("Falha ao buscar configurações do blog", error);
    return null;
  }
}
