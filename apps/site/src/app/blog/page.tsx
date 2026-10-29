import type { Metadata } from "next";
import {
	fetchPublishedArticles,
	fetchArticleBySlug,
	fetchBlogCategories,
	GALLERY_SLUG,
	isReservedArticleSlug,
	categorySlug,
} from "@/lib/blog";
import type { Article } from "@/lib/blog";
import { SITE_URL } from "@/lib/siteUrl";
import { DEFAULT_OG_IMAGE, absoluteUrl } from "@/lib/blogSeo";
import { sanitizeArticleHtml } from "@/lib/sanitizeHtml";
import { BlogGalleryView } from "./views";
import type { GalleryCategory, GalleryItem } from "./views";

export const revalidate = 60;

const FALLBACK_TITLE = "Blog";
const FALLBACK_DESCRIPTION =
	"Conteúdo sobre cultura, processos, tecnologia e organizações que trabalham com agentes de IA.";

// SEO da Galeria: vem dos campos SEO do blog-global (editados no admin); sem eles, vale o texto fixo.
export async function generateMetadata(): Promise<Metadata> {
	const gallery = await fetchArticleBySlug(GALLERY_SLUG).catch(() => null);
	const title = gallery?.seoTitle || FALLBACK_TITLE;
	const description = gallery?.seoDescription || FALLBACK_DESCRIPTION;
	const url = `${SITE_URL}/blog`;
	const image = absoluteUrl(gallery?.ogImageUrl || DEFAULT_OG_IMAGE);
	return {
		title: /kalidash/i.test(title) ? { absolute: title } : title,
		description,
		alternates: { canonical: gallery?.canonicalUrl || url },
		robots: gallery?.noindex ? { index: false, follow: true } : undefined,
		openGraph: {
			title,
			description,
			type: "website",
			url,
			siteName: "Kalidash",
			locale: "pt_BR",
			images: [{ url: image }],
		},
		twitter: { card: "summary_large_image", title, description, images: [image] },
	};
}

const toItem = (a: Article): GalleryItem => {
	const words = (a.body || a.excerpt || "").replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length;
	const readMins = Math.max(1, Math.ceil(words / 200));
	const category = a.categories?.[0] || "Kalidash";
	const dateStr = a.publishedAt
		? new Date(a.publishedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
		: "Em breve";

	return {
		id: a.id,
		title: a.title,
		excerpt: a.excerpt,
		coverImageUrl: a.coverImageUrl,
		coverImagePos: a.coverImagePos,
		categories: a.categories ?? [],
		meta: `${category} · ${readMins} min · ${dateStr}`,
		authorName: a.authorName || "Equipe Kalidash",
		href: `/blog/${a.slug}`,
	};
};

export default async function BlogPage() {
	// A API já devolve a lista na ordem final (Q14): cartões curados primeiro, depois todo artigo
	// publicado fora da curadoria, por data; o blog-global vem por último e não entra na grade.
	const [list, globalArticle, catalog] = await Promise.all([
		fetchPublishedArticles(),
		fetchArticleBySlug(GALLERY_SLUG),
		fetchBlogCategories(false),
	]);
	const items = list.filter(
		(a) => !isReservedArticleSlug(a.slug) && a.slug !== "artigo-teste-template",
	);
	const categoriesCatalog: GalleryCategory[] = catalog.map((c) => ({
		name: c.name,
		slug: categorySlug(c.slug || c.name),
		description: c.description,
		hidden: c.hidden,
	}));

	return (
		<BlogGalleryView
			heroHtml={globalArticle?.body ? sanitizeArticleHtml(globalArticle.body) : null}
			items={items.map(toItem)}
			categoriesCatalog={categoriesCatalog}
		/>
	);
}
