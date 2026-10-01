import Image from "next/image";
import Link from "next/link";
import { Inter } from "next/font/google";
import styles from "./home.module.css";
import HomeHeader from "./HomeHeader";
import DiagnosticoForm from "./DiagnosticoForm";
import { CarouselArrows, Rail } from "./Carousel";
import { ArrowDownLeft, ArrowRight, Facebook, Instagram, MessageIcon, TargetIcon, WhatsApp, Youtube, iconByName } from "./icons";
import { cases, clients, config, diagnostico, footer, hero, journey, method, problem, testimonial } from "./content";
import { SITE_URL } from "@/lib/siteUrl";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

/* Home (LP) — estrutura. O visual está em home.module.css; textos e imagens em content.ts.
 * Cada seção tem data-block="home-…" (contrato em docs/blog-design-contrato.md, seção Home). */

function Chip({ emoji, before, after }: { emoji: string; before: string; after: string }) {
  return (
    <p className={styles.chip} data-role="chip">
      {before} <span aria-hidden>{emoji}</span> {after}
    </p>
  );
}

function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className={styles.textLink} data-role="text-link">
      {children} <ArrowRight />
    </a>
  );
}

export default function HomePage() {
  const whatsappHref = config.whatsappUrl || "#diagnostico";

  return (
    <div className={`${inter.variable} ${styles.home}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Kalidash",
            url: SITE_URL,
            logo: `${SITE_URL}/brand/icon-512.png`,
            description: hero.chip.before + " " + hero.chip.after,
            sameAs: [config.social.instagram, config.social.facebook, config.social.youtube].filter(Boolean),
          }),
        }}
      />
      <HomeHeader />

      <main>
        {/* 1. Hero */}
        <section className={styles.hero} data-block="home-hero">
          <Chip emoji={hero.chip.emoji} before={hero.chip.before} after={hero.chip.after} />
          <h1>{hero.title}</h1>
          <p>{hero.text}</p>
        </section>

        {/* 2. Problema */}
        <section id="para-empresas" className={styles.problem} data-block="home-problem">
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
              <h2>{problem.title}</h2>
              <p>{problem.text}</p>
              <ArrowDownLeft className={styles.problemArrow} />
            </div>

            {[problem.cards[0]].map((c) => {
              const Icon = iconByName[c.icon as keyof typeof iconByName];
              return (
                <article key={c.title.join()} className={styles.problemCard} data-role="problem-card">
                  <Icon className={styles.cardIcon} />
                  <div>
                    <h3>{c.title[0]}<br />{c.title[1]}</h3>
                    <p>{c.text}</p>
                  </div>
                </article>
              );
            })}

            <article className={styles.quoteCard} data-role="problem-quote">
              <Image src="/home/depoimento-fundo.jpg" alt="" fill sizes="360px" />
              <MessageIcon className={styles.cardIcon} />
              <div>
                <p>“{problem.quote.text}”</p>
                <p className={styles.quoteAuthor}><strong>{problem.quote.author},</strong> {problem.quote.role}</p>
              </div>
            </article>

            {problem.cards.slice(1).map((c) => {
              const Icon = iconByName[c.icon as keyof typeof iconByName];
              return (
                <article key={c.title.join()} className={styles.problemCard} data-role="problem-card">
                  <Icon className={styles.cardIcon} />
                  <div>
                    <h3>{c.title[0]}<br />{c.title[1]}</h3>
                    <p>{c.text}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* 3. Depoimento + clientes */}
        <section className={styles.testimonial} data-block="home-testimonial">
          <Chip emoji={testimonial.chip.emoji} before={testimonial.chip.before} after={testimonial.chip.after} />
          <blockquote>
            <p>
              “{testimonial.before}<strong>{testimonial.strong}</strong>{testimonial.after}”
            </p>
            <footer>
              <span className={styles.avatarClip}><Image src="/home/avatar-andre.jpg" alt="" width={292} height={195} /></span>
              <div>
                <strong>{testimonial.author}</strong>
                <span>{testimonial.role}</span>
              </div>
            </footer>
          </blockquote>
          <ul className={styles.clients} data-block="home-clients" aria-label="Alguns dos nossos clientes">
            {clients.map((c) => (
              <li key={c.name}>
                <Image src={c.src} alt={c.name} width={216} height={84} sizes="216px" />
              </li>
            ))}
          </ul>
        </section>

        {/* 4. Do desafio à solução */}
        <section id="produtos" className={styles.journey} data-block="home-journey">
          <div className={styles.journeyBgLeft} aria-hidden />
          <div className={styles.journeyBgRight} aria-hidden />
          <span className={styles.watermarkLeft} aria-hidden>{journey.watermarkLeft}</span>
          <span className={styles.watermarkRight} aria-hidden>{journey.watermarkRight}</span>
          <div className={styles.journeyInner}>
            <div className={styles.journeyHead}>
              <div>
                <TargetIcon className={styles.eyebrowIcon} />
                <h2>{journey.title[0]}<br />{journey.title[1]}</h2>
                <p>{journey.text}</p>
              </div>
              {journey.slides.length > 1 && <CarouselArrows targetId="journey-rail" label="Frentes de atuação" />}
            </div>
            <Rail id="journey-rail" className={styles.journeyRail}>
              {journey.slides.map((s) => (
                <article key={s.title} className={styles.slide} data-role="slide">
                  <div className={styles.slideText}>
                    <small>{s.eyebrow}</small>
                    <h3>{s.title}</h3>
                    <p>{s.text}</p>
                    <p><strong>{s.strong}</strong></p>
                    <TextLink href={s.link.href}>{s.link.label}</TextLink>
                  </div>
                  <div className={styles.slideImage}>
                    <Image src={s.image.src} alt={s.image.alt} fill sizes="640px" />
                  </div>
                </article>
              ))}
            </Rail>
          </div>
        </section>

        {/* 5. Método validado */}
        <section id="sobre" className={styles.method} data-block="home-method">
          <div className={styles.methodImage}>
            <Image src={method.image.src} alt={method.image.alt} fill sizes="(min-width: 1100px) 50vw, 100vw" />
          </div>
          <div className={styles.methodText}>
            <div className={styles.avatars} aria-hidden>
              {method.avatars.map((a) => (
                <Image key={a} src={a} alt="" width={48} height={48} />
              ))}
              <span>…</span>
            </div>
            <h2>{method.title[0]}<br />{method.title[1]}</h2>
            <p>{method.text}</p>
            <TextLink href={method.link.href}>{method.link.label}</TextLink>
          </div>
        </section>

        {/* 6. Transformação que acontece de verdade */}
        <section id="cases" className={styles.cases} data-block="home-cases">
          <div className={styles.casesHead}>
            <div>
              <h2>{cases.title[0]}<br />{cases.title[1]}</h2>
              <p>{cases.text}</p>
              <TextLink href={cases.link.href}>{cases.link.label}</TextLink>
            </div>
            <CarouselArrows targetId="cases-rail" label="Cases" />
          </div>
          <Rail id="cases-rail" className={styles.casesRail}>
            {cases.items.map((c) => (
              <article key={c.src} className={styles.caseCard} data-role="case-card">
                <div className={styles.caseImage}>
                  <Image src={c.src} alt={c.alt} fill sizes="416px" />
                </div>
                <h3>{c.title}</h3>
                <p>{c.text}</p>
              </article>
            ))}
          </Rail>
        </section>

        {/* 7. Diagnóstico */}
        <section id="diagnostico" className={styles.diagnostico} data-block="home-diagnostico">
          <div className={styles.diagnosticoText}>
            <Chip emoji={diagnostico.chip.emoji} before={diagnostico.chip.before} after={diagnostico.chip.after} />
            <h2>
              {diagnostico.title[0]}<br />{diagnostico.title[1]} <em>{diagnostico.highlight}</em>
            </h2>
            <p>{diagnostico.text}</p>
            <p>{diagnostico.strongBefore}<strong>{diagnostico.strong}</strong></p>
          </div>
          <div className={styles.diagnosticoForm}>
            <DiagnosticoForm />
          </div>
        </section>
      </main>

      {/* 8. Rodapé */}
      <footer className={styles.footer} data-block="home-footer">
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <Image src="/brand/logo-white.svg" alt="Kalidash" width={173} height={27} unoptimized />
            <p>{footer.text}</p>
          </div>
          {footer.columns.map((col) => (
            <nav key={col.title} className={styles.footerCol} aria-label={col.title}>
              <h3>{col.title}</h3>
              <ul>
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.href.startsWith("/") && !("external" in l && l.external) ? (
                      <Link href={l.href}>{l.label}</Link>
                    ) : (
                      <a href={l.href} {...("external" in l && l.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{l.label}</a>
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
            {config.social.facebook && <a href={config.social.facebook} aria-label="Facebook" target="_blank" rel="noopener noreferrer"><Facebook /></a>}
            {config.social.youtube && <a href={config.social.youtube} aria-label="YouTube" target="_blank" rel="noopener noreferrer"><Youtube /></a>}
          </div>
        </div>
      </footer>

      <a
        href={whatsappHref}
        className={styles.whatsapp}
        aria-label="Falar pelo WhatsApp"
        {...(config.whatsappUrl ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        <WhatsApp />
      </a>
    </div>
  );
}
