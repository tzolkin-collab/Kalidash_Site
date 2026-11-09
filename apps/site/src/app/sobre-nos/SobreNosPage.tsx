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
import KitFonts from "../solucoes/KitFonts";
import { AnthropicWordmark } from "../home/AnthropicPartnerBadge";
import kit from "../solucoes/kit.module.css";
import ScrollMotion from "../solucoes/ScrollMotion";
import styles from "./sobre-nos.module.css";

/* /sobre-nos no sistema da marca (o mesmo da Advisory, kit.module.css): abertura em Imperial com a palavra final em
 * dourado itálico, capítulos em cortina alternando Limestone / Imperial / branco com o rótulo fino "nº / total · título",
 * fotos reais como objeto. Texto e ordem vêm de pages.ts; nenhum texto novo (o rótulo vem de data-text via CSS). */

function Rich({ text }: { text: string }) {
  return <>{text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))}</>;
}

type Of<T extends Block["type"]> = Extract<Block, { type: T }>;

/* Última palavra em dourado itálico: só um span, o texto não muda. */
function LastWord({ text }: { text: string }) {
  const i = text.lastIndexOf(" ");
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i + 1)}<span className={kit.gold}>{text.slice(i + 1)}</span></>;
}

/* Frase-manifesto em duas partes (uma por frase): numa linha só no desktop largo, uma frase por linha abaixo disso. O texto e o espaço entre as frases não mudam. */
function Keyline({ text }: { text: string }) {
  const cut = text.indexOf(". ") + 1;
  if (cut <= 0) return <LastWord text={text} />;
  return (
    <>
      <span className={styles.keyPart}>{text.slice(0, cut)}</span>{" "}
      <span className={styles.keyPart}><LastWord text={text.slice(cut + 1)} /></span>
    </>
  );
}

function Legend({ children }: { children: React.ReactNode }) {
  return <p className={prod.legend}><span>{children}</span></p>;
}

/* Abertura no desenho da Advisory: Imperial, texto à esquerda e a foto dos fundadores num arco à direita. */
function Hero({ block }: { block: Of<"heroMedia"> }) {
  const last = block.title.length - 1;
  return (
    <header className={`${kit.heroBrand} ${styles.hero}`} data-tone="dark" data-motion="hero">
      <div className={`${prod.wrap} ${kit.heroGrid}`}>
        <div className={kit.heroCopy}>
          <p className={kit.heroMeta}>{block.eyebrow}</p>
          <h1>
            {block.title.map((line, i) => (
              <span key={line} className={kit.line}>{i === last ? <LastWord text={line} /> : line}</span>
            ))}
          </h1>
          <div className={kit.heroLead}>
            {block.lead.map((p) => (
              <p key={p}><Rich text={p} /></p>
            ))}
          </div>
        </div>
        <div className={`${kit.heroArch} ${styles.heroArch}`}>
          <Image
            src={block.image.src}
            alt={block.image.alt}
            width={block.image.width}
            height={block.image.height}
            priority
            sizes="(max-width: 900px) 78vw, 520px"
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
              {item.highlight && <p className={styles.keyline}><Keyline text={item.highlight} /></p>}
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
            {block.credentials.map((c) => {
              /* "Parceira" e "Vencedora" não são números: viram selo, com legenda pequena; a Anthropic aparece com a marca dela. */
              const seal = !/\d/.test(c.strong ?? "");
              if (seal) {
                return (
                  <li key={c.strong} className={styles.seal}>
                    <strong>{c.strong}</strong>
                    {c.text === "Anthropic" ? <AnthropicWordmark className={styles.sealMark} /> : null}
                    <span className={c.text === "Anthropic" ? styles.srOnly : undefined}>{c.text}</span>
                  </li>
                );
              }
              return (
                <li key={c.strong}>
                  <strong>{c.strong ? <CountUp value={c.strong} /> : null}</strong>
                  <span>{c.text}</span>
                </li>
              );
            })}
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

/* Tom de cada capítulo: a história em branco, o credo em Imperial, o time em branco e os números fecham em Imperial. */
const TONE: Partial<Record<Block["type"], "soft" | "dark" | "paper">> = { timeline: "paper", beliefs: "dark", team: "paper", proof: "dark" };

function label(block: Block) {
  const meta = block as { eyebrow?: string; title?: string | string[] };
  if (block.type === "proof") return "NÚMEROS E ATUAÇÃO"; // o mesmo rótulo do aria-label da seção
  return (meta.eyebrow || (Array.isArray(meta.title) ? meta.title.join(" ") : meta.title) || "").toUpperCase();
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
  const chapters = page.blocks.filter((b) => b.type !== "heroMedia");
  return (
    <div className={`${home.home} ${sol.page} ${sol.brandV3} ${kit.kitDark}`} data-page={page.slug}>
      <link rel="preconnect" href="https://use.typekit.net" crossOrigin="anonymous" />
      <link rel="preload" as="style" href="https://use.typekit.net/krs4uwp.css" />
      <KitFonts />
      <HomeHeader />
      <main className={`${kit.main} ${styles.sobre}`}>
        {page.blocks.map((block, i) => {
          const key = `${block.type}-${i}`;
          if (block.type === "heroMedia") return <BlockView key={key} block={block} />;
          return (
            <div key={key} className={kit.chapter} data-tone={TONE[block.type] ?? "paper"} data-motion="curtain">
              <div className={kit.chapterLabel} aria-hidden="true" data-text={label(block)}>
                <i />
              </div>
              <BlockView block={block} />
            </div>
          );
        })}
      </main>
      <ScrollMotion />
      <SiteFooter />
      {config.whatsappUrl && (
        <a href={config.whatsappUrl} className={home.whatsapp} aria-label="Falar pelo WhatsApp" target="_blank" rel="noopener noreferrer">
          <WhatsApp />
        </a>
      )}
    </div>
  );
}
