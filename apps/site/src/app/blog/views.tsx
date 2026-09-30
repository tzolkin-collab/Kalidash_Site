import Image from "next/image";
import Link from "next/link";
import styles from "./blog.module.css";
import articleStyles from "./[slug]/article.module.css";

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
          <Image src="/kalidash-logo-branca.webp" alt="Kalidash" width={154} height={30} />
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
                // URL livre, colada no admin; sem CDN de imagem própria ainda, então sem
                // next/image aqui (precisaria de remotePatterns pra qualquer domínio).
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  data-role="cover"
                  src={item.coverImageUrl}
                  alt={item.title || ""}
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

export function ArticleView({ article }: { article: ArticleViewData }) {
  return (
    <main className={articleStyles.page}>
      <header>
        <Link href="/blog">← Blog</Link>
        <Link href="/">Kalidash</Link>
      </header>

      <article>
        <p data-focus="meta">
          {article.categories?.[0] || "Kalidash"} ·{" "}
          {article.publishedAt && new Date(article.publishedAt).toLocaleDateString("pt-BR")}
        </p>
        <h1 className={articleStyles.title} data-focus="title">
          {article.title}
        </h1>
        <div className={articleStyles.excerpt} data-focus="excerpt">
          {article.excerpt}
        </div>
        <span data-focus="author">{article.authorName}</span>

        {article.coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- ver nota em GalleryView
          <img
            className={articleStyles.cover}
            data-focus="cover"
            src={article.coverImageUrl}
            alt={article.title || "Imagem de capa do artigo"}
            style={{ objectPosition: `50% ${article.coverImagePos}%` }}
          />
        )}

        <div
          className={articleStyles.body}
          data-block="article-body"
          data-focus="body"
          // O corpo já vem como HTML do editor (BlockNote) do admin.
          dangerouslySetInnerHTML={{ __html: article.body }}
        />
      </article>
    </main>
  );
}
