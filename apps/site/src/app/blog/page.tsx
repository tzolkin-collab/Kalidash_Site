import type { Metadata } from "next";
import PixelTransition from "../components/PixelTransition";
import {
	fetchPublishedArticles,
	fetchArticleBySlug,
	GALLERY_SLUG,
	isReservedArticleSlug,
} from "@/lib/blog";
import type { Article } from "@/lib/blog";
import { SITE_URL } from "@/lib/siteUrl";
import { DEFAULT_OG_IMAGE, absoluteUrl } from "@/lib/blogSeo";
import { BlogGalleryView } from "./views";
import type { GalleryItem } from "./views";

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

const toItem = (a: Article): GalleryItem => ({
	id: a.id,
	title: a.title,
	excerpt: a.excerpt,
	coverImageUrl: a.coverImageUrl,
	coverImagePos: a.coverImagePos,
	meta: `${a.categories?.[0] || "Kalidash"} · ${
		a.publishedAt ? new Date(a.publishedAt).toLocaleDateString("pt-BR") : "Em breve"
	}`,
	authorName: a.authorName || "Equipe Kalidash",
	href: `/blog/${a.slug}`,
});

export default async function BlogPage() {
	// A API já devolve a lista na ordem final (Q14): cartões curados primeiro, depois todo artigo
	// publicado fora da curadoria, por data; o blog-global vem por último e não entra na grade.
	const [list, globalArticle] = await Promise.all([
		fetchPublishedArticles(),
		fetchArticleBySlug(GALLERY_SLUG),
	]);
	const items = list.filter((a) => !isReservedArticleSlug(a.slug));

	return (
		<PixelTransition color="#050507" duration={1400} pixelDuration={450}>
			<BlogGalleryView heroHtml={globalArticle?.body} items={items.map(toItem)} />
		</PixelTransition>
	);
}
