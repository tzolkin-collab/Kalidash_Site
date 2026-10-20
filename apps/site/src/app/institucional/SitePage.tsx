import Image from "next/image";
import Link from "next/link";
import { Inter, Source_Sans_3 } from "next/font/google";
import home from "../home/home.module.css";
import HomeHeader from "../home/HomeHeader";
import SiteFooter from "../home/SiteFooter";
import { ArrowRight, WhatsApp } from "../home/icons";
import { config } from "../home/content";
import styles from "./institucional.module.css";
import { Reveal, TestimonialCard } from "./Motion";
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

    case "heroMedia":
      return (
        <section className={styles.heroMedia}>
          <div className={styles.heroCopy}>
            <Eyebrow>{block.eyebrow}</Eyebrow>
            <h1><Lines lines={block.title} /></h1>
            <div className={styles.lead}>
              {block.lead.map((paragraph) => <p key={paragraph}><Rich text={paragraph} /></p>)}
            </div>
            {block.support && <p className={styles.meta}>{block.support}</p>}
            <Link className={home.primaryButton} href={block.cta.href}>
              {block.cta.label} <ArrowRight />
            </Link>
          </div>
          <div className={styles.heroImage}>
            <Image
              src={block.image.src}
              alt={block.image.alt}
              width={block.image.width}
              height={block.image.height}
              sizes="(max-width: 900px) 100vw, 40vw"
              priority
            />
          </div>
        </section>
      );

    case "proofBar": {
      // Só publica o que está `confirmed` (NPS e logos aguardam resposta da Carol).
      const metrics = block.metrics.filter((metric) => metric.confirmed);
      const logos = block.logos?.confirmed ? block.logos : undefined;
      return (
        <section className={styles.proofBar} aria-label="Resultados">
          <ul className={styles.metrics}>
            {metrics.map((metric) => (
              <li key={metric.label}>
                <strong>{metric.value}</strong> <span>{metric.label}</span>
              </li>
            ))}
          </ul>
          {logos && (
            <div className={styles.logoStrip}>
              <p>{logos.caption}</p>
              <ul>
                {logos.items.map((logo) => (
                  <li key={logo.name}>
                    {logo.src ? <Image src={logo.src} alt={logo.name} width={140} height={28} unoptimized /> : logo.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      );
    }

    case "formats":
      return (
        <section className={styles.formats}>
          <div className={styles.formatsBg} aria-hidden="true">
            <Image src={block.background.src} alt="" width={block.background.width} height={block.background.height} sizes="100vw" />
          </div>
          <div className={styles.formatsInner}>
            <header className={styles.formatsHead}>
              <Eyebrow>{block.eyebrow}</Eyebrow>
              <h2><Lines lines={block.title} /></h2>
            </header>
            <Reveal as="ul" className={styles.formatCards}>
              {block.items.map((card, index) => (
                <li key={card.title} className={styles.formatCard} style={{ "--i": index } as React.CSSProperties}>
                  <h3>{card.title}</h3>
                  <p className={styles.formatAudience}><Rich text={card.audience} /></p>
                  <p>{card.text}</p>
                  {card.features && (
                    <ul className={styles.formatFeatures}>
                      {card.features.map((feature) => (
                        <li key={feature.title}><strong>{feature.title}:</strong> {feature.text}</li>
                      ))}
                    </ul>
                  )}
                  {card.extra && <p>{card.extra}</p>}
                  <p className={styles.formatSupport}>{card.support}</p>
                  <Link className={card.ctaStyle === "primary" ? home.primaryButton : home.secondaryButton} href={card.cta.href}>
                    {card.cta.label} <ArrowRight />
                  </Link>
                </li>
              ))}
            </Reveal>
          </div>
        </section>
      );

    case "testimonials": {
      // Produção: só depoimentos aprovados. Em `next dev`, os pendentes aparecem como espaço reservado.
      const items = block.items.filter((item) => item.status === "approved" || process.env.NODE_ENV !== "production");
      if (items.length === 0) return null;
      return (
        <section className={styles.section} data-wide>
          <header className={styles.head}>
            <Eyebrow>{block.eyebrow}</Eyebrow>
            <h2><Lines lines={block.title} /></h2>
          </header>
          <ul className={styles.testimonials}>
            {items.map((item) => <li key={item.nome}><TestimonialCard item={item} /></li>)}
          </ul>
        </section>
      );
    }

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
          <Reveal as="ol" className={styles.steps}>
            {block.items.map((item, index) => (
              <li key={item.title} style={{ "--i": index } as React.CSSProperties}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </li>
            ))}
          </Reveal>
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
