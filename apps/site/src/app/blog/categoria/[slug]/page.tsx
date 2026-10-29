import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
	fetchPublishedArticles,
	fetchBlogCategories,
	GALLERY_SLUG,
	isReservedArticleSlug,
	categorySlug,
} from "@/lib/blog";
import type { Article, BlogCategory } from "@/lib/blog";
import { SITE_URL } from "@/lib/siteUrl";
import { DEFAULT_OG_IMAGE, absoluteUrl } from "@/lib/blogSeo";
import { BlogGalleryView } from "../../views";
import type { GalleryCategory, GalleryItem } from "../../views";

export const revalidate = 60;

type PageProps = { params: Promise<{ slug: string }> };

function resolveCategory(
	slug: string,
	catalog: BlogCategory[],
	articles: Article[],
): { name: string; slug: string; description: string; seoTitle?: string | null; seoDescription?: string | null } | null {
	const wanted = categorySlug(slug);
	const fromCatalog = catalog.find((c) => categorySlug(c.slug || c.name) === wanted);
	if (fromCatalog) {
		return {
			name: fromCatalog.name,
			slug: categorySlug(fromCatalog.slug || fromCatalog.name),
			description:
				fromCatalog.description ||
				`Conteúdos e publicações sobre ${fromCatalog.name} na Kalidash.`,
			seoTitle: fromCatalog.seoTitle,
			seoDescription: fromCatalog.seoDescription,
		};
	}
	for (const a of articles) {
		for (const label of a.categories ?? []) {
			if (categorySlug(label) === wanted) {
				return {
					name: label.trim(),
					slug: wanted,
					description: `Conteúdos e publicações sobre ${label.trim()} na Kalidash.`,
				};
			}
		}
	}
	return null;
}

export async function generateStaticParams() {
	const [catalog, articles] = await Promise.all([
		fetchBlogCategories(true).catch(() => []),
		fetchPublishedArticles().catch(() => []),
	]);
	const slugs = new Set<string>();
	for (const c of catalog) {
		const s = categorySlug(c.slug || c.name);
		if (s) slugs.add(s);
	}
	for (const a of articles) {
		if (isReservedArticleSlug(a.slug)) continue;
		for (const label of a.categories ?? []) {
			const s = categorySlug(label);
			if (s) slugs.add(s);
		}
	}
	return [...slugs].map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { slug } = await params;
	const [catalog, articles] = await Promise.all([
		fetchBlogCategories(false).catch(() => []),
		fetchPublishedArticles().catch(() => []),
	]);
	const category = resolveCategory(slug, catalog, articles);
	if (!category) {
		return { title: "Categoria não encontrada", robots: { index: false, follow: false } };
	}

	const title = category.seoTitle || `${category.name} — Blog Kalidash`;
	const description = category.seoDescription || category.description;
	const url = `${SITE_URL}/blog/categoria/${category.slug}`;
	const image = absoluteUrl(DEFAULT_OG_IMAGE);

	return {
		title: /kalidash/i.test(title) ? { absolute: title } : title,
		description,
		alternates: { canonical: url },
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

export default async function BlogCategoryPage({ params }: PageProps) {
	const { slug } = await params;
	const [list, catalog] = await Promise.all([
		fetchPublishedArticles(),
		fetchBlogCategories(false),
	]);
	const articles = list.filter(
		(a) => !isReservedArticleSlug(a.slug) && a.slug !== GALLERY_SLUG && a.slug !== "artigo-teste-template",
	);
	const category = resolveCategory(slug, catalog, articles);
	if (!category) notFound();

	const managedCategories: GalleryCategory[] = catalog.map((c) => ({
		name: c.name,
		slug: categorySlug(c.slug || c.name),
		description: c.description,
		hidden: c.hidden,
	}));

	const escapeHtml = (s: string) =>
		s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

	const categoryHeroHtml = `<p>Blog · Categoria</p><h1>${escapeHtml(
		category.name,
	)}<span>.</span></h1><div>${escapeHtml(category.description)}</div>`;

	return (
		<BlogGalleryView
			heroHtml={categoryHeroHtml}
			items={articles.map(toItem)}
			categoriesCatalog={managedCategories}
			initialCategorySlug={category.slug}
		/>
	);
}
