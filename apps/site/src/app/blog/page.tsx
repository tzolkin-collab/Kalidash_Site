import type { Metadata } from "next";
import PixelTransition from "../components/PixelTransition";
import { fetchPublishedArticles, fetchArticleBySlug } from "@/lib/blog";
import type { Article } from "@/lib/blog";
import { BlogGalleryView } from "./views";
import type { GalleryItem } from "./views";

export const revalidate = 60;

export const metadata: Metadata = {
	title: "Blog",
	description:
		"Conteúdo sobre cultura, processos, tecnologia e organizações que trabalham com agentes de IA.",
	openGraph: {
		title: "Blog | Kalidash",
		description:
			"Ideias para a próxima operação — cultura, advisory e agentes de IA.",
	},
};

// Ordem dos cartões de artigo no documento da Galeria Principal (editada no admin). O primeiro
// é o destaque. Sem cartões (galeria nunca editada) devolve null e vale a ordem da API.
function galleryOrder(bodyJson?: string | null): string[] | null {
	if (!bodyJson) return null;
	try {
		const ids = (JSON.parse(bodyJson) as { type?: string; props?: { articleId?: string } }[])
			.filter((b) => b?.type === "articleCard" && b.props?.articleId)
			.map((b) => b.props!.articleId!);
		return ids.length ? ids : null;
	} catch {
		return null;
	}
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
	const rawItems = await fetchPublishedArticles();
	const published = rawItems.filter((a) => a.slug !== "blog-global");
	const globalArticle = await fetchArticleBySlug("blog-global");
	const order = galleryOrder(globalArticle?.bodyJson);
	const byId = new Map(published.map((a) => [a.id, a]));
	const items = order ? order.flatMap((id) => byId.get(id) ?? []) : published;

	return (
		<PixelTransition color="#050507" duration={1400} pixelDuration={450}>
			<BlogGalleryView heroHtml={globalArticle?.body} items={items.map(toItem)} />
		</PixelTransition>
	);
}
