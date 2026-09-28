import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import styles from "./blog.module.css";
import PixelTransition from "../components/PixelTransition";
import { fetchPublishedArticles } from "@/lib/blog";

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

export default async function BlogPage() {
  const items = await fetchPublishedArticles();

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

        {items.length > 0 ? (
          <section className={styles.posts}>
            {items.map((article, index) => (
              <article
                key={article.id}
                className={index === 0 ? styles.featured : ""}
              >
                {article.coverImageUrl && (
                  // URL livre, colada no admin; sem CDN de imagem própria ainda, então sem
                  // next/image aqui (precisaria de remotePatterns pra qualquer domínio).
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className={styles.cover}
                    src={article.coverImageUrl}
                    alt={article.title || ""}
                    style={{ objectPosition: `50% ${article.coverImagePos}%` }}
                  />
                )}
                <p>
                  {article.categories?.[0] || "Kalidash"} ·{" "}
                  {article.publishedAt
                    ? new Date(article.publishedAt).toLocaleDateString("pt-BR")
                    : "Em breve"}
                </p>
                <h2>{article.title}</h2>
                <div>{article.excerpt}</div>
                <span>{article.authorName || "Equipe Kalidash"}</span>
                <Link className={styles.read} href={`/blog/${article.slug}`}>
                  Ler artigo ↗︎
                </Link>
              </article>
            ))}
          </section>
        ) : (
          <section className={styles.posts}>
            <article>
              <p>Kalidash</p>
              <h2>Os primeiros artigos estão a caminho.</h2>
              <div>Nenhum artigo publicado ainda — volte em breve.</div>
            </article>
          </section>
        )}

        <footer>
          <span>Kalidash · Blog</span>
          <Link href="/#diagnostico">Falar com a Kalidash ↗︎</Link>
        </footer>
      </main>
    </PixelTransition>
  );
}
