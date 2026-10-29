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
  // Campos do BC-1 (ainda não existem na API; o site já os respeita se vierem): ficam opcionais.
  noindex?: boolean | null;
  ogImageUrl?: string | null;
  canonicalUrl?: string | null;
};

// Slug reservado da Galeria Principal (hero e SEO de /blog). Nunca é um artigo público.
export const GALLERY_SLUG = "blog-global";
export const isReservedArticleSlug = (slug: string) => slug === GALLERY_SLUG;

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

/** "Estudos de Caso" -> "estudos-de-caso": identifica a categoria na URL (/blog/categoria/[slug] ou ?categoria=). */
export const categorySlug = (label: string) =>
  label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export type BlogCategory = {
  id: string;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  hidden: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export const DEFAULT_BLOG_CATEGORIES: BlogCategory[] = [
  {
    id: "cat-cases",
    name: "Cases",
    slug: "cases",
    description:
      "Estudos de caso e resultados reais de implementação de IA e agentes em operações complexas.",
    sortOrder: 0,
    hidden: false,
  },
  {
    id: "cat-posts",
    name: "Posts",
    slug: "posts",
    description:
      "Artigos, análises práticas e guias sobre cultura, governança e execução com agentes de IA.",
    sortOrder: 1,
    hidden: false,
  },
];

export async function fetchBlogCategories(onlyVisible = false): Promise<BlogCategory[]> {
  try {
    const qs = onlyVisible ? "?visible=true" : "";
    const res = await fetch(`${API_URL}/api/blog/categories${qs}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error(`API respondeu ${res.status}`);
    const list: BlogCategory[] = await res.json();
    if (Array.isArray(list) && list.length > 0) return list;
    return DEFAULT_BLOG_CATEGORIES;
  } catch (error) {
    if (building()) {
      console.error("Falha ao buscar categorias do blog durante o build", error);
    }
    return DEFAULT_BLOG_CATEGORIES;
  }
}
