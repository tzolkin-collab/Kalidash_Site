import Image from "next/image";
import Link from "next/link";
import home from "../home/home.module.css";
import HomeHeader from "../home/HomeHeader";
import SiteFooter from "../home/SiteFooter";
import { ArrowRight, WhatsApp } from "../home/icons";
import { config } from "../home/content";
import type { Block, PageContent } from "../institucional/pages";
import CountUp from "./CountUp";
import { HeroParallax } from "./SolucoesStory";
import sol from "./solucoes.module.css";
import styles from "./product.module.css";

/* Página de produto (Kognis, Spectra AI): mesma linguagem da /solucoes — abertura escura em cartaz,
 * régua de números, seções em tabela/índice, faixa escura única para a sequência e fecho quente.
 * O texto vem de pages.ts; a ordem dos blocos não muda. */

function Rich({ text }: { text: string }) {
  return <>{text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))}</>;
}

type Hero = Extract<Block, { type: "heroMedia" }>;
type Cards = Extract<Block, { type: "cards" }>;

export function HeroView({ hero, kind }: { hero: Hero; kind: "cutout" | "photo" }) {
  const [lead, ...rest] = hero.lead;
  return (
    <HeroParallax className={`${sol.hero} ${styles.hero}`}>
      <div className={`${sol.heroInner} ${styles.heroInner}`}>
        <p className={sol.meta}>{hero.eyebrow}</p>
        <h1>
          {hero.title.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </h1>
        <div className={kind === "cutout" ? styles.cutout : styles.photo} aria-hidden={kind === "cutout" ? true : undefined}>
          <Image
            src={hero.image.src}
            alt={kind === "cutout" ? "" : hero.image.alt}
            width={hero.image.width}
            height={hero.image.height}
            priority
            sizes="(max-width: 900px) 90vw, 44vw"
          />
        </div>
        <div className={styles.lead}>
          <p><Rich text={lead} /></p>
          {rest.map((p) => (
            <p key={p}><Rich text={p} /></p>
          ))}
          {hero.support && <p className={styles.support}>{hero.support}</p>}
          {hero.cta && (
            <Link className={home.primaryButton} href={hero.cta.href}>
              {hero.cta.label} <ArrowRight />
            </Link>
          )}
        </div>
      </div>
      <div className={sol.meander} aria-hidden="true" />
    </HeroParallax>
  );
}

export function Legend({ children }: { children: React.ReactNode }) {
  return <p className={styles.legend}><span>{children}</span></p>;
}

/* Nota de rodapé dos cards (campo `closing` de pages.ts): hairline forte e texto corrido, sem caixa. */
function CardsClosing({ lines }: { lines: string[] }) {
  return (
    <div className={styles.footnote}>
      {lines.map((line) => (
        <p key={line}><Rich text={line} /></p>
      ))}
    </div>
  );
}

function CardsView({ block, variant, soft }: { block: Cards; variant: "table" | "index" | "poster"; soft: boolean }) {
  const tone = soft ? ` ${styles.soft}` : "";
  const title = block.title.join(" ");
  if (variant === "table") {
    return (
      <section className={`${styles.section}${tone}`}>
        <div className={styles.wrap}>
          <Legend>{block.eyebrow}</Legend>
          <h2 className={styles.h2Wide}>{title}</h2>
          <ol className={styles.table}>
            {block.items.map((item, i) => (
              <li key={item.title}>
                <span className={styles.num}>{String(i + 1).padStart(2, "0")}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                {item.example && <p className={styles.example}>{item.example}</p>}
              </li>
            ))}
          </ol>
          {block.closing && <CardsClosing lines={block.closing} />}
        </div>
      </section>
    );
  }
  return (
    <section className={`${styles.section} ${styles.split}${tone}`}>
      <div className={`${styles.wrap} ${styles.splitGrid}`}>
        <header className={styles.sticky}>
          {block.eyebrow && <Legend>{block.eyebrow}</Legend>}
          <h2>{title}</h2>
        </header>
        <div>
          <ul className={variant === "poster" ? styles.poster : styles.index}>
            {block.items.map((item) => (
              <li key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </li>
            ))}
          </ul>
          {block.closing && <CardsClosing lines={block.closing} />}
        </div>
      </div>
    </section>
  );
}

/* Alterna branco e cinza claro entre as seções de leitura, na ordem em que aparecem.
 * O hero é branco e a régua de números é cinza, então o primeiro bloco depois deles sempre contrasta;
 * a faixa preta não conta para a alternância. */
export function toneMap(blocks: Block[], light: Block["type"][]): boolean[] {
  let last = false;
  return blocks.map((block) => {
    if (block.type === "proofBar") {
      last = true;
      return false;
    }
    if (!light.includes(block.type)) return false;
    last = !last;
    return last;
  });
}

export function BlockView({ block, cardsIndex, poster, soft }: { block: Block; cardsIndex: number; poster: boolean; soft: boolean }) {
  switch (block.type) {
    case "proofBar":
      return (
        <section className={styles.rule} aria-label="Resultados">
          <ul className={styles.wrap} style={{ "--n": Math.min(4, block.metrics.filter((m) => m.confirmed).length) } as React.CSSProperties}>
            {block.metrics.filter((m) => m.confirmed).map((m) => (
              <li key={m.value}>
                <strong><CountUp value={m.value} /></strong>
                <span>{m.label}</span>
              </li>
            ))}
          </ul>
        </section>
      );
    case "cards":
      return <CardsView block={block} variant={poster ? "poster" : cardsIndex === 0 ? "table" : "index"} soft={soft} />;
    case "steps":
      return (
        <section className={styles.steps}>
          <div className={styles.wrap}>
            {block.eyebrow && <Legend>{block.eyebrow}</Legend>}
            <h2 className={styles.h2Wide}>{block.title.join(" ")}</h2>
            <ol className={styles.sequence} style={{ "--n": Math.min(4, block.items.length) } as React.CSSProperties}>
              {block.items.map((item, i) => (
                <li key={item.title}>
                  <span className={styles.stepNum}>{String(i + 1).padStart(2, "0")}</span>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </li>
              ))}
            </ol>
            {block.closing && (
              <div className={styles.stepsNote}>
                <p><Rich text={block.closing[0]} /></p>
                {block.closing[1] && <p><Rich text={block.closing[1]} /></p>}
              </div>
            )}
            {block.cta && (
              <Link className={`${home.primaryButton} ${styles.stepsCta}`} href={block.cta.href}>
                {block.cta.label} <ArrowRight />
              </Link>
            )}
          </div>
        </section>
      );
    case "faq":
      return (
        <section className={`${styles.section} ${styles.split}${soft ? ` ${styles.soft}` : ""}`}>
          <div className={`${styles.wrap} ${styles.splitGrid}`}>
            <header className={styles.sticky}>
              <h2>{block.title}</h2>
            </header>
            <div className={styles.faq}>
              {block.items.map((item) => (
                <details key={item.q}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "FAQPage",
                mainEntity: block.items.map((item) => ({
                  "@type": "Question",
                  name: item.q,
                  acceptedAnswer: { "@type": "Answer", text: item.a },
                })),
              }).replace(/</g, "\\u003c"),
            }}
          />
        </section>
      );
    default:
      return null;
  }
}

export default function ProductPage({ page, kind, closing }: { page: PageContent; kind: "cutout" | "photo"; closing: string }) {
  const hero = page.blocks.find((b): b is Hero => b.type === "heroMedia");
  if (!hero) return null;
  let cardsSeen = 0;
  const tones = toneMap(page.blocks, ["cards", "faq"]);
  return (
    <div className={`${home.home} ${sol.page}`} data-page={page.slug}>
      <HomeHeader />
      <main>
        <HeroView hero={hero} kind={kind} />
        {page.blocks.map((block, index) => {
          if (block.type === "heroMedia") return null;
          const i = block.type === "cards" ? cardsSeen++ : 0;
          return <BlockView key={`${block.type}-${index}`} block={block} cardsIndex={i} poster={kind === "photo"} soft={tones[index]} />;
        })}
        <section className={sol.closing}>
          <div className={sol.closingInner}>
            <p>{closing}</p>
            {hero.cta && (
              <Link className={sol.closingCta} href={hero.cta.href}>
                {hero.cta.label} <ArrowRight />
              </Link>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
      {config.whatsappUrl && (
        <a href={config.whatsappUrl} className={home.whatsapp} aria-label="Falar pelo WhatsApp" target="_blank" rel="noopener noreferrer">
          <WhatsApp />
        </a>
      )}
    </div>
  );
}
