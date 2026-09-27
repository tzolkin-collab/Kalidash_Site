import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PortableText } from "next-sanity";
import { sanityClient } from "@/sanity/client";
import { imageUrl } from "@/sanity/image";
import { ARTICLE_QUERY, ARTICLES_QUERY } from "@/sanity/queries";
import type { SanityImageSource } from "@sanity/image-url";
import type { Metadata } from "next";
import styles from "./article.module.css";
import PixelTransition from "../../components/PixelTransition";

export const revalidate = 60;

export async function generateStaticParams() {
  try {
    const articles = await sanityClient.fetch<Array<{ slug?: string | null }>>(
      ARTICLES_QUERY,
      {},
      { next: { revalidate: 60 } },
    );
    return articles
      .filter((a) => a.slug)
      .map((a) => ({ slug: a.slug as string }));
  } catch {
    return [];
  }
}

type Article = {
  title?: string | null;
  excerpt?: string | null;
  publishedAt?: string | null;
  coverImage?: SanityImageSource | null;
  body?: never[] | null;
  author?: { name?: string | null; role?: string | null } | null;
  categories?: Array<{ title?: string | null }> | null;
};

type PageProps = { params: Promise<{ slug: string }> };

async function fetchArticle(slug: string): Promise<Article | null> {
  try {
    return await sanityClient.fetch<Article | null>(
      ARTICLE_QUERY,
      { slug },
      { next: { revalidate: 60 } },
    );
  } catch (error) {
    console.error("Sanity article query failed", error);
    return null;
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await fetchArticle(slug);

  if (!article) {
    return { title: "Artigo não encontrado" };
  }

  return {
    title: article.title || "Blog",
    description: article.excerpt || undefined,
    openGraph: {
      title: article.title || "Blog | Kalidash",
      description: article.excerpt || undefined,
      type: "article",
      publishedTime: article.publishedAt || undefined,
      authors: article.author?.name ? [article.author.name] : undefined,
    },
  };
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = await fetchArticle(slug);

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
            {article.categories?.[0]?.title || "Kalidash"} ·{" "}
            {article.publishedAt &&
              new Date(article.publishedAt).toLocaleDateString("pt-BR")}
          </p>
          <h1>{article.title}</h1>
          <div className={styles.excerpt}>{article.excerpt}</div>
          <span>
            {article.author?.name}
            {article.author?.role && ` · ${article.author.role}`}
          </span>

          {article.coverImage && (
            <Image
              className={styles.cover}
              src={imageUrl(article.coverImage as never)
                .width(1400)
                .height(800)
                .url()}
              alt={article.title || "Imagem de capa do artigo"}
              width={1400}
              height={800}
            />
          )}

          <div className={styles.body}>
            {Array.isArray(article.body) && <PortableText value={article.body} />}
          </div>
        </article>
      </main>
    </PixelTransition>
  );
}
