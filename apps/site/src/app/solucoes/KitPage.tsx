import { Fragment } from "react";
import Image from "next/image";
import Link from "next/link";
import home from "../home/home.module.css";
import HomeHeader from "../home/HomeHeader";
import SiteFooter from "../home/SiteFooter";
import { ArrowRight, WhatsApp } from "../home/icons";
import { config } from "../home/content";
import type { Block, PageContent } from "../institucional/pages";
import CountUp from "./CountUp";
import { fraunces } from "./kit-font";
import BuildStory from "./BuildStory";
import StepsPin from "./StepsPin";
import ScrollMotion from "./ScrollMotion";
import { BlockView, HeroView, Legend, toneMap } from "./ProductPage";
import KitFonts from "./KitFonts";
import { Accent, FaqView, LeadershipView, ProblemView, RitualsView, canProblem } from "./AdvisoryViews";
import { ClosingBg, ClosingText, HeroArc, MotionRoot } from "./AdvisoryMotion";
import mo from "./advisory-motion.module.css";
import { ExecucaoClosing, ExecucaoLead, ExecucaoProof } from "./ExecucaoMotion";
import dynamic from "next/dynamic";
import { AcSteps } from "./AiCultureSteps";
/* Peças de movimento da AI Culture abaixo da dobra: carregam em chunk à parte (SSR continua, o HTML vem completo). */
const AcCapacity = dynamic(() => import("./AiCultureMotion").then((m) => m.AcCapacity));
const AcClosing = dynamic(() => import("./AiCultureMotion").then((m) => m.AcClosing));
const AcFormats = dynamic(() => import("./AiCultureMotion").then((m) => m.AcFormats));
import ac from "./ai-culture-motion.module.css";
import prod from "./product.module.css";
import sol from "./solucoes.module.css";
import styles from "./kit.module.css";

/* Página institucional de leitura (Advisory, AI Culture, Execução) na linguagem da /solucoes:
 * manchete em cartaz, foto como objeto, afirmação + frase-chave, listas em linhas, faixa escura
 * para a sequência e fecho. Texto e ordem vêm de pages.ts; dado `confirmed: false` não é publicado. */

type Of<T extends Block["type"]> = Extract<Block, { type: T }>;

function Rich({ text }: { text: string }) {
  return <>{text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))}</>;
}

/* Palavra de sentido em dourado itálico: a escolhida no bloco (`accent`); sem ela, a última da frase. Só um span, o texto não muda. */
function LastWord({ text, accent }: { text: string; accent?: string }) {
  if (accent && text.includes(accent)) return <Accent text={text} word={accent} className={styles.gold} />;
  const i = text.lastIndexOf(" ");
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i + 1)}<span className={styles.gold}>{text.slice(i + 1)}</span></>;
}

/* Abertura da Advisory: Imperial, texto à esquerda e a foto (pages.ts) num arco à direita. */
function HeroWide({ block, arc = false, panel = false }: { block: Of<"heroMedia">; arc?: boolean; panel?: boolean }) {
  const last = block.title.length - 1;
  return (
    <header className={styles.heroBrand} data-tone="dark" data-motion="hero">
      <div className={`${prod.wrap} ${styles.heroGrid}`}>
        <div className={styles.heroCopy}>
          <p className={styles.heroMeta}>{block.eyebrow}</p>
          <h1>
            {block.title.map((line, i) => (
              <span key={line} className={styles.line}>{i === last ? <LastWord text={line} accent={block.accent} /> : line}</span>
            ))}
          </h1>
          <div className={styles.heroLead}>
            {block.lead.map((p) => (
              <p key={p}><Rich text={p} /></p>
            ))}
            {block.cta && !panel && (
              <Link className={home.primaryButton} href={block.cta.href}>
                {block.cta.label} <ArrowRight />
              </Link>
            )}
          </div>
        </div>
        {panel ? (
          <div className={styles.heroPanel}>
            <div className={styles.heroArch}>
              <Image src={block.image.src} alt={block.image.alt} width={block.image.width} height={block.image.height} priority quality={90} sizes="(max-width: 1100px) 100vw, 60vw" className={mo.photo} />
            </div>
            {block.cta && (
              <Link className={`${home.primaryButton} ${styles.heroEdgeCta}`} href={block.cta.href}>
                {block.cta.label} <ArrowRight />
              </Link>
            )}
          </div>
        ) : (
        <div className={styles.heroArch}>
          <Image src={block.image.src} alt={block.image.alt} width={block.image.width} height={block.image.height} priority sizes="(max-width: 900px) 78vw, 460px" className={arc ? mo.photo : undefined} />
          {arc && <HeroArc />}
        </div>
        )}
      </div>
    </header>
  );
}

function TextView({ block, soft, figure }: { block: Of<"text">; soft: boolean; figure: boolean }) {
  return (
    <section className={`${prod.section}${soft ? ` ${prod.soft}` : ""}`}>
      <div className={prod.wrap}>
        {block.eyebrow && <Legend>{block.eyebrow}</Legend>}
        <div className={styles.assert}>
          <h2><Accent text={block.title.join(" ")} word={block.accent} className={styles.gold} /></h2>
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
        {block.highlight && (
          <div className={styles.manifesto}>
            <p><LastWord text={block.highlight.join(" ")} accent={block.highlightAccent} /></p>
            {figure && (
              <div className={styles.manifestoFig}>
                <Image src="/marca/socrates.jpg" alt="Busto de Sócrates sobre um pedestal" width={1122} height={1402} sizes="(max-width: 900px) 70vw, 340px" loading="lazy" />
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function ListView({ block, soft, motion = false }: { block: Of<"list">; soft: boolean; motion?: boolean }) {
  const Wrap = motion ? MotionRoot : Fragment;
  return (
    <Wrap>
    <section className={`${prod.section} ${prod.split}${soft ? ` ${prod.soft}` : ""}`}>
      <div className={`${prod.wrap} ${prod.splitGrid}`}>
        <header className={prod.sticky}>
          {block.eyebrow && <Legend>{block.eyebrow}</Legend>}
          <h2>{block.title.join(" ")}</h2>
        </header>
        <div>
          <ul className={`${styles.criteria}${motion ? ` ${mo.crit}` : ""}`}>
            {block.items.map((item, i) => (
              <li key={item} data-r={motion ? "" : undefined} style={motion ? ({ "--i": i } as React.CSSProperties) : undefined}>{item}</li>
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
    </Wrap>
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
  /* `aspect: "landscape"` pede a abertura larga (HeroWide) mesmo com foto em pé: o arco recorta. */
  const portrait = hero.aspect === "landscape" ? false : hero.image.height > hero.image.width;
  /* Ajustes V3: desenho novo (tipografia Kepler/Acumin, Imperial e Limestone) só onde já foi aprovado para ir ao ar; hoje, a Advisory. */
  const advisoryV3 = page.slug === "advisory";
  const isAc = page.slug === "treinamento-corporativo-ia";
  const v3 = advisoryV3 || page.slug === "execucao" || isAc;
  /* Na Advisory os "rituais" (cards) viram seção Imperial: saem da alternância de fundos claros. */
  const light = advisoryV3 ? LIGHT.filter((t) => t !== "cards") : LIGHT;
  const tones = toneMap(page.blocks, light);
  /* Movimento de rolagem em CSS (capítulos em cortina, rótulo "nº / total", surge) em todas as páginas do Kit. Sem JS; a cortina só
   * vale no desktop alto e sem movimento reduzido. O ajuste do cabeçalho no celular (kitDark) é só da Advisory, a única com hero Imperial. */
  const chaptered = true;
  const darkHero = page.slug === "advisory";
  /* A barra de provas (proofBar) é uma faixa fina colada à abertura, não um capítulo: fica fora da cortina e da contagem. */
  const chapterBlocks = page.blocks.filter((b) => b.type !== "heroMedia" && b.type !== "testimonials" && b.type !== "proofBar");
  const acProof = isAc ? page.blocks.find((b) => b.type === "proofBar") : undefined;
  return (
    <div className={`${home.home} ${sol.page} ${fraunces.variable}${darkHero ? ` ${styles.kitDark}` : ""}${v3 ? ` ${styles.v3}` : ""}${isAc ? ` ${ac.ac}` : ""} ${styles.chapters}`} data-page={page.slug}>
      {/* Kit Adobe (Kepler + Acumin), só nesta página e só dentro do <main>: o cabeçalho e o rodapé mantêm as fontes de hoje. O CSS do kit
          não bloqueia a primeira pintura: preload aqui, aplicação e troca de fonte em KitFonts (reserva com métrica ajustada até lá). */}
      {v3 && (
        <>
          <link rel="preconnect" href="https://use.typekit.net" crossOrigin="anonymous" />
          <link rel="preload" as="style" href="https://use.typekit.net/krs4uwp.css" />
          <KitFonts />
        </>
      )}
      <HomeHeader />
      <main className={styles.main}>
        {portrait ? <HeroView hero={hero} kind="photo" /> : <HeroWide block={hero} arc={v3} panel={advisoryV3} />}
        {page.blocks.map((block, index) => {
          if (block.type === "heroMedia") return null;
          if (isAc && block.type === "proofBar") return null;
          const key = `${block.type}-${index}`;
          const soft = tones[index];
          let node: React.ReactNode;
          switch (block.type) {
            case "text":
              /* AI Culture: números e logos fecham o capítulo "Por que capacitar?" (pedido do dono em 06/11). */
              if (isAc) node = <><AcCapacity key={key} block={block} />{acProof && <BlockView block={acProof} cardsIndex={1} poster={false} soft={false} />}</>;
              else if (advisoryV3 && block.highlight && canProblem(block)) node = <ProblemView key={key} block={block} soft={soft} />;
              else if (advisoryV3 && block.chips) node = <LeadershipView key={key} block={block} soft={soft} />;
              else if (page.slug === "execucao" && block.highlight) node = <ExecucaoLead key={key} block={block} soft={soft} />;
              else node = <TextView key={key} block={block} soft={soft} figure={page.slug === "advisory"} />;
              break;
            case "list": node = <ListView key={key} block={block} soft={soft} motion={v3} />; break;
            case "faq": node = v3 ? <FaqView key={key} block={block} soft={soft} /> : <BlockView key={key} block={block} cardsIndex={1} poster={false} soft={soft} />; break;
            case "formats": node = isAc ? <AcFormats key={key} block={block} /> : <FormatsView key={key} block={block} soft={soft} />; break;
            case "showcase": node = page.slug === "execucao" ? <ExecucaoProof key={key} block={block} soft={soft} /> : <ShowcaseView key={key} block={block} soft={soft} />; break;
            /* Depoimentos só vão ao ar com vídeo aprovado e hospedado (ver pages.ts): sem isso, nada. */
            case "testimonials": return null;
            case "cards":
              if (advisoryV3) { node = <RitualsView key={key} block={block} />; break; }
              /* Execução, "O que construímos": índice em acordeão preso na rolagem, com a tela ilustrativa de cada frente. */
              if (page.slug === "execucao" && block.items.some((it) => it.example)) {
                const t = Array.isArray(block.title) ? block.title.join(" ") : block.title;
                node = <BuildStory key={key} eyebrow={block.eyebrow} title={t ?? ""} items={block.items} />;
                break;
              }
              /* Com exemplo por item vira tabela de 4 colunas; sem exemplo, índice com título fixo. */
              node = <BlockView key={key} block={block} cardsIndex={block.items.some((it) => it.example) ? 0 : 1} poster={false} soft={soft} />;
              break;
            case "steps":
              /* Execução, "Como entregamos": faixa presa na rolagem, com a linha esticando e os passos acendendo em sequência. */
              node = isAc
                ? <StepsPin key={key}><AcSteps block={block} /></StepsPin>
                : page.slug === "execucao" || page.slug === "advisory"
                ? <StepsPin key={key}><BlockView block={block} cardsIndex={1} poster={false} soft={soft} /></StepsPin>
                : <BlockView key={key} block={block} cardsIndex={1} poster={false} soft={soft} />;
              break;
            default:
              node = <BlockView key={key} block={block} cardsIndex={1} poster={false} soft={soft} />;
          }
          if (!chaptered) return node;
          if (block.type === "proofBar") return <div key={key} className={styles.flatBar} data-tone="soft">{node}</div>;
          /* Capítulo: cortina que sobe sobre o anterior + cabeçalho fino (só o título, sem número, a pedido do dono em 06/11) que acompanha a leitura.
           * O rótulo vem de data-text (CSS), então não entra no texto da página. */
          const meta = block as { eyebrow?: string; title?: string | string[] };
          const label = (meta.eyebrow || (Array.isArray(meta.title) ? meta.title.join(" ") : meta.title) || "").toUpperCase();
          /* Tom do capítulo = cor real do bloco (o fundo do capítulo aparece nos cantos e no pé durante a cortina). */
          const tone = light.includes(block.type) ? (soft && !(isAc && block.type === "formats") ? "soft" : "paper") : "dark";
          return (
            <div key={key} className={styles.chapter} data-tone={tone} data-motion="curtain">
              <div className={styles.chapterLabel} aria-hidden="true" data-text={label}>
                <i />
              </div>
              {node}
            </div>
          );
        })}
        <section className={`${sol.closing}${chaptered ? ` ${styles.curtain}` : ""}`} data-tone={chaptered ? "dark" : undefined} data-motion={chaptered ? "curtain" : undefined}>
          {(page.slug === "advisory" || page.slug === "execucao" || isAc) && (
            <ClosingBg className={styles.closingBg}>
              <Image src="/marca/nuvens-douradas.jpg" alt="" fill sizes="100vw" loading="lazy" />
            </ClosingBg>
          )}
          <div className={sol.closingInner}>
            {isAc ? <AcClosing text={closing} /> : page.slug === "execucao" ? <ExecucaoClosing text={closing} /> : v3 ? <ClosingText text={closing} goldClass={styles.gold} /> : <p><LastWord text={closing} /></p>}
            {hero.cta && (
              <Link className={sol.closingCta} href={hero.cta.href}>
                {hero.cta.label} <ArrowRight />
              </Link>
            )}
          </div>
        </section>
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
