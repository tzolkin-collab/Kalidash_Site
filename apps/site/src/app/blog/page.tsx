import Image from "next/image";
import Link from "next/link";
import { sanityClient } from "@/sanity/client";
import { imageUrl } from "@/sanity/image";
import { ARTICLES_QUERY } from "@/sanity/queries";
import type { SanityImageSource } from "@sanity/image-url";
import type { Metadata } from "next";
import styles from "./blog.module.css";
import PixelTransition from "../components/PixelTransition";

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

type Article = {
  _id: string;
  title?: string | null;
  slug?: string | null;
  excerpt?: string | null;
  featured?: boolean | null;
  publishedAt?: string | null;
  coverImage?: SanityImageSource | null;
  author?: { name?: string | null } | null;
  categories?: Array<{ title?: string | null }> | null;
};

const fallback: Article[] = [
  {
    _id: "demo-1",
    title: "A operação na era dos agentes",
    slug: "operacao-na-era-dos-agentes",
    excerpt:
      "O trabalho muda quando agentes deixam de ser ferramentas isoladas e passam a operar com contexto, governança e propósito.",
    featured: true,
    publishedAt: "2026-08-28T12:00:00.000Z",
    author: { name: "Equipe Kalidash" },
    categories: [{ title: "AI Culture" }],
  },
  {
    _id: "demo-2",
    title: "Por que automação não é transformação",
    slug: "automacao-nao-e-transformacao",
    excerpt:
      "Automatizar uma tarefa reduz esforço. Transformar a operação muda decisões, responsabilidades e fluxos de valor.",
    publishedAt: "2026-08-20T12:00:00.000Z",
    author: { name: "Equipe Kalidash" },
    categories: [{ title: "Advisory" }],
  },
];

export default async function BlogPage() {
  let articles: Article[] = [];
  try {
    articles = await sanityClient.fetch<Article[]>(ARTICLES_QUERY, {}, {
      next: { revalidate: 60 },
    });
  } catch (error) {
    console.error("Sanity articles query failed", error);
  }

  const items = articles.length ? articles : fallback;

  return (
    <PixelTransition color="#050507" duration={1400} pixelDuration={450}>
      <main className={styles.page}>
        <header>
          <Link href="/">
            <Image
              src="/kalidash-logo-branca.webp"
              alt="Kalidash"
              width={154}
              height={30}
            />
          </Link>
          <nav>
            <Link href="/">Início</Link>
            <Link href="/#metodo">Método</Link>
            <Link href="/#diagnostico">Conversar ↗︎</Link>
          </nav>
        </header>

        <section className={styles.hero}>
          <p>[ inteligência aplicada ao trabalho ]</p>
          <h1>
            Ideias para a próxima <span>operação.</span>
          </h1>
          <div>
            Conteúdo sobre cultura, processos, tecnologia e organizações que
            trabalham com agentes.
          </div>
        </section>

        <section className={styles.posts}>
          {items.map((article, index) => (
            <article
              key={article._id}
              className={index === 0 ? styles.featured : ""}
            >
              {article.coverImage && (
                <Image
                  className={styles.cover}
                  src={imageUrl(article.coverImage as never)
                    .width(index === 0 ? 1400 : 800)
                    .height(index === 0 ? 720 : 520)
                    .url()}
                  alt={article.title || ""}
                  width={index === 0 ? 1400 : 800}
                  height={index === 0 ? 720 : 520}
                />
              )}
              <p>
                {article.categories?.[0]?.title || "Kalidash"} ·{" "}
                {article.publishedAt
                  ? new Date(article.publishedAt).toLocaleDateString("pt-BR")
                  : "Em breve"}
              </p>
              <h2>{article.title}</h2>
              <div>{article.excerpt}</div>
              <span>{article.author?.name || "Equipe Kalidash"}</span>
              <Link className={styles.read} href={`/blog/${article.slug}`}>
                Ler artigo ↗︎
              </Link>
            </article>
          ))}
        </section>

        <footer>
          <span>Kalidash · Blog</span>
          <Link href="/#diagnostico">Falar com a Kalidash ↗︎</Link>
        </footer>
      </main>
    </PixelTransition>
  );
}
