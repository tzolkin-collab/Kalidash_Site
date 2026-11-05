"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./home.module.css";
import { fraunces } from "./home-font";
import heroStyles from "./HomeHero.module.css";
import HomeHeader from "./HomeHeader";
import LogoIntro from "../components/LogoIntro";
import SiteFooter from "./SiteFooter";
import ExperienceSyncGallery from "./ExperienceSyncGallery";
import ProblemHologram from "./ProblemHologram";
import { Reveal } from "../institucional/Motion";
import {
  ArrowDownLeft,
  ArrowRight,
  ChartIcon,
  DatabaseOffIcon,
  ShareIcon,
  WhatsApp,
} from "./icons";
import FlickeringGrid from "../components/FlickeringGrid";
import AnthropicPartnerBadge, { ClaudeLogoIcon } from "./AnthropicPartnerBadge";
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

const symptomIcons = [ChartIcon, DatabaseOffIcon, ShareIcon];
const symptomQuotes = [problem.quote, ...problem.pairedQuotes];

const TYPEKIT_KIT = "https://use.typekit.net/krs4uwp.css";

export default function HomePage() {
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = TYPEKIT_KIT;
    document.head.appendChild(link);
    const faces = ['400 1em "kepler-std-display"', 'italic 400 1em "kepler-std-display"', '400 1em "kepler-std-subhead"', 'italic 400 1em "kepler-std-subhead"', '400 1em "acumin-pro"', '700 1em "acumin-pro"'];
    let done = false;
    const finish = () => { if (!done) { done = true; main.setAttribute("data-fonts", "ready"); } };
    link.addEventListener("load", () => {
      Promise.all(faces.map((f) => document.fonts.load(f))).then(finish, finish);
    });
    const timeout = window.setTimeout(finish, 5000);
    return () => window.clearTimeout(timeout);
  }, []);
  const [isBadgeHovered, setIsBadgeHovered] = useState(false);
  const logoLoop = [...clients, ...clients];

  return (
    <div className={`${styles.home} ${fraunces.variable}`}>
      {/* Kit Adobe (Kepler e Acumin) só na Home e só dentro do <main>. O CSS do kit NÃO bloqueia a primeira pintura (medido: +1,2 s de FCP
          e texto invisível até a fonte chegar): o <link rel="preload"> começa o download cedo; o useEffect abaixo aplica o CSS e só
          marca data-fonts="ready" depois que as fontes carregaram. Até lá vale a fonte de reserva, com métrica ajustada (home.module.css). */}
      <link rel="preconnect" href="https://use.typekit.net" crossOrigin="anonymous" />
      <link rel="preload" as="style" href={TYPEKIT_KIT} />
      <LogoIntro />
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

      <main className={styles.v3} ref={mainRef}>
        <section className={styles.hero} data-block="home-hero">
          <div className={heroStyles.main}>
          <div className={heroStyles.text}>
          <Eyebrow>{hero.eyebrow}</Eyebrow>
          <h1>{hero.title}</h1>
          <div className={styles.heroCopy}>
            {hero.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>
          <div
            className={styles.heroActions}
            data-badge-hovered={isBadgeHovered}
            onMouseEnter={() => setIsBadgeHovered(true)}
            onMouseLeave={() => setIsBadgeHovered(false)}
          >
            <Link
              className={styles.primaryButton}
              href={hero.primaryCta.href}
              onFocus={() => setIsBadgeHovered(true)}
              onBlur={() => setIsBadgeHovered(false)}
            >
              <span>{hero.primaryCta.label}</span>
              <span className={styles.buttonIconWrap} aria-hidden="true">
                <ClaudeLogoIcon className={styles.buttonClaudeIcon} />
                <ArrowRight className={styles.buttonArrowIcon} />
              </span>
            </Link>
            <AnthropicPartnerBadge
              isHovered={isBadgeHovered}
              onHoverChange={setIsBadgeHovered}
            />
          </div>
          </div>
          <div className={heroStyles.bust} aria-hidden="true">
            <Image src="/kalidash-hero-sculpture.png" alt="" width={1122} height={1402} priority sizes="(max-width: 1023px) 70vw, 36vw" />
          </div>
          </div>

          <div className={styles.heroProof} aria-label="Experiência da Kalidash" data-enter="proof">
            <div className={styles.heroStripTop} aria-hidden="true" />
            <div className={styles.logoMarquee} aria-label="Clientes atendidos">
              <ul className={styles.logoTrack}>
                {logoLoop.map((client, index) => (
                  <li key={`${client.name}-${index}`} aria-hidden={index >= clients.length}>
                    <Image src={client.src} alt={index < clients.length ? client.name : ""} width={216} height={84} sizes="160px" />
                  </li>
                ))}
              </ul>
            </div>
            <div className={styles.heroStripBottom} aria-hidden="true" />
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
          <div className={styles.problemGrid}>
            <div className={styles.hologramCol}>
              <ProblemHologram tags={problem.hologramTags} />
            </div>

            <div className={styles.problemTop} data-role="problem-intro">
              <FlickeringGrid
                squareSize={4}
                gridGap={6}
                color="rgb(196, 166, 115)"
                maxOpacity={0.16}
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

            {/* Os três sintomas abertos, sem clique, cada um com o seu depoimento. */}
            <ol className={styles.symptoms} data-role="problem-symptoms">
              {problem.cards.map((card, index) => {
                const Icon = symptomIcons[index];
                const quote = symptomQuotes[index];
                return (
                  <li key={card.number} className={styles.symptom}>
                    <Icon className={styles.symptomIcon} aria-hidden="true" />
                    <div className={styles.symptomBody}>
                      <h3>{card.title}</h3>
                      <p>{card.text}</p>
                    </div>
                    <figure className={styles.symptomQuote}>
                      <blockquote>“{quote.text}”</blockquote>
                      <figcaption>
                        <strong>{quote.author},</strong> {quote.role}
                      </figcaption>
                    </figure>
                  </li>
                );
              })}
            </ol>
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
              <article key={item.name} className={styles.frontRow} data-reverse={index % 2 === 1}>
                <div className={styles.frontImage}>
                  <Image src={item.image.src} alt={item.image.alt} fill sizes="(min-width: 1100px) 50vw, 100vw" />
                </div>
                <div className={styles.frontText}>
                  <p className={styles.frontLabel}>{item.name}</p>
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
          <div className={styles.caseContent}>
            <div>
              <Eyebrow>{caseCba.eyebrow}</Eyebrow>
              <h2>{caseCba.title}</h2>
            </div>
            <div className={styles.caseBody}>
              <p>{caseCba.text}</p>
              <p className={styles.caseKey}>{caseCba.keyPhrase}</p>
              <div className={styles.caseActions}>
                <p className={styles.caseBadge}>{caseCba.badge}</p>
                {caseCba.pageReady && (
                  <TextLink href={caseCba.cta.href}>{caseCba.cta.label}</TextLink>
                )}
              </div>
            </div>
          </div>
          {caseCba.image && (
            <div className={styles.caseMedia}>
              <Image
                src={caseCba.image.src}
                alt={caseCba.image.alt}
                width={caseCba.image.width}
                height={caseCba.image.height}
                sizes="(max-width: 900px) 100vw, 45vw"
                loading="lazy"
              />
            </div>
          )}
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

        <section id="diagnostico" className={styles.diagnostico} data-block="home-diagnostico" data-tone="dark">
          <Image className={styles.diagTexture} src="/marca/nuvens-douradas.jpg" alt="" fill sizes="100vw" loading="lazy" aria-hidden="true" />
          <div className={styles.diagnosticoText}>
            <Eyebrow>Diagnóstico</Eyebrow>
            <h2>{diagnostico.title.before}<em className={styles.gold}>{diagnostico.title.accent}</em></h2>
          </div>
          <div className={styles.diagnosticoCtaBox}>
            <p>{diagnostico.text}</p>
            <strong>{diagnostico.microcopy}</strong>
            <div className={styles.diagnosticoActions}>
              <Link className={styles.diagPrimary} href="/diagnostico">
                {diagnostico.fields.submit} <ArrowRight />
              </Link>
              {config.whatsappUrl && (
                <a
                  className={styles.diagSecondary}
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
