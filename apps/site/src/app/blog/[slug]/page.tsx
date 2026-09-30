import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PixelTransition from "../../components/PixelTransition";
import { ArticleView } from "../views";
import { fetchArticleBySlug, fetchPublishedArticles } from "@/lib/blog";

export const revalidate = 60;

export async function generateStaticParams() {
  const articles = await fetchPublishedArticles();
  return articles.map((a) => ({ slug: a.slug }));
}

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await fetchArticleBySlug(slug);

  if (!article) {
    return { title: "Artigo não encontrado" };
  }

  return {
    title: article.seoTitle || article.title || "Blog",
    description: article.seoDescription || article.excerpt || undefined,
    openGraph: {
      title: article.seoTitle || article.title || "Blog | Kalidash",
      description: article.seoDescription || article.excerpt || undefined,
      type: "article",
      publishedTime: article.publishedAt || undefined,
      authors: article.authorName ? [article.authorName] : undefined,
    },
  };
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = await fetchArticleBySlug(slug);

  if (!article) notFound();

  return (
    <PixelTransition color="#050507" duration={1400} pixelDuration={450}>
      <ArticleView article={article} />
    </PixelTransition>
  );
}
