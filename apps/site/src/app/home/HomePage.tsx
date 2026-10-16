"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Inter, Source_Sans_3 } from "next/font/google";
import styles from "./home.module.css";
import HomeHeader from "./HomeHeader";
import DiagnosticoForm from "./DiagnosticoForm";
import ExperienceSyncGallery from "./ExperienceSyncGallery";
import {
  ArrowDownLeft,
  ArrowRight,
  ChartIcon,
  DatabaseOffIcon,
  Facebook,
  Instagram,
  Linkedin,
  MessageIcon,
  ShareIcon,
  WhatsApp,
  Youtube,
  iconByName,
} from "./icons";
import FlickeringGrid from "../components/FlickeringGrid";
import {
  clients,
  config,
  diagnostico,
  experience,
  footer,
  fronts,
  hero,
  people,
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
  return (
    <a href={href} className={styles.textLink} data-role="text-link" onClick={onClick}>
      {children} <ArrowRight />
    </a>
  );
}

export default function HomePage() {
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
              href="/diagnostico"
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
          <Image
            className={styles.man}
            src="/home/homem.png"
            alt="Consultor da Kalidash sentado em um banco, sorrindo"
            width={864}
            height={1235}
            sizes="(min-width: 1100px) 686px, 60vw"
            priority
          />
          <div className={styles.problemGrid}>
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

            {/* Card 01: Trabalho manual */}
            <article className={styles.problemCard} data-role="problem-card">
              <FlickeringGrid
                squareSize={3.5}
                gridGap={5.5}
                color="rgb(182, 100, 77)"
                maxOpacity={0.28}
                flickerChance={0.2}
              />
              <div className={styles.cardVignette} aria-hidden="true" />
              <div className={styles.problemCardHeader}>
                <span className={styles.problemCardNumber}>01</span>
                <div className={styles.problemCardIconWrap}>
                  <ChartIcon className={styles.cardIcon} />
                </div>
              </div>
              <div className={styles.problemCardContent}>
                <h3>{problem.cards[0].title}</h3>
                <p>{problem.cards[0].text}</p>
              </div>
            </article>

            {/* Card 02: Depoimento fotográfico vazando da grade */}
            <article className={styles.quoteCard} data-role="problem-quote">
              <Image src="/home/depoimento-fundo.jpg" alt="" fill sizes="360px" />
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

            {/* Card 03: IA superficial */}
            <article className={styles.problemCard} data-role="problem-card">
              <FlickeringGrid
                squareSize={3.5}
                gridGap={5.5}
                color="rgb(168, 138, 88)"
                maxOpacity={0.28}
                flickerChance={0.2}
              />
              <div className={styles.cardVignette} aria-hidden="true" />
              <div className={styles.problemCardHeader}>
                <span className={styles.problemCardNumber}>02</span>
                <div className={styles.problemCardIconWrap}>
                  <DatabaseOffIcon className={styles.cardIcon} />
                </div>
              </div>
              <div className={styles.problemCardContent}>
                <h3>{problem.cards[1].title}</h3>
                <p>{problem.cards[1].text}</p>
              </div>
            </article>

            {/* Card 04: Operação desconectada */}
            <article className={styles.problemCard} data-role="problem-card">
              <FlickeringGrid
                squareSize={3.5}
                gridGap={5.5}
                color="rgb(182, 100, 77)"
                maxOpacity={0.28}
                flickerChance={0.2}
              />
              <div className={styles.cardVignette} aria-hidden="true" />
              <div className={styles.problemCardHeader}>
                <span className={styles.problemCardNumber}>03</span>
                <div className={styles.problemCardIconWrap}>
                  <ShareIcon className={styles.cardIcon} />
                </div>
              </div>
              <div className={styles.problemCardContent}>
                <h3>{problem.cards[2].title}</h3>
                <p>{problem.cards[2].text}</p>
              </div>
            </article>
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
                  <strong>{item.closing}</strong>
                  <TextLink
                    href={item.link.href === "#diagnostico" ? "/diagnostico" : item.link.href}
                  >
                    {item.link.label}
                  </TextLink>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="experiencia" className={styles.experience} data-block="home-experience">
          <div className={styles.expWrapper}>
            {/* Camada 1: Cabeçalho com Título & Narrativa em Duas Colunas */}
            <div className={styles.expHeader}>
              <div className={styles.expHeaderTop}>
                <span className={styles.expEyebrow}>{experience.eyebrow}</span>
                <h2 className={styles.expTitle}>{experience.title}</h2>
              </div>
              <div className={styles.expNarrativeGrid}>
                {experience.paragraphs.map((paragraph) => (
                  <p key={paragraph} className={styles.expNarrativePara}>
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>

            {/* Linha Divisória de Precisão */}
            <div className={styles.expRule} aria-hidden="true" />

            {/* Axioma Manifesto: Linear & Stripe Editorial Quote */}
            <div className={styles.expAxiomRow}>
              <blockquote className={styles.expAxiomBlock}>
                <p className={styles.expAxiomLine}>“{experience.proof[0]}”</p>
                <p className={styles.expAxiomLineAccent}>“{experience.proof[1]}”</p>
              </blockquote>
              <div className={styles.expClosingBox}>
                <p className={styles.expClosingLead}>{experience.closing[0]}</p>
                <p className={styles.expClosingSub}>{experience.closing[1]}</p>
              </div>
            </div>

            {/* Camada 2: Galeria Sincronizada Full-Bleed (Estilo Lastlink Club) */}
            <ExperienceSyncGallery />

            {/* Linha Divisória de Precisão */}
            <div className={styles.expRule} aria-hidden="true" />

            {/* Camada 3: Régua de Autoridade Institucional (Stripe Enterprise) */}
            <div className={styles.expAuthorityBar}>
              <div className={styles.expAuthorityGrid}>
                {experience.authorities.map((authority) => (
                  <div key={authority.label} className={styles.expAuthorityCol}>
                    <span className={styles.expAuthLabel}>{authority.label}</span>
                    <div className={styles.expAuthList}>
                      {authority.items.map((item) => (
                        <span key={item} className={styles.expAuthItem}>
                          {item}
                        </span>
                      ))}
                    </div>
                    <span className={styles.expAuthNote}>{authority.note}</span>
                  </div>
                ))}
              </div>
              <div className={styles.expActionWrap}>
                <a href={experience.link.href} className={styles.expLink}>
                  <span>{experience.link.label}</span>
                  <ArrowRight />
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.voices} data-block="home-testimonial">
          <Eyebrow>{testimonial.eyebrow}</Eyebrow>
          <h2>{testimonial.title}</h2>
          <blockquote>
            <p>“{testimonial.quote}”</p>
            <footer>
              <span className={styles.avatarClip}><Image src="/home/avatar-andre.jpg" alt="" width={292} height={195} /></span>
              <div><strong>{testimonial.author}</strong><span>{testimonial.role}</span></div>
            </footer>
          </blockquote>
        </section>

        <section id="cases" className={styles.people} data-block="home-cases">
          <div className={styles.peopleIntro}>
            <Eyebrow>{people.eyebrow}</Eyebrow>
            <h2>{people.title[0]}<br />{people.title[1]}</h2>
            <p>{people.text}</p>
          </div>
          <div className={styles.peopleGrid}>
            {people.items.map((item, index) => (
              <figure key={item.src} className={styles.peopleItem} data-size={index === 0 || index === 3 ? "large" : "regular"}>
                <Image src={item.src} alt={item.alt} fill sizes="(min-width: 1100px) 50vw, 100vw" />
                <figcaption>{item.title}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section id="diagnostico" className={styles.diagnostico} data-block="home-diagnostico">
          <div className={styles.diagnosticoText}>
            <Eyebrow>{diagnostico.fields.submit ? "Diagnóstico" : "Contato"}</Eyebrow>
            <h2>{diagnostico.title}</h2>
            <p>{diagnostico.text}</p>
            <strong>{diagnostico.microcopy}</strong>
          </div>
          <div className={styles.diagnosticoForm}>
            <DiagnosticoForm />
          </div>
        </section>
      </main>

      <footer className={styles.footer} data-block="home-footer">
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <Image src="/brand/logo-white.svg" alt="Kalidash" width={173} height={27} unoptimized />
            <p>{footer.text}</p>
          </div>
          {footer.columns.map((column) => (
            <nav key={column.title} className={styles.footerCol} aria-label={column.title}>
              <h3>{column.title}</h3>
              <ul>
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith("/") && !("external" in link && link.external) ? (
                      <Link href={link.href}>{link.label}</Link>
                    ) : (
                      <a href={link.href} {...("external" in link && link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{link.label}</a>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className={styles.footerBottom}>
          <span>{footer.copyright}</span>
          <div className={styles.social}>
            {config.social.instagram && <a href={config.social.instagram} aria-label="Instagram" target="_blank" rel="noopener noreferrer"><Instagram /></a>}
            {config.social.linkedin && <a href={config.social.linkedin} aria-label="LinkedIn" target="_blank" rel="noopener noreferrer"><Linkedin /></a>}
            {config.social.facebook && <a href={config.social.facebook} aria-label="Facebook" target="_blank" rel="noopener noreferrer"><Facebook /></a>}
            {config.social.youtube && <a href={config.social.youtube} aria-label="YouTube" target="_blank" rel="noopener noreferrer"><Youtube /></a>}
          </div>
        </div>
      </footer>

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
