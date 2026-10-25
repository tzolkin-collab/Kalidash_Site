import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PixelTransition from "../../components/PixelTransition";
import { ArticleView } from "../views";
import type { GalleryItem } from "../views";
import { fetchArticleBySlug, fetchPublishedArticles, isReservedArticleSlug } from "@/lib/blog";
import { SITE_URL } from "@/lib/siteUrl";
import { DEFAULT_OG_IMAGE, absoluteUrl, articleJsonLd, jsonLd } from "@/lib/blogSeo";

export const revalidate = 60;

export async function generateStaticParams() {
  const articles = await fetchPublishedArticles();
  return articles.filter((a) => !isReservedArticleSlug(a.slug)).map((a) => ({ slug: a.slug }));
}

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = isReservedArticleSlug(slug) ? null : await fetchArticleBySlug(slug);

  if (!article) {
    return { title: "Artigo não encontrado", robots: { index: false, follow: false } };
  }

  const title = article.seoTitle || article.title || "Blog";
  const description = article.seoDescription || article.excerpt || undefined;
  const url = article.canonicalUrl || `${SITE_URL}/blog/${article.slug}`;
  const image = absoluteUrl(article.ogImageUrl || article.coverImageUrl || DEFAULT_OG_IMAGE);

  return {
    // seoTitle que já traz a marca não ganha o sufixo "| Kalidash" do layout de novo.
    title: /kalidash/i.test(title) ? { absolute: title } : title,
    description,
    alternates: { canonical: url },
    robots: article.noindex ? { index: false, follow: true } : undefined,
    openGraph: {
      title,
      description,
      type: "article",
      url,
      siteName: "Kalidash",
      locale: "pt_BR",
      publishedTime: article.publishedAt || undefined,
      modifiedTime: article.updatedAt || undefined,
      authors: article.authorName ? [article.authorName] : undefined,
      images: [{ url: image, alt: article.title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = isReservedArticleSlug(slug) ? null : await fetchArticleBySlug(slug);

  if (isReservedArticleSlug(slug) || !article) notFound();

  // Busca outros artigos publicados para recomendação
  const all = await fetchPublishedArticles();
  const relatedArticles: GalleryItem[] = all
    .filter((a) => a.slug !== slug && !isReservedArticleSlug(a.slug))
    .slice(0, 2)
    .map((a) => ({
      id: a.id,
      title: a.title,
      excerpt: a.excerpt,
      coverImageUrl: a.coverImageUrl,
      coverImagePos: a.coverImagePos,
      meta: `${a.categories?.[0] || "AI Culture"} · ${
        a.publishedAt ? new Date(a.publishedAt).toLocaleDateString("pt-BR") : ""
      }`,
      authorName: a.authorName || "Equipe Kalidash",
      href: `/blog/${a.slug}`,
    }));

  return (
    <PixelTransition color="#1e1329" duration={1400} pixelDuration={450}>
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(articleJsonLd(article)) }}
        />
        <ArticleView article={article} relatedArticles={relatedArticles} shareUrl={`${SITE_URL}/blog/${article.slug}`} />
      </>
    </PixelTransition>
  );
}
