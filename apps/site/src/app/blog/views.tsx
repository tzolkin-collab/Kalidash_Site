"use client";

import Image from "next/image";
import Link from "next/link";
import styles from "./blog.module.css";
import articleStyles from "./[slug]/article.module.css";
import HomeHeader from "../home/HomeHeader";
import SiteFooter from "../home/SiteFooter";
import ReadingProgressBar from "./ReadingProgressBar";
import ShareButtons from "./ShareButtons";
import { SITE_URL } from "@/lib/siteUrl";

/* Views do blog — UMA implementação só, usada pelas páginas reais (/blog, /blog/[slug]) e
 * pelas rotas de preview do admin (/preview/*). É isso que garante que o preview é o site.
 *
 * Contrato com o admin e com o CSS (ver docs/blog-design-contrato.md):
 *  - data-block="..."  identifica a região/bloco (hero, gallery, article-card, article-body…)
 *  - data-variant="..." é a opção de layout escolhida no admin (hoje: featured | default)
 *  - data-role="..."   papel de um elemento dentro do bloco (cover, read-more)
 *  - data-focus="..."  o que o admin deve focar quando alguém clica ali no preview
 * O CSS (blog.module.css, article.module.css) só reage a esses atributos e às tags; o admin
 * nunca escreve CSS, só escolhe valores de data-variant e conteúdo. */

export type GalleryItem = {
  id: string;
  /** id do bloco (cartão) no editor do admin; só existe no preview */
  blockId?: string;
  title: string;
  excerpt: string;
  coverImageUrl?: string | null;
  coverImagePos: number;
  /** "Categoria · data", já formatado por quem monta o item */
  meta: string;
  authorName: string;
  href: string;
};

export type ArticleViewData = {
  title: string;
  excerpt: string;
  categories: string[];
  authorName: string;
  coverImageUrl?: string | null;
  coverImagePos: number;
  /** HTML do corpo, exportado pelo editor do admin */
  body: string;
  publishedAt?: string | null;
};

export function estimateReadingTime(textOrHtml: string): number {
  if (!textOrHtml) return 3;
  const plainText = textOrHtml.replace(/<[^>]+>/g, " ");
  const wordCount = plainText.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}

export function BlogGalleryView({
  heroHtml,
  items,
}: {
  heroHtml?: string | null;
  items: GalleryItem[];
}) {
  return (
    <main className={styles.page}>
      <header>
        <Link href="/">
          <Image src="/brand/logo-white.svg" alt="Kalidash" width={154} height={24} unoptimized />
        </Link>
        <nav>
          <Link href="/">Início</Link>
          <Link href="/#metodo">Método</Link>
          <Link href="/#diagnostico">Conversar ↗︎</Link>
        </nav>
      </header>

      {heroHtml ? (
        <section
          className={styles.hero}
          data-block="hero"
          data-focus="hero"
          dangerouslySetInnerHTML={{ __html: heroHtml }}
        />
      ) : (
        <section className={styles.hero} data-block="hero" data-focus="hero">
          <p>[ inteligência aplicada ao trabalho ]</p>
          <h1>
            Ideias para a próxima <span>operação.</span>
          </h1>
          <div>
            Conteúdo sobre cultura, processos, tecnologia e organizações que trabalham com agentes.
          </div>
        </section>
      )}

      {items.length > 0 ? (
        <section className={styles.posts} data-block="gallery">
          {items.map((item, index) => (
            <article
              key={item.blockId ?? item.id}
              data-block="article-card"
              data-variant={index === 0 ? "featured" : "default"}
              data-focus="card"
              data-block-id={item.blockId}
            >
              {item.coverImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  data-role="cover"
                  src={item.coverImageUrl}
                  alt={item.title || ""}
                  width={1280}
                  height={720}
                  loading={index === 0 ? "eager" : "lazy"}
                  fetchPriority={index === 0 ? "high" : undefined}
                  decoding="async"
                  style={{ objectPosition: `50% ${item.coverImagePos}%` }}
                />
              )}
              <p>{item.meta}</p>
              <h2>{item.title}</h2>
              <div>{item.excerpt}</div>
              <span>{item.authorName || "Equipe Kalidash"}</span>
              <Link data-role="read-more" href={item.href}>
                Ler artigo ↗︎
              </Link>
            </article>
          ))}
        </section>
      ) : (
        <section className={styles.posts} data-block="gallery">
          <article data-block="article-card" data-variant="default">
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
  );
}

export function ArticleView({
  article,
  relatedArticles = [],
  shareUrl,
}: {
  article: ArticleViewData;
  relatedArticles?: GalleryItem[];
  /** URL absoluta do artigo (montada no servidor com SITE_URL + slug); sem ela, vale a do blog */
  shareUrl?: string;
}) {
  const url = shareUrl ?? `${SITE_URL}/blog`;
  const readingTime = estimateReadingTime(article.body || article.excerpt);
  const formattedDate = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";
  const primaryCategory = article.categories?.[0] || "AI Culture";

  return (
    <div className={articleStyles.page}>
      <ReadingProgressBar />
      <HomeHeader />

      <main className={articleStyles.mainContainer}>
        {/* Barra superior de navegação / breadcrumb */}
        <nav className={articleStyles.breadcrumbNav} aria-label="Navegação estrutural">
          <Link href="/blog" className={articleStyles.backButton}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Voltar ao Blog
          </Link>
          <div className={articleStyles.breadcrumbTrail}>
            <Link href="/">Início</Link>
            <span>/</span>
            <Link href="/blog">Blog</Link>
            <span>/</span>
            <span className={articleStyles.breadcrumbActive}>{primaryCategory}</span>
          </div>
        </nav>

        <article className={articleStyles.articleContent}>
          {/* Metadados e cabeçalho */}
          <div className={articleStyles.headerMeta}>
            <p data-focus="meta" className={articleStyles.categoryBadge}>
              {primaryCategory}
            </p>
            {formattedDate && (
              <>
                <span className={articleStyles.metaDot}>·</span>
                <span className={articleStyles.dateText}>{formattedDate}</span>
              </>
            )}
            <span className={articleStyles.metaDot}>·</span>
            <span className={articleStyles.readingBadge}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {readingTime} min de leitura
            </span>
          </div>

          <h1 className={articleStyles.title} data-focus="title">
            {article.title}
          </h1>

          <div className={articleStyles.excerpt} data-focus="excerpt">
            {article.excerpt}
          </div>

          {/* Barra do autor e botões de compartilhamento */}
          <div className={articleStyles.authorBar}>
            <div className={articleStyles.authorProfile}>
              <div className={articleStyles.authorAvatar}>
                {article.authorName ? article.authorName.slice(0, 2).toUpperCase() : "KD"}
              </div>
              <div className={articleStyles.authorDetails}>
                <span data-focus="author" className={articleStyles.authorName}>
                  {article.authorName || "Equipe Kalidash"}
                </span>
                <small className={articleStyles.authorRole}>Kalidash Intelligence</small>
              </div>
            </div>

            <ShareButtons title={article.title} url={url} className={articleStyles.shareTop} />
          </div>

          {article.coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <div className={articleStyles.coverContainer}>
              <img
                className={articleStyles.cover}
                data-focus="cover"
                src={article.coverImageUrl}
                alt={article.title || "Imagem de capa do artigo"}
                width={1600}
                height={900}
                fetchPriority="high"
                decoding="async"
                style={{ objectPosition: `50% ${article.coverImagePos}%` }}
              />
            </div>
          )}

          <div
            className={articleStyles.body}
            data-block="article-body"
            data-focus="body"
            dangerouslySetInnerHTML={{ __html: article.body }}
          />

          {/* Rodapé do artigo com compartilhamento */}
          <div className={articleStyles.articleFooterShare}>
            <ShareButtons title={article.title} url={url} />
          </div>

          {/* Bloco de Conversão Kalidash */}
          <section className={articleStyles.conversionCta}>
            <div className={articleStyles.ctaGlow} />
            <p className={articleStyles.ctaEyebrow}>ACELERADORA DE EFICIÊNCIA OPERACIONAL</p>
            <h2 className={articleStyles.ctaTitle}>
              Prepare sua operação para a era dos agentes de IA
            </h2>
            <p className={articleStyles.ctaDescription}>
              Conectamos agentes de IA, automação e novas formas de trabalhar à rotina real
              da sua empresa para gerar produtividade, previsibilidade e escala.
            </p>
            <div className={articleStyles.ctaActions}>
              <Link href="/diagnostico" className={articleStyles.ctaPrimaryBtn}>
                Fazer Diagnóstico Operacional ↗︎
              </Link>
              <Link href="/#experiencia" className={articleStyles.ctaSecondaryBtn}>
                Conhecer a Kalidash
              </Link>
            </div>
          </section>

          {/* Artigos recomendados */}
          {relatedArticles.length > 0 && (
            <section className={articleStyles.relatedSection}>
              <h2 className={articleStyles.relatedTitle}>Continue explorando</h2>
              <div className={articleStyles.relatedGrid}>
                {relatedArticles.map((item) => (
                  <Link key={item.id} href={item.href} className={articleStyles.relatedCard}>
                    {item.coverImageUrl && (
                      <div className={articleStyles.relatedCoverWrap}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.coverImageUrl}
                          alt={item.title}
                          width={1280}
                          height={720}
                          loading="lazy"
                          decoding="async"
                          style={{ objectPosition: `50% ${item.coverImagePos}%` }}
                        />
                      </div>
                    )}
                    <span className={articleStyles.relatedMeta}>{item.meta}</span>
                    <h3 className={articleStyles.relatedCardTitle}>{item.title}</h3>
                    <p className={articleStyles.relatedExcerpt}>{item.excerpt}</p>
                    <span className={articleStyles.relatedReadMore}>Ler artigo ↗︎</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
