import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import styles from "./article.module.css";
import PixelTransition from "../../components/PixelTransition";
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
      <main className={styles.page}>
        <header>
          <Link href="/blog">← Blog</Link>
          <Link href="/">Kalidash</Link>
        </header>

        <article>
          <p>
            {article.categories?.[0] || "Kalidash"} ·{" "}
            {article.publishedAt &&
              new Date(article.publishedAt).toLocaleDateString("pt-BR")}
          </p>
          <h1>{article.title}</h1>
          <div className={styles.excerpt}>{article.excerpt}</div>
          <span>{article.authorName}</span>

          {article.coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- ver nota em blog/page.tsx
            <img
              className={styles.cover}
              src={article.coverImageUrl}
              alt={article.title || "Imagem de capa do artigo"}
              style={{ objectPosition: `50% ${article.coverImagePos}%` }}
            />
          )}

          <div
            className={styles.body}
            // O corpo já vem como HTML do editor (TipTap) do admin — sem Portable
            // Text/Sanity, então não precisa de um renderer de blocos aqui.
            dangerouslySetInnerHTML={{ __html: article.body }}
          />
        </article>
      </main>
    </PixelTransition>
  );
}
