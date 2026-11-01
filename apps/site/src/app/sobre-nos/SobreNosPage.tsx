import Image from "next/image";
import Link from "next/link";
import home from "../home/home.module.css";
import HomeHeader from "../home/HomeHeader";
import SiteFooter from "../home/SiteFooter";
import { ArrowRight, WhatsApp } from "../home/icons";
import { config } from "../home/content";
import type { Block, PageContent } from "../institucional/pages";
import CountUp from "../solucoes/CountUp";
import prod from "../solucoes/product.module.css";
import sol from "../solucoes/solucoes.module.css";
import styles from "./sobre-nos.module.css";

/* /sobre-nos na linguagem da /solucoes: manchete em cartaz, fotos reais como objeto,
 * atos em linhas separadas por hairline, credo e números. Texto e ordem vêm de pages.ts. */

function Rich({ text }: { text: string }) {
  return <>{text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))}</>;
}

type Of<T extends Block["type"]> = Extract<Block, { type: T }>;

function Legend({ children }: { children: React.ReactNode }) {
  return <p className={prod.legend}><span>{children}</span></p>;
}

function Hero({ block }: { block: Of<"heroMedia"> }) {
  return (
    <header className={styles.hero}>
      <div className={prod.wrap}>
        <p className={styles.meta}>{block.eyebrow}</p>
        <div className={styles.heroTop}>
          <h1>
            {block.title.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </h1>
          <div className={styles.heroLead}>
            {block.lead.map((p) => (
              <p key={p}><Rich text={p} /></p>
            ))}
          </div>
        </div>
        <div className={styles.heroPhoto}>
          <Image
            src={block.image.src}
            alt={block.image.alt}
            width={block.image.width}
            height={block.image.height}
            priority
            sizes="(max-width: 900px) 100vw, 1280px"
          />
        </div>
      </div>
    </header>
  );
}

const MOSAIC_SLOTS = ["a", "b", "c", "d", "e", "f", "g"] as const;

function Timeline({ block }: { block: Of<"timeline"> }) {
  return (
    <section className={`${prod.section} ${styles.timeline}`} data-timeline>
      <div className={prod.wrap}>
        <Legend>{block.eyebrow}</Legend>
        {block.mosaic && (
          <figure className={styles.mosaicWrap}>
            <div className={styles.mosaic} role="group" aria-label={block.mosaic.caption || "Mosaico da nossa história"}>
              {block.mosaic.items.map((item, i) => (
                <div key={item.src} className={styles.tile} data-slot={MOSAIC_SLOTS[i]}>
                  <Image src={item.src} alt={item.alt} fill sizes="(max-width: 900px) 48vw, 420px" loading={i < 2 ? "eager" : "lazy"} />
                </div>
              ))}
            </div>
            {block.mosaic.caption && <figcaption>{block.mosaic.caption}</figcaption>}
          </figure>
        )}
        <ol className={styles.acts}>
          {block.items.map((item) => (
            <li key={item.title}>
              <p className={styles.actMeta}>{item.marker ? `${item.marker} · ${item.title}` : item.title}</p>
              <div className={styles.actBody}>
                <h2>{item.lead}</h2>
                {item.paragraphs.map((p) => (
                  <p key={p}><Rich text={p} /></p>
                ))}
                {item.quote && <blockquote>{item.quote}</blockquote>}
              </div>
              {item.highlight && <p className={styles.keyline}>{item.highlight}</p>}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Beliefs({ block }: { block: Of<"beliefs"> }) {
  return (
    <section className={`${prod.section} ${styles.beliefs}`}>
      <div className={prod.wrap}>
        <Legend>{block.eyebrow}</Legend>
        <div className={styles.beliefHead}>
          <h2>{block.title.join(" ")}</h2>
          <div>
            {block.intro.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </div>
        <ol className={styles.credo}>
          {block.items.map((item, i) => (
            <li key={item.belief}>
              <span className={prod.num}>{String(i + 1).padStart(2, "0")}</span>
              <h3>{item.belief}</h3>
              <p>{item.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Team({ block }: { block: Of<"team"> }) {
  return (
    <section className={`${prod.section} ${styles.team}`}>
      <div className={prod.wrap}>
        <Legend>{block.eyebrow}</Legend>
        <div className={styles.teamHead}>
          <h2>{block.title.join(" ")}</h2>
          <p>{block.text}</p>
        </div>
        <figure className={styles.teamFigure}>
          <Image src={block.image.src} alt={block.image.alt} width={block.image.width} height={block.image.height} sizes="(max-width: 900px) 100vw, 1280px" loading="lazy" />
          <figcaption>
            Fundada por{" "}
            {block.founders.map((f, i) => (
              <span key={f.name}>
                {i > 0 && " e "}
                <a href={f.linkedin} target="_blank" rel="noopener noreferrer">{f.name}</a> ({f.role})
              </span>
            ))}
            .
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

function Proof({ block }: { block: Of<"proof"> }) {
  return (
    <section className={styles.proof} aria-label="Números e atuação da Kalidash">
      <div className={prod.wrap}>
        {block.credentials && (
          <ul className={styles.credentials}>
            {block.credentials.map((c) => (
              <li key={c.strong}>
                <strong>{c.strong ? <CountUp value={c.strong} /> : null}</strong>
                <span>{c.text}</span>
              </li>
            ))}
          </ul>
        )}
        <dl className={styles.where}>
          {block.items.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.names}</dd>
            </div>
          ))}
        </dl>
        {block.links && (
          <ul className={styles.links}>
            {block.links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={home.textLink}>
                  {l.label} <ArrowRight />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "heroMedia": return <Hero block={block} />;
    case "timeline": return <Timeline block={block} />;
    case "beliefs": return <Beliefs block={block} />;
    case "team": return <Team block={block} />;
    case "proof": return <Proof block={block} />;
    default: return null;
  }
}

export default function SobreNosPage({ page }: { page: PageContent }) {
  return (
    <div className={`${home.home} ${sol.page}`} data-page={page.slug}>
      <HomeHeader />
      <main>
        {page.blocks.map((block, i) => (
          <BlockView key={`${block.type}-${i}`} block={block} />
        ))}
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
