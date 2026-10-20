"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Inter, Source_Sans_3 } from "next/font/google";
import styles from "./home.module.css";
import HomeHeader from "./HomeHeader";
import SiteFooter from "./SiteFooter";
import ExperienceSyncGallery from "./ExperienceSyncGallery";
import ProblemHologram from "./ProblemHologram";
import { Reveal } from "../institucional/Motion";
import {
  ArrowDownLeft,
  ArrowRight,
  ChartIcon,
  DatabaseOffIcon,
  MessageIcon,
  ShareIcon,
  WhatsApp,
} from "./icons";
import FlickeringGrid from "../components/FlickeringGrid";
import {
  clients,
  config,
  diagnostico,
  experience,
  fronts,
  hero,
  caseCba,
  problem,
  testimonial,
} from "./content";
import { SITE_URL } from "@/lib/siteUrl";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
// Texto corrido: Source Sans 3, alternativa aberta (da Adobe) no mesmo estilo da Myriad e da Acumin do brand guide.
const sourceSans = Source_Sans_3({ subsets: ["latin"], variable: "--font-source-sans", display: "swap" });

function Eyebrow({ children, inverse = false }: { children: React.ReactNode; inverse?: boolean }) {
  return <p className={styles.eyebrow} data-inverse={inverse}>{children}</p>;
}

function TextLink({ href, children, onClick }: { href: string; children: React.ReactNode; onClick?: (e: React.MouseEvent) => void }) {
  if (href.startsWith("/")) {
    return (
      <Link href={href} className={styles.textLink} data-role="text-link" onClick={onClick}>
        {children} <ArrowRight />
      </Link>
    );
  }
  return (
    <a href={href} className={styles.textLink} data-role="text-link" onClick={onClick}>
      {children} <ArrowRight />
    </a>
  );
}

export default function HomePage() {
  const [activeQuoteIndex, setActiveQuoteIndex] = useState<number | null>(null);
  const logoLoop = [...clients, ...clients];

  return (
    <div className={`${inter.variable} ${sourceSans.variable} ${styles.home}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Kalidash",
            url: SITE_URL,
            logo: `${SITE_URL}/brand/icon-512.png`,
            description: hero.paragraphs.join(" "),
            sameAs: [config.social.instagram, config.social.linkedin, config.social.facebook, config.social.youtube].filter(Boolean),
          }),
        }}
      />
      <HomeHeader />

      <main>
        <section className={styles.hero} data-block="home-hero">
          <Eyebrow>{hero.eyebrow}</Eyebrow>
          <h1>{hero.title}</h1>
          <div className={styles.heroCopy}>
            {hero.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>
          <div className={styles.heroActions}>
            <Link
              className={styles.primaryButton}
              href={hero.primaryCta.href}
            >
              {hero.primaryCta.label} <ArrowRight />
            </Link>
            <a className={styles.secondaryButton} href={hero.secondaryCta.href}>
              {hero.secondaryCta.label} <ArrowRight />
            </a>
          </div>

          <div className={styles.heroProof} aria-label="Experiência da Kalidash">
            <div className={styles.logoMarquee} aria-label="Clientes atendidos">
              <ul className={styles.logoTrack}>
                {logoLoop.map((client, index) => (
                  <li key={`${client.name}-${index}`} aria-hidden={index >= clients.length}>
                    <Image src={client.src} alt={index < clients.length ? client.name : ""} width={216} height={84} sizes="160px" />
                  </li>
                ))}
              </ul>
            </div>
            <dl className={styles.stats}>
              {hero.stats.map((stat) => (
                <div key={stat.label}>
                  <dt>{stat.value}</dt>
                  <dd>{stat.label}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* 2. O Desafio / Problema — Layout Único com Bento Grid & SVGs Animados */}
        <section id="desafio" className={styles.problem} data-block="home-problem">
          <span className={styles.watermark} aria-hidden>{problem.watermark}</span>
          <div className={styles.problemGrid}>
            <div className={styles.hologramCol}>
              <ProblemHologram tags={problem.hologramTags} />
            </div>

            <div className={styles.problemTop} data-role="problem-intro">
              <FlickeringGrid
                squareSize={4}
                gridGap={6}
                color="rgb(240, 179, 159)"
                maxOpacity={0.24}
                flickerChance={0.2}
              />
              <div className={styles.topVignette} aria-hidden="true" />
              <div className={styles.problemTopContent}>
                <h2>
                  {problem.title}
                  <em>{problem.subtitle}</em>
                </h2>
                <p>{problem.text}</p>
                <ArrowDownLeft className={styles.problemArrow} />
              </div>
            </div>

            <div
              className={styles.problemCardsRow}
              onMouseLeave={() => setActiveQuoteIndex(null)}
            >
              {/* Card 01: Trabalho manual */}
              <article
                className={styles.problemCard}
                data-role="problem-card"
                data-active={activeQuoteIndex === 0}
                data-dimmed={activeQuoteIndex !== null && activeQuoteIndex !== 0}
                onMouseEnter={() => setActiveQuoteIndex(0)}
                onClick={() => setActiveQuoteIndex((prev) => (prev === 0 ? null : 0))}
              >
                <FlickeringGrid
                  squareSize={3.5}
                  gridGap={5.5}
                  color="rgb(182, 100, 77)"
                  maxOpacity={0.28}
                  flickerChance={0.2}
                />
                <div className={styles.cardVignette} aria-hidden="true" />
                <div className={styles.problemCardHeader}>
                  <div className={styles.problemCardIconWrap}>
                    <ChartIcon className={styles.cardIcon} />
                  </div>
                </div>
                <div className={styles.problemCardContent}>
                  <h3>{problem.cards[0].title}</h3>
                  <p>{problem.cards[0].text}</p>
                </div>
                <div className={styles.cardQuoteCue}>
                  <MessageIcon className={styles.cardQuoteCueIcon} />
                  <span>Depoimento real</span>
                </div>
              </article>

              {/* Card 01 Quote: Depoimento fotográfico (Aline Motta) */}
              <article
                className={styles.quoteCard}
                data-role="problem-quote"
                data-active={activeQuoteIndex === 0}
                onMouseEnter={() => setActiveQuoteIndex(0)}
              >
                <Image src="/home/depoimento-fundo.jpg" alt="" fill sizes="(min-width: 1100px) 380px, 100vw" />
                <div className={styles.problemCardHeader}>
                  <span className={styles.problemCardNumber} style={{ color: "rgba(255,255,255,0.7)" }}>DEPOIMENTO</span>
                  <div className={styles.problemCardIconWrap} style={{ background: "rgba(255,255,255,0.16)", color: "#fff" }}>
                    <MessageIcon className={styles.cardIcon} />
                  </div>
                </div>
                <div>
                  <p>“{problem.quote.text}”</p>
                  <p className={styles.quoteAuthor}>
                    <strong>{problem.quote.author},</strong> {problem.quote.role}
                  </p>
                </div>
              </article>

              {/* Card 02: IA superficial */}
              <article
                className={styles.problemCard}
                data-role="problem-card"
                data-active={activeQuoteIndex === 1}
                data-dimmed={activeQuoteIndex !== null && activeQuoteIndex !== 1}
                onMouseEnter={() => setActiveQuoteIndex(1)}
                onClick={() => setActiveQuoteIndex((prev) => (prev === 1 ? null : 1))}
              >
                <FlickeringGrid
                  squareSize={3.5}
                  gridGap={5.5}
                  color="rgb(168, 138, 88)"
                  maxOpacity={0.28}
                  flickerChance={0.2}
                />
                <div className={styles.cardVignette} aria-hidden="true" />
                <div className={styles.problemCardHeader}>
                  <div className={styles.problemCardIconWrap}>
                    <DatabaseOffIcon className={styles.cardIcon} />
                  </div>
                </div>
                <div className={styles.problemCardContent}>
                  <h3>{problem.cards[1].title}</h3>
                  <p>{problem.cards[1].text}</p>
                </div>
                <div className={styles.cardQuoteCue}>
                  <MessageIcon className={styles.cardQuoteCueIcon} />
                  <span>Depoimento real</span>
                </div>
              </article>

              {/* Card 02 Quote: Depoimento pareado (Camila Duarte) */}
              <article
                className={styles.quoteCard}
                data-role="problem-quote"
                data-active={activeQuoteIndex === 1}
                onMouseEnter={() => setActiveQuoteIndex(1)}
              >
                <Image src="/home/evento-mesa.jpg" alt="" fill sizes="(min-width: 1100px) 380px, 100vw" />
                <div className={styles.problemCardHeader}>
                  <span className={styles.problemCardNumber} style={{ color: "rgba(255,255,255,0.7)" }}>DEPOIMENTO</span>
                  <div className={styles.problemCardIconWrap} style={{ background: "rgba(255,255,255,0.16)", color: "#fff" }}>
                    <MessageIcon className={styles.cardIcon} />
                  </div>
                </div>
                <div>
                  <p>“{problem.pairedQuotes[0].text}”</p>
                  <p className={styles.quoteAuthor}>
                    <strong>{problem.pairedQuotes[0].author},</strong> {problem.pairedQuotes[0].role}
                  </p>
                </div>
              </article>

              {/* Card 03: Operação desconectada */}
              <article
                className={styles.problemCard}
                data-role="problem-card"
                data-active={activeQuoteIndex === 2}
                data-dimmed={activeQuoteIndex !== null && activeQuoteIndex !== 2}
                onMouseEnter={() => setActiveQuoteIndex(2)}
                onClick={() => setActiveQuoteIndex((prev) => (prev === 2 ? null : 2))}
              >
                <FlickeringGrid
                  squareSize={3.5}
                  gridGap={5.5}
                  color="rgb(182, 100, 77)"
                  maxOpacity={0.28}
                  flickerChance={0.2}
                />
                <div className={styles.cardVignette} aria-hidden="true" />
                <div className={styles.problemCardHeader}>
                  <div className={styles.problemCardIconWrap}>
                    <ShareIcon className={styles.cardIcon} />
                  </div>
                </div>
                <div className={styles.problemCardContent}>
                  <h3>{problem.cards[2].title}</h3>
                  <p>{problem.cards[2].text}</p>
                </div>
                <div className={styles.cardQuoteCue}>
                  <MessageIcon className={styles.cardQuoteCueIcon} />
                  <span>Depoimento real</span>
                </div>
              </article>

              {/* Card 03 Quote: Depoimento pareado (Eduardo Lima) */}
              <article
                className={styles.quoteCard}
                data-role="problem-quote"
                data-active={activeQuoteIndex === 2}
                onMouseEnter={() => setActiveQuoteIndex(2)}
              >
                <Image src="/home/evento-sala.jpg" alt="" fill sizes="(min-width: 1100px) 380px, 100vw" />
                <div className={styles.problemCardHeader}>
                  <span className={styles.problemCardNumber} style={{ color: "rgba(255,255,255,0.7)" }}>DEPOIMENTO</span>
                  <div className={styles.problemCardIconWrap} style={{ background: "rgba(255,255,255,0.16)", color: "#fff" }}>
                    <MessageIcon className={styles.cardIcon} />
                  </div>
                </div>
                <div>
                  <p>“{problem.pairedQuotes[1].text}”</p>
                  <p className={styles.quoteAuthor}>
                    <strong>{problem.pairedQuotes[1].author},</strong> {problem.pairedQuotes[1].role}
                  </p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section id="o-que-fazemos" className={styles.fronts} data-block="home-fronts">
          <div className={styles.frontsIntro}>
            <Eyebrow>{fronts.eyebrow}</Eyebrow>
            <h2>{fronts.title}</h2>
            <div>
              {fronts.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
          </div>
          <div className={styles.frontRows}>
            {fronts.items.map((item, index) => (
              <article key={item.number} className={styles.frontRow} data-reverse={index % 2 === 1}>
                <div className={styles.frontImage}>
                  <Image src={item.image.src} alt={item.image.alt} fill sizes="(min-width: 1100px) 50vw, 100vw" />
                </div>
                <div className={styles.frontText}>
                  <p className={styles.frontLabel}><span>{item.number}</span>{item.name}</p>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                  {item.audience && <p>{item.audience}</p>}
                  <strong>{item.closing}</strong>
                  <TextLink href={item.link.href}>
                    {item.link.label}
                  </TextLink>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="experiencia" className={styles.experience} data-block="home-experience">
          <div className={styles.expIntro}>
            <Eyebrow>{experience.eyebrow}</Eyebrow>
            <div className={styles.expIntroLeft}>
              <h2>{experience.title}</h2>
              <p className={styles.expProof}>
                <strong>{experience.proof[0]} {experience.proof[1]}</strong>
              </p>
            </div>
            <div className={styles.expIntroRight}>
              {experience.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              <p className={styles.expClosing}>
                {experience.closing[0]} {experience.closing[1]}
              </p>
            </div>
          </div>

          <ExperienceSyncGallery />

          <div className={styles.expFooter}>
            <div className={styles.expAuthorityGrid}>
              {experience.authorities.map((authority) => (
                <div key={authority.label} className={styles.expAuthorityCol}>
                  <Eyebrow>{authority.label}</Eyebrow>
                  <p className={styles.expAuthItems}>
                    {authority.items.join(" · ")}
                  </p>
                  <p className={styles.expAuthNote}>{authority.note}</p>
                </div>
              ))}
            </div>
            <TextLink href={experience.link.href}>
              {experience.link.label}
            </TextLink>
          </div>
        </section>

        <section className={styles.caseFeature} data-block="home-case">
          <div>
            <Eyebrow>{caseCba.eyebrow}</Eyebrow>
            <h2>{caseCba.title}</h2>
          </div>
          <div className={styles.caseBody}>
            <p>{caseCba.text}</p>
            <p className={styles.caseBadge}>{caseCba.badge}</p>
            {caseCba.pageReady && (
              <TextLink href={caseCba.cta.href}>{caseCba.cta.label}</TextLink>
            )}
          </div>
        </section>

        <section className={styles.results} data-block="home-testimonial">
          <header className={styles.resultsHead}>
            <Eyebrow>{testimonial.eyebrow}</Eyebrow>
            <h2>{testimonial.title}</h2>
          </header>
          <Reveal as="ul" className={styles.resultCards}>
            {testimonial.cards.map((card, index) => (
              <li key={card.author} className={styles.resultCard} style={{ "--i": index } as React.CSSProperties}>
                <div className={styles.resultPhoto}>
                  {card.photo ? (
                    <Image src={card.photo} alt={card.author} width={768} height={512} sizes="(min-width: 1100px) 33vw, 100vw" />
                  ) : (
                    <span aria-hidden="true">{card.author.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
                  )}
                </div>
                <div className={styles.resultBody}>
                  {card.metric && (
                    <p className={styles.resultMetric}>
                      <strong>{card.metric.value}</strong> {card.metric.label}
                    </p>
                  )}
                  <blockquote>“{card.quote}”</blockquote>
                  <p className={styles.resultAuthor}>
                    <strong>{card.author}</strong>, {card.role}
                  </p>
                </div>
              </li>
            ))}
          </Reveal>
        </section>

        <section id="diagnostico" className={styles.diagnostico} data-block="home-diagnostico">
          <div className={styles.diagnosticoText}>
            <Eyebrow>Diagnóstico</Eyebrow>
            <h2>{diagnostico.title}</h2>
          </div>
          <div className={styles.diagnosticoCtaBox}>
            <p>{diagnostico.text}</p>
            <strong>{diagnostico.microcopy}</strong>
            <div className={styles.diagnosticoActions}>
              <Link className={styles.primaryButton} href="/diagnostico">
                {diagnostico.fields.submit} <ArrowRight />
              </Link>
              {config.whatsappUrl && (
                <a
                  className={styles.secondaryButton}
                  href={config.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Conversar no WhatsApp <ArrowRight />
                </a>
              )}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />

      {config.whatsappUrl && (
        <a
          href={config.whatsappUrl}
          className={styles.whatsapp}
          aria-label="Falar pelo WhatsApp"
          target="_blank"
          rel="noopener noreferrer"
        >
          <WhatsApp />
        </a>
      )}
    </div>
  );
}
