import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";
import home from "../home/home.module.css";
import HomeHeader from "../home/HomeHeader";
import SiteFooter from "../home/SiteFooter";
import { ArrowRight, WhatsApp } from "../home/icons";
import { config } from "../home/content";
import styles from "./institucional.module.css";
import { mediaKind } from "./media";
import { Reveal, TestimonialCard } from "./Motion";
import type { Block, PageContent } from "./pages";

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

/* Procura public/logos/<slug>.(svg|png|webp). A faixa de logos só aparece se TODOS existirem. */
function resolveLogos(items: Array<{ name: string; slug: string }>) {
  const resolved = items.map((item) => {
    for (const ext of ["svg", "png", "webp"]) {
      if (fs.existsSync(path.join(process.cwd(), "public", "logos", `${item.slug}.${ext}`))) {
        return { name: item.name, src: `/logos/${item.slug}.${ext}` };
      }
    }
    return null;
  });
  return resolved.every(Boolean) ? (resolved as Array<{ name: string; src: string }>) : null;
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
        <section className={styles.heroMedia} data-aspect={block.aspect} data-frame={block.frame}>
          <div className={styles.heroCopy}>
            <Eyebrow>{block.eyebrow}</Eyebrow>
            <h1><Lines lines={block.title} /></h1>
            <div className={styles.lead}>
              {block.lead.map((paragraph) => <p key={paragraph}><Rich text={paragraph} /></p>)}
            </div>
            {block.support && <p className={styles.meta}>{block.support}</p>}
            {block.cta && (
              <Link className={home.primaryButton} href={block.cta.href}>
                {block.cta.label} <ArrowRight />
              </Link>
            )}
          </div>
          <div className={styles.heroImage} data-aspect={block.aspect} data-frame={block.frame}>
            <Image
              src={block.image.src}
              alt={block.image.alt}
              width={block.image.width}
              height={block.image.height}
              sizes={block.frame === "none" ? "(max-width: 900px) 280px, 580px" : block.aspect === "landscape" ? "(max-width: 900px) 100vw, 50vw" : "(max-width: 900px) 100vw, 40vw"}
              priority
              fetchPriority="high"
            />
          </div>
        </section>
      );

    case "timeline":
      return (
        <section className={styles.section} data-timeline>
          <header className={styles.head}>
            <Eyebrow>{block.eyebrow}</Eyebrow>
            {block.photos && (
              <div className={styles.timelinePhotos}>
                {block.photos.map((photo, index) => (
                  <figure key={photo.src} className={styles.timelinePhoto} data-index={index}>
                    <div className={styles.timelinePhotoFrame}>
                      <Image
                        src={photo.src}
                        alt={photo.alt}
                        width={photo.width}
                        height={photo.height}
                        sizes="(max-width: 900px) 48vw, 240px"
                        loading="lazy"
                      />
                    </div>
                    <figcaption>{photo.caption}</figcaption>
                  </figure>
                ))}
              </div>
            )}
          </header>
          <Reveal as="ol" className={styles.timeline}>
            {block.items.map((item, index) => (
              <li key={item.marker} className={styles.timelineItem} style={{ "--i": index } as React.CSSProperties}>
                <p className={styles.timelineMarker}>
                  <span>{item.marker}</span> · {item.title}
                </p>
                <h3 className={styles.timelineLead}>{item.lead}</h3>
                <div className={styles.timelineBody}>
                  {item.paragraphs.map((paragraph) => (
                    <p key={paragraph}><Rich text={paragraph} /></p>
                  ))}
                </div>
                {item.quote && (
                  <blockquote className={styles.timelineQuote}>
                    {item.quote}
                  </blockquote>
                )}
                {item.highlight && (
                  <p className={styles.highlight}>{item.highlight}</p>
                )}
              </li>
            ))}
          </Reveal>
        </section>
      );

    case "beliefs":
      return (
        <section className={styles.section}>
          <header className={styles.head}>
            <Eyebrow>{block.eyebrow}</Eyebrow>
            <h2><Lines lines={block.title} /></h2>
            {block.intro.map((paragraph) => <p key={paragraph}><Rich text={paragraph} /></p>)}
          </header>
          <Reveal as="ul" className={styles.beliefs}>
            {block.items.map((item, index) => (
              <li key={item.belief} className={styles.beliefItem} style={{ "--i": index } as React.CSSProperties}>
                <span className={styles.beliefIndex}>{String(index + 1).padStart(2, "0")}</span>
                <div className={styles.beliefContent}>
                  <h3>{item.belief}</h3>
                  <p>{item.text}</p>
                </div>
              </li>
            ))}
          </Reveal>
        </section>
      );

    case "team":
      return (
        <section className={styles.teamSection}>
          <div className={styles.teamHeader}>
            <header className={styles.head}>
              <Eyebrow>{block.eyebrow}</Eyebrow>
              <h2><Lines lines={block.title} /></h2>
            </header>
            <p className={styles.teamIntro}>{block.text}</p>
          </div>
          <figure className={styles.teamFigure}>
            <div className={styles.teamPhoto}>
              <Image
                src={block.image.src}
                alt={block.image.alt}
                width={block.image.width}
                height={block.image.height}
                sizes="(max-width: 900px) 100vw, 1340px"
                loading="lazy"
              />
            </div>
            <figcaption className={styles.teamCaption}>
              Fundada por{" "}
              {block.founders.map((founder, index) => (
                <span key={founder.name}>
                  {index > 0 && " e "}
                  <a href={founder.linkedin} target="_blank" rel="noopener noreferrer">
                    {founder.name}
                  </a>{" "}
                  ({founder.role})
                </span>
              ))}
              .
            </figcaption>
          </figure>
        </section>
      );

    case "proofBar": {
      // Só publica o que está `confirmed` (NPS e logos aguardam resposta da Carol).
      const metrics = block.metrics.filter((metric) => metric.confirmed);
      const logoFiles = block.logos?.confirmed ? resolveLogos(block.logos.items) : null;
      const logos = block.logos && logoFiles ? { caption: block.logos.caption, items: logoFiles } : undefined;
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
                    <Image src={logo.src} alt={logo.name} width={140} height={28} unoptimized />
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
      // Só renderiza depoimento quando há mídia válida, cargo e empresa preenchidos.
      const ready = (item: (typeof block.items)[number]) =>
        item.status === "approved" && mediaKind(item.embedUrl) !== null && item.cargo.trim() !== "" && item.empresa.trim() !== "";
      const items = block.items.filter(ready);
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

    case "faq":
      return (
        <section className={styles.section}>
          <header className={styles.head}>
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

    case "showcase": {
      const metrics = block.metrics.filter((metric) => metric.confirmed);
      const { featured } = block;
      return (
        <section className={styles.section} data-wide>
          <header className={styles.head}>
            <Eyebrow>{block.eyebrow}</Eyebrow>
            <h2><Lines lines={block.title} /></h2>
          </header>
          <ul className={`${styles.metrics} ${styles.showcaseMetrics}`}>
            {metrics.map((metric) => (
              <li key={metric.label}>
                <strong>{metric.value}</strong> <span>{metric.label}</span>
              </li>
            ))}
          </ul>
          <Reveal className={styles.showcase}>
            <article className={styles.featuredCase}>
              <div className={styles.featuredCaseContent}>
                <p className={styles.caseEyebrow}>{featured.eyebrow}</p>
                <h3 className={styles.caseTitle}>{featured.title}</h3>
                <p>{featured.text}{featured.stats?.confirmed ? ` ${featured.stats.text}` : ""}</p>
                <p className={styles.caseBadge}>{featured.badge}</p>
                {featured.pageReady && <TextLink href={featured.cta.href}>{featured.cta.label}</TextLink>}
              </div>
              {featured.image && (
                <div className={styles.featuredCaseMedia}>
                  <Image
                    src={featured.image.src}
                    alt={featured.image.alt}
                    width={featured.image.width}
                    height={featured.image.height}
                    loading="lazy"
                  />
                </div>
              )}
            </article>
            <ul className={styles.smallCases}>
              {block.items.map((item, index) => (
                <li key={item.title} className={styles.card}>
                  <span className={styles.cardIndex}>{String(index + 1).padStart(2, "0")}</span>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                  {item.href && <TextLink href={item.href}>Saiba mais</TextLink>}
                </li>
              ))}
            </ul>
          </Reveal>
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
            {block.chips && (
              <Reveal as="ul" className={styles.chips}>
                {block.chips.map((chip, index) => (
                  <li key={chip} style={{ "--i": index } as React.CSSProperties}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    {chip}
                  </li>
                ))}
              </Reveal>
            )}
            {block.highlight && (
              <p className={styles.highlight}><Lines lines={block.highlight} /></p>
            )}
          </div>
        </section>
      );

    case "cards":
      return (
        <section className={styles.section} data-wide={block.columns === 3 || block.items.length >= 3 ? "" : undefined}>
          <header className={styles.head}>
            {block.eyebrow && <Eyebrow>{block.eyebrow}</Eyebrow>}
            <h2><Lines lines={block.title} /></h2>
            {block.intro?.map((paragraph) => <p key={paragraph}><Rich text={paragraph} /></p>)}
          </header>
          <div className={styles.body}>
            <Reveal as="ul" className={block.animated ? `${styles.cards} ${styles.cardsMotion}` : styles.cards} data-columns={block.columns ?? 3}>
              {block.items.map((item, index) => (
                <li key={item.title} className={styles.card} style={{ "--i": index } as React.CSSProperties}>
                  <span className={styles.cardIndex}>{String(index + 1).padStart(2, "0")}</span>
                  <h3>{item.title}</h3>
                  <p><Rich text={item.text} /></p>
                  {item.example && <p className={styles.example}>{item.example}</p>}
                  {item.href && <TextLink href={item.href}>{item.cta ?? "Saiba mais"}</TextLink>}
                </li>
              ))}
            </Reveal>
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
          <Reveal as="ol" className={styles.steps} data-count={block.items.length}>
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
          {block.cta && (
            <div className={styles.inlineCta}>
              <Link className={home.primaryButton} href={block.cta.href}>
                {block.cta.label} <ArrowRight />
              </Link>
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
            {block.noteLink && (
              <div className={styles.inlineCta}>
                <TextLink href={block.noteLink.href}>{block.noteLink.label}</TextLink>
              </div>
            )}
          </div>
        </section>
      );

    case "offers":
      return (
        <div className={styles.offers}>
          {block.items.map((offer, index) => (
            <section key={offer.title} id={offer.id} className={styles.offer}>
              <header className={styles.head}>
                <p className={styles.offerMarker}>
                  <span>{String(index + 1).padStart(2, "0")}</span> · {offer.eyebrow}
                </p>
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
        <section className={styles.proof} aria-label="Números e atuação da Kalidash">
          {block.credentials && (
            <ul className={styles.proofCredentials}>
              {block.credentials.map((cred) => (
                <li key={cred.text}>
                  {cred.strong && <strong>{cred.strong} </strong>}
                  <span>{cred.text}</span>
                </li>
              ))}
            </ul>
          )}
          <div className={styles.proofCols}>
            {block.items.map((item) => (
              <div key={item.label}>
                <Eyebrow>{item.label}</Eyebrow>
                <p>{item.names}</p>
              </div>
            ))}
          </div>
          {block.links && (
            <nav className={styles.proofLinks} aria-label="Frentes de atuação">
              <ul>
                {block.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}>
                      {link.label} <ArrowRight />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
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
    <div className={`${home.home} ${styles.page}`} data-page={page.slug}>
      <HomeHeader />
      <main>
        {page.blocks.map((block, index) => <BlockView key={`${block.type}-${index}`} block={block} />)}
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
