"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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

export type GalleryCategory = {
  name: string;
  slug: string;
  description?: string;
  hidden?: boolean;
};

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
  /** Categorias do artigo (ex.: "Cases", "Posts"); alimentam o filtro da galeria. Opcional no preview. */
  categories?: string[];
  authorName: string;
  href: string;
};

/** "Estudos de Caso" -> "estudos-de-caso": identifica a categoria na URL (?categoria=). */
export const categorySlug = (label: string) =>
  label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Categorias que vêm primeiro no filtro, nesta ordem; as demais seguem em ordem alfabética. */
const PREFERRED_CATEGORIES = ["cases", "posts"];

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
  categoriesCatalog,
  initialCategorySlug = null,
}: {
  heroHtml?: string | null;
  items: GalleryItem[];
  categoriesCatalog?: GalleryCategory[];
  initialCategorySlug?: string | null;
}) {
  const [active, setActive] = useState<string | null>(
    initialCategorySlug ? categorySlug(initialCategorySlug) : null,
  );

  const categories = useMemo(() => {
    const hiddenSlugs = new Set<string>();
    const ordered: { slug: string; label: string; description?: string }[] = [];
    const seen = new Set<string>();

    for (const cat of categoriesCatalog ?? []) {
      const slug = categorySlug(cat.slug || cat.name);
      if (!slug) continue;
      if (cat.hidden) {
        hiddenSlugs.add(slug);
        continue;
      }
      if (!seen.has(slug)) {
        seen.add(slug);
        ordered.push({ slug, label: cat.name.trim(), description: cat.description });
      }
    }

    const extras = new Map<string, string>();
    for (const item of items) {
      for (const label of item.categories ?? []) {
        const slug = categorySlug(label);
        if (slug && !seen.has(slug) && !hiddenSlugs.has(slug) && !extras.has(slug)) {
          extras.set(slug, label.trim());
        }
      }
    }

    const rank = (slug: string) => {
      const i = PREFERRED_CATEGORIES.indexOf(slug);
      return i === -1 ? PREFERRED_CATEGORIES.length : i;
    };
    const sortedExtras = [...extras.entries()]
      .map(([slug, label]) => ({ slug, label }))
      .sort((a, b) => rank(a.slug) - rank(b.slug) || a.label.localeCompare(b.label, "pt-BR"));

    return [...ordered, ...sortedExtras];
  }, [items, categoriesCatalog]);

  // Link direto para uma categoria: /blog?categoria=cases ou /blog/categoria/[slug]
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("categoria");
    if (wanted) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActive(categorySlug(wanted));
    } else if (initialCategorySlug) {
      setActive(categorySlug(initialCategorySlug));
    } else {
      setActive(null);
    }
  }, [initialCategorySlug]);

  const select = (slug: string | null) => {
    setActive(slug);
    const url = new URL(window.location.href);
    if (slug) url.searchParams.set("categoria", slug);
    else url.searchParams.delete("categoria");
    window.history.replaceState(null, "", url);
  };

  const filtersRef = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const checkScroll = () => {
      const el = filtersRef.current;
      if (!el) {
        setScrolled(false);
        return;
      }
      // O filtro só sobe para o header depois que a faixa original saiu COMPLETAMENTE da vista:
      // a base dela passou da borda de baixo do header (desktop: header branco de ~56px cobre a faixa;
      // tablet e celular: o header é transparente, então só vale quando a base passa do topo da tela).
      // Antes, o limiar era o TOPO da faixa encostar no header: ela ainda estava inteira na tela, sumia
      // da página (deixando um buraco) e a cópia no header aparecia ao mesmo tempo.
      const rect = el.getBoundingClientRect();
      const header = document.querySelector("header");
      const solidHeader = window.matchMedia("(min-width: 1101px)").matches;
      const headerBottom = solidHeader && header ? header.getBoundingClientRect().bottom : 0;
      const isDocked = rect.bottom <= headerBottom;
      setScrolled((prev) => (prev !== isDocked ? isDocked : prev));
    };

    const handleScroll = () => {
      checkScroll();
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });
    checkScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    map.set("all", items.length);
    for (const item of items) {
      for (const label of item.categories ?? []) {
        const slug = categorySlug(label);
        map.set(slug, (map.get(slug) ?? 0) + 1);
      }
    }
    return map;
  }, [items]);

  const visible = active
    ? items.filter((item) => (item.categories ?? []).some((c) => categorySlug(c) === active))
    : items;
  const activeLabel = categories.find((c) => c.slug === active)?.label;

  const renderFilterButtons = (inHeader: boolean) => (
    <div className={inHeader ? styles.headerFiltersInner : styles.filtersInner}>
      <button type="button" aria-pressed={active === null} onClick={() => select(null)}>
        <span>Todos</span>
        <span className={styles.filterBadge}>{counts.get("all") ?? items.length}</span>
      </button>
      {categories.map((category) => {
        const count = counts.get(category.slug) ?? 0;
        return (
          <button
            key={category.slug}
            type="button"
            aria-pressed={active === category.slug}
            onClick={() => select(category.slug)}
          >
            <span>{category.label}</span>
            {count > 0 && <span className={styles.filterBadge}>{count}</span>}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className={styles.page}>
      <HomeHeader
        bg="white"
        filterSlot={categories.length > 0 ? renderFilterButtons(true) : undefined}
        filtersActive={scrolled}
      />

      <main className={styles.main}>
        {heroHtml ? (
          <section
            className={styles.hero}
            data-block="hero"
            data-focus="hero"
            dangerouslySetInnerHTML={{ __html: heroHtml }}
          />
        ) : (
          <section className={styles.hero} data-block="hero" data-focus="hero">
            <p>Inteligência aplicada ao trabalho</p>
            <h1>
              Ideias para a próxima <span>operação.</span>
            </h1>
            <div>
              Conteúdo sobre cultura, processos, tecnologia e organizações que trabalham com agentes.
            </div>
          </section>
        )}

        {categories.length > 0 && (
          <nav
            ref={filtersRef}
            className={styles.filters}
            data-block="category-filter"
            data-docked={scrolled ? "true" : "false"}
            aria-label="Filtrar por categoria"
          >
            {renderFilterButtons(false)}
          </nav>
        )}

        {visible.length > 0 ? (
          <section className={styles.posts} data-block="gallery" data-count={visible.length}>
            {visible.map((item, index) => {
              const total = visible.length;
              let isFeatured = false;
              let layoutRole = "default";

              if (total === 1) {
                // Caso único: 1 artigo solitário na categoria inteira (apresentação editorial refinada max ~920px)
                isFeatured = true;
                layoutRole = "single";
              } else if (total === 2) {
                // Caso de 2 artigos: dupla de abertura equilibrada lado a lado (50% / 50%)
                isFeatured = false;
                layoutRole = "duo";
              } else {
                // 3 ou mais artigos: 1º é destaque de capa (100%)
                isFeatured = index === 0;
                if (isFeatured) {
                  layoutRole = "featured";
                } else {
                  // Distribuição harmônica: nunca deixa 1 artigo órfão
                  const remaining = total - 1;
                  const remainder = remaining % 3;

                  if (remainder === 2 && index >= total - 2) {
                    // Últimos 2 artigos fecham a linha em dupla (50% / 50%)
                    layoutRole = "duo";
                  } else if (remainder === 1 && index >= total - 4) {
                    // Se sobraria 1 órfão, equilibra os últimos 4 em 2 duplas perfeitas (2 + 2)
                    layoutRole = "duo";
                  } else {
                    layoutRole = "default";
                  }
                }
              }

              return (
                <article
                  key={item.blockId ?? item.id}
                  data-block="article-card"
                  data-variant={isFeatured ? "featured" : "default"}
                  data-layout={layoutRole}
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
                  <h2>
                    <Link href={item.href}>{item.title}</Link>
                  </h2>
                  <div>{item.excerpt}</div>
                  <span>{item.authorName || "Equipe Kalidash"}</span>
                  <Link data-role="read-more" href={item.href}>
                    Ler artigo <span aria-hidden="true">→</span>
                  </Link>
                </article>
              );
            })}
          </section>
        ) : (
          <section className={styles.posts} data-block="gallery">
            <article data-block="article-card" data-variant="default">
              <p>{activeLabel ?? "Kalidash"}</p>
              <h2>{active ? "Ainda não há conteúdo nesta categoria." : "Os primeiros artigos estão a caminho."}</h2>
              <div>{active ? "Veja todos os conteúdos do blog ou volte em breve." : "Nenhum artigo publicado ainda — volte em breve."}</div>
            </article>
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
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
      <HomeHeader bg="white" />

      <main className={articleStyles.mainContainer}>
        {/* Barra superior de navegação / breadcrumb */}
        <nav className={articleStyles.breadcrumbNav} aria-label="Navegação estrutural">
          <Link href="/blog" className={articleStyles.backButton}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
            <Link href={`/blog/categoria/${categorySlug(primaryCategory)}`} className={articleStyles.breadcrumbActive}>{primaryCategory}</Link>
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
                <small className={articleStyles.authorRole}>Kalidash</small>
              </div>
            </div>

            <ShareButtons title={article.title} url={url} className={articleStyles.shareTop} />
          </div>

          {article.coverImageUrl && (
            <div className={articleStyles.coverContainer}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
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
            <div className={articleStyles.ctaCopy}>
              <p className={articleStyles.ctaEyebrow}>Consultoria e Educação em IA</p>
              <h2 className={articleStyles.ctaTitle}>
                Prepare sua operação para trabalhar com agentes de IA.
              </h2>
              <p className={articleStyles.ctaDescription}>
                Conectamos cultura, método e execução técnica à rotina real da sua empresa
                para gerar produtividade, previsibilidade e escala.
              </p>
            </div>
            <div className={articleStyles.ctaActions}>
              <Link href="/diagnostico" className={articleStyles.ctaPrimaryBtn}>
                Fazer diagnóstico gratuito ↗︎
              </Link>
              <Link href="/sobre-nos" className={articleStyles.ctaSecondaryBtn}>
                Conhecer a Kalidash
              </Link>
            </div>
          </section>

          {/* Artigos recomendados */}
          {relatedArticles.length > 0 && (
            <section className={articleStyles.relatedSection}>
              <div className={articleStyles.relatedHeader}>
                <span className={articleStyles.relatedEyebrow}>Leitura complementar</span>
                <h2 className={articleStyles.relatedTitle}>Continue explorando</h2>
              </div>
              <div className={articleStyles.relatedGrid}>
                {relatedArticles.map((item) => {
                  const showCovers = relatedArticles.every((r) => Boolean(r.coverImageUrl));
                  return (
                    <Link key={item.id} href={item.href} className={articleStyles.relatedCard}>
                      {showCovers && item.coverImageUrl && (
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
                  );
                })}
              </div>
            </section>
          )}
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
