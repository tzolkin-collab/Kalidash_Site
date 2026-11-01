import Image from "next/image";
import Link from "next/link";
import home from "../home/home.module.css";
import HomeHeader from "../home/HomeHeader";
import SiteFooter from "../home/SiteFooter";
import { ArrowRight, WhatsApp } from "../home/icons";
import { config } from "../home/content";
import type { Block, PageContent } from "../institucional/pages";
import sn from "../sobre-nos/sobre-nos.module.css";
import CountUp from "./CountUp";
import { BlockView, HeroView, Legend, toneMap } from "./ProductPage";
import prod from "./product.module.css";
import sol from "./solucoes.module.css";
import styles from "./kit.module.css";

/* Página institucional de leitura (Advisory, AI Culture, Execução) na linguagem da /solucoes:
 * manchete em cartaz, foto como objeto, afirmação + frase-chave, listas em linhas, faixa escura
 * para a sequência e fecho quente. Texto e ordem vêm de pages.ts; dado `confirmed: false` não é publicado. */

type Of<T extends Block["type"]> = Extract<Block, { type: T }>;

function Rich({ text }: { text: string }) {
  return <>{text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))}</>;
}

function HeroWide({ block }: { block: Of<"heroMedia"> }) {
  return (
    <header className={`${sn.hero} ${styles.long}`}>
      <div className={prod.wrap}>
        <p className={sn.meta}>{block.eyebrow}</p>
        <div className={sn.heroTop}>
          <h1>
            {block.title.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </h1>
          <div className={sn.heroLead}>
            {block.lead.map((p) => (
              <p key={p}><Rich text={p} /></p>
            ))}
            {block.cta && (
              <Link className={home.primaryButton} href={block.cta.href}>
                {block.cta.label} <ArrowRight />
              </Link>
            )}
          </div>
        </div>
        <div className={sn.heroPhoto}>
          <Image src={block.image.src} alt={block.image.alt} width={block.image.width} height={block.image.height} priority sizes="(max-width: 900px) 100vw, 1280px" />
        </div>
      </div>
    </header>
  );
}

function TextView({ block, soft }: { block: Of<"text">; soft: boolean }) {
  return (
    <section className={`${prod.section}${soft ? ` ${prod.soft}` : ""}`}>
      <div className={prod.wrap}>
        {block.eyebrow && <Legend>{block.eyebrow}</Legend>}
        <div className={styles.assert}>
          <h2>{block.title.join(" ")}</h2>
          {block.paragraphs && (
            <div className={styles.paragraphs}>
              {block.paragraphs.map((p) => (
                <p key={p}><Rich text={p} /></p>
              ))}
            </div>
          )}
        </div>
        {block.chips && (
          <ol className={styles.ruled}>
            {block.chips.map((chip, i) => (
              <li key={chip}>
                <span className={prod.num}>{String(i + 1).padStart(2, "0")}</span>
                <span>{chip}</span>
              </li>
            ))}
          </ol>
        )}
        {block.highlight && <p className={sn.keyline}>{block.highlight.join(" ")}</p>}
      </div>
    </section>
  );
}

function ListView({ block, soft }: { block: Of<"list">; soft: boolean }) {
  return (
    <section className={`${prod.section} ${prod.split}${soft ? ` ${prod.soft}` : ""}`}>
      <div className={`${prod.wrap} ${prod.splitGrid}`}>
        <header className={prod.sticky}>
          {block.eyebrow && <Legend>{block.eyebrow}</Legend>}
          <h2>{block.title.join(" ")}</h2>
        </header>
        <div>
          <ul className={styles.criteria}>
            {block.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {(block.note || block.noteLink) && (
            <div className={styles.note}>
              {block.note && <p>{block.note}</p>}
              {block.noteLink && (
                <Link href={block.noteLink.href} className={home.textLink}>
                  {block.noteLink.label} <ArrowRight />
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* Formatos: uma linha por formato (título + público | texto + recursos | apoio + CTA). */
function FormatsView({ block, soft }: { block: Of<"formats">; soft: boolean }) {
  return (
    <section className={`${prod.section}${soft ? ` ${prod.soft}` : ""}`}>
      <div className={prod.wrap}>
        <Legend>{block.eyebrow}</Legend>
        <h2 className={prod.h2Wide}>{block.title.join(" ")}</h2>
        <ol className={styles.formats}>
          {block.items.map((item) => (
            <li key={item.title}>
              <div className={styles.formatHead}>
                <h3>{item.title}</h3>
                <p><Rich text={item.audience} /></p>
              </div>
              <div className={styles.formatBody}>
                <p>{item.text}</p>
                {item.features && (
                  <ul>
                    {item.features.map((f) => (
                      <li key={f.title}>
                        <strong>{f.title}</strong>
                        <span>{f.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {item.extra && <p className={styles.extra}>{item.extra}</p>}
              </div>
              <div className={styles.formatAside}>
                <p>{item.support}</p>
                <Link className={item.ctaStyle === "primary" ? home.primaryButton : home.secondaryButton} href={item.cta.href}>
                  {item.cta.label} <ArrowRight />
                </Link>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* Prova: régua dos números confirmados, caso em destaque e as duas soluções próprias em linhas. */
function ShowcaseView({ block, soft }: { block: Of<"showcase">; soft: boolean }) {
  const metrics = block.metrics.filter((m) => m.confirmed);
  const f = block.featured;
  return (
    <section className={`${prod.section}${soft ? ` ${prod.soft}` : ""}`}>
      <div className={prod.wrap}>
        <Legend>{block.eyebrow}</Legend>
        <h2 className={prod.h2Wide}>{block.title.join(" ")}</h2>
        {metrics.length > 0 && (
          <ul className={styles.numbers} style={{ "--n": metrics.length } as React.CSSProperties}>
            {metrics.map((m) => (
              <li key={m.value}>
                <strong><CountUp value={m.value} /></strong>
                <span>{m.label}</span>
              </li>
            ))}
          </ul>
        )}
        <article className={styles.case}>
          {f.image && (
            <div className={styles.casePhoto}>
              <Image src={f.image.src} alt={f.image.alt} width={f.image.width} height={f.image.height} sizes="(max-width: 900px) 100vw, 700px" loading="lazy" />
            </div>
          )}
          <div className={styles.caseText}>
            <p className={styles.badge}>{f.eyebrow}</p>
            <h3>{f.title}</h3>
            <p>{f.text}</p>
            {f.stats?.confirmed && <p className={styles.stat}>{f.stats.text}</p>}
            <p className={styles.badge}>{f.badge}</p>
            {f.pageReady && (
              <Link href={f.cta.href} className={home.textLink}>
                {f.cta.label} <ArrowRight />
              </Link>
            )}
          </div>
        </article>
        <ul className={styles.products}>
          {block.items.map((item) => (
            <li key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
              {item.href && (
                <Link href={item.href} className={home.textLink}>
                  Saiba mais <ArrowRight />
                </Link>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const LIGHT: Block["type"][] = ["text", "list", "cards", "faq", "formats", "showcase"];

export default function KitPage({ page, closing }: { page: PageContent; closing: string }) {
  const hero = page.blocks.find((b): b is Of<"heroMedia"> => b.type === "heroMedia");
  if (!hero) return null;
  const portrait = hero.image.height > hero.image.width;
  const tones = toneMap(page.blocks, LIGHT);
  return (
    <div className={`${home.home} ${sol.page}`} data-page={page.slug}>
      <HomeHeader />
      <main>
        {portrait ? <HeroView hero={hero} kind="photo" /> : <HeroWide block={hero} />}
        {page.blocks.map((block, index) => {
          if (block.type === "heroMedia") return null;
          const key = `${block.type}-${index}`;
          const soft = tones[index];
          switch (block.type) {
            case "text": return <TextView key={key} block={block} soft={soft} />;
            case "list": return <ListView key={key} block={block} soft={soft} />;
            case "formats": return <FormatsView key={key} block={block} soft={soft} />;
            case "showcase": return <ShowcaseView key={key} block={block} soft={soft} />;
            /* Depoimentos só vão ao ar com vídeo aprovado e hospedado (ver pages.ts): sem isso, nada. */
            case "testimonials": return null;
            case "cards":
              /* Com exemplo por item vira tabela de 4 colunas; sem exemplo, índice com título fixo. */
              return <BlockView key={key} block={block} cardsIndex={block.items.some((it) => it.example) ? 0 : 1} poster={false} soft={soft} />;
            default:
              return <BlockView key={key} block={block} cardsIndex={1} poster={false} soft={soft} />;
          }
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
