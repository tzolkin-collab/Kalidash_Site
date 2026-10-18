import Link from "next/link";
import { Inter, Source_Sans_3 } from "next/font/google";
import home from "../home/home.module.css";
import HomeHeader from "../home/HomeHeader";
import SiteFooter from "../home/SiteFooter";
import { ArrowRight, WhatsApp } from "../home/icons";
import { config } from "../home/content";
import styles from "./institucional.module.css";
import type { Block, PageContent } from "./pages";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const sourceSans = Source_Sans_3({ subsets: ["latin"], variable: "--font-source-sans", display: "swap" });

/* **trecho** vira negrito. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/\*\*(.+?)\*\*/g).map((part, index) => (index % 2 ? <strong key={index}>{part}</strong> : part))}
    </>
  );
}

function Lines({ lines }: { lines: string[] }) {
  return (
    <>
      {lines.map((line, index) => (
        <span key={line}>
          {index > 0 && <br />}
          {line}
        </span>
      ))}
    </>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className={home.eyebrow}>{children}</p>;
}

function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={home.textLink}>
      {children} <ArrowRight />
    </Link>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "hero":
      return (
        <section className={styles.hero}>
          <Eyebrow>{block.eyebrow}</Eyebrow>
          <h1><Lines lines={block.title} /></h1>
          <div className={styles.lead}>
            {block.lead.map((paragraph) => <p key={paragraph}><Rich text={paragraph} /></p>)}
          </div>
          {block.tagline && <p className={styles.tagline}>{block.tagline}</p>}
          {block.meta && <p className={styles.meta}>{block.meta}</p>}
          <Link className={home.primaryButton} href={block.cta.href}>
            {block.cta.label} <ArrowRight />
          </Link>
        </section>
      );

    case "text":
      return (
        <section className={styles.section}>
          <header className={styles.head}>
            {block.eyebrow && <Eyebrow>{block.eyebrow}</Eyebrow>}
            <h2><Lines lines={block.title} /></h2>
          </header>
          <div className={styles.body}>
            {block.paragraphs?.map((paragraph) => <p key={paragraph}><Rich text={paragraph} /></p>)}
            {block.highlight && (
              <p className={styles.highlight}><Lines lines={block.highlight} /></p>
            )}
          </div>
        </section>
      );

    case "cards":
      return (
        <section className={styles.section}>
          <header className={styles.head}>
            {block.eyebrow && <Eyebrow>{block.eyebrow}</Eyebrow>}
            <h2><Lines lines={block.title} /></h2>
            {block.intro?.map((paragraph) => <p key={paragraph}><Rich text={paragraph} /></p>)}
          </header>
          <div className={styles.body}>
            <ul className={styles.cards} data-columns={block.columns ?? 3}>
              {block.items.map((item) => (
                <li key={item.title} className={styles.card}>
                  <h3>{item.title}</h3>
                  <p><Rich text={item.text} /></p>
                  {item.href && <TextLink href={item.href}>{item.cta ?? "Saiba mais"}</TextLink>}
                </li>
              ))}
            </ul>
            {block.closing?.map((paragraph) => <p key={paragraph} className={styles.closing}><Rich text={paragraph} /></p>)}
            {block.cta && (
              <div className={styles.inlineCta}>
                <TextLink href={block.cta.href}>{block.cta.label}</TextLink>
              </div>
            )}
          </div>
        </section>
      );

    case "steps":
      return (
        <section className={styles.section} data-wide>
          <header className={styles.head}>
            {block.eyebrow && <Eyebrow>{block.eyebrow}</Eyebrow>}
            <h2><Lines lines={block.title} /></h2>
          </header>
          <ol className={styles.steps}>
            {block.items.map((item, index) => (
              <li key={item.title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </li>
            ))}
          </ol>
          {block.closing && (
            <div className={styles.stepsClosing}>
              {block.closing.map((paragraph, index) => (
                <p key={paragraph} data-lead={index === 0}><Rich text={paragraph} /></p>
              ))}
            </div>
          )}
        </section>
      );

    case "list":
      return (
        <section className={styles.section}>
          <header className={styles.head}>
            {block.eyebrow && <Eyebrow>{block.eyebrow}</Eyebrow>}
            <h2><Lines lines={block.title} /></h2>
          </header>
          <div className={styles.body}>
            <ul className={styles.checks}>
              {block.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
            {block.note && <p className={styles.highlight}>{block.note}</p>}
          </div>
        </section>
      );

    case "offers":
      return (
        <div className={styles.offers}>
          {block.items.map((offer) => (
            <section key={offer.title} id={offer.id} className={styles.offer}>
              <header className={styles.head}>
                <Eyebrow>{offer.eyebrow}</Eyebrow>
                <h2>{offer.title}</h2>
              </header>
              <div className={styles.body}>
                <p><Rich text={offer.text} /></p>
                {offer.features && (
                  <ul className={styles.features}>
                    {offer.features.map((feature) => (
                      <li key={feature.title}>
                        <h3>{feature.title}</h3>
                        <p>{feature.text}</p>
                      </li>
                    ))}
                  </ul>
                )}
                {offer.note && <p className={styles.note}>{offer.note}</p>}
                <div className={styles.inlineCta}>
                  <TextLink href={offer.cta.href}>{offer.cta.label}</TextLink>
                </div>
              </div>
            </section>
          ))}
        </div>
      );

    case "proof":
      return (
        <section className={styles.proof}>
          <div className={styles.proofCols}>
            {block.items.map((item) => (
              <div key={item.label}>
                <Eyebrow>{item.label}</Eyebrow>
                <p>{item.names}</p>
              </div>
            ))}
          </div>
          {block.closing && <p className={styles.proofClosing}><Lines lines={block.closing} /></p>}
        </section>
      );

    case "cta":
      return (
        <section className={styles.cta}>
          <div>
            {block.eyebrow && <p className={`${home.eyebrow} ${styles.ctaEyebrow}`}>{block.eyebrow}</p>}
            <h2>{block.title}</h2>
            <p>{block.text}</p>
            {block.microcopy && <strong>{block.microcopy}</strong>}
          </div>
          <Link className={home.primaryButton} href={block.cta.href}>
            {block.cta.label} <ArrowRight />
          </Link>
        </section>
      );
  }
}

export default function SitePage({ page }: { page: PageContent }) {
  return (
    <div className={`${inter.variable} ${sourceSans.variable} ${home.home} ${styles.page}`} data-page={page.slug}>
      <HomeHeader />
      <main>
        {page.blocks.map((block, index) => <BlockView key={index} block={block} />)}
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
