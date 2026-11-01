import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import home from "../home/home.module.css";
import HomeHeader from "../home/HomeHeader";
import SiteFooter from "../home/SiteFooter";
import { ArrowRight, WhatsApp } from "../home/icons";
import { config } from "../home/content";
import { solucoes } from "../institucional/pages";
import SolucoesStory, { HeroParallax } from "./SolucoesStory";
import styles from "./solucoes.module.css";

export const metadata: Metadata = {
  title: solucoes.meta.title,
  description: solucoes.meta.description,
};

/* **trecho** vira negrito, igual ao SitePage. */
function Rich({ text }: { text: string }) {
  return <>{text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))}</>;
}

const IMAGES: Record<string, { src: string; alt: string; width: number; height: number }> = {
  kognis: { src: "/kognis-heroes.png", alt: "Kognis: advogados do escritório", width: 1000, height: 1000 },
  "spectra-ai": { src: "/sobre-nos/ato-01-operacao.jpg", alt: "Spectra AI: sala de operação com o time", width: 893, height: 1600 },
};

export default function Page() {
  const hero = solucoes.blocks.find((b) => b.type === "hero");
  const offers = solucoes.blocks.find((b) => b.type === "offers");
  if (!hero || hero.type !== "hero" || !offers || offers.type !== "offers") return null;
  const [kognis, spectra] = offers.items;
  const [lead1, lead2] = hero.lead;
  /* Fecho: a última frase do lead original ("... Quando isso acontece, a gente constrói."). */
  const closing = "Quando isso acontece, a gente constrói.";

  return (
    <div className={`${home.home} ${styles.page}`} data-page="solucoes">
      <HomeHeader />
      <main>
        {/* 1. Abertura: manchete em escala de cartaz, o busto da marca como único objeto */}
        <HeroParallax className={styles.hero}>
          <div className={styles.heroInner}>
            <p className={styles.meta}>{hero.eyebrow}</p>
            <h1>
              <span>Tecnologia que</span> <span>nasce de</span> <span>problemas reais.</span>
            </h1>
            <div className={styles.bust} aria-hidden="true">
              <Image src="/kalidash-hero-sculpture.png" alt="" width={1122} height={1402} priority sizes="(max-width: 900px) 70vw, 42vw" />
            </div>
            <div className={styles.heroLead}>
              <p>{lead1}</p>
              <p>{lead2}</p>
              <Link className={home.primaryButton} href={hero.cta.href}>
                {hero.cta.label} <ArrowRight />
              </Link>
            </div>
          </div>
          <div className={styles.meander} aria-hidden="true" />
        </HeroParallax>

        {/* 2. Os dois produtos: seção fixada, a cortina troca Kognis por Spectra AI conforme a rolagem */}
        <SolucoesStory className={styles.story}>
          <div className={styles.stage}>
            {[kognis, spectra].map((offer, index) => {
              const img = IMAGES[offer.id ?? ""];
              return (
                <article
                  key={offer.id}
                  id={offer.id}
                  className={`${styles.panel} ${index === 0 ? styles.light : styles.dark}`}
                  aria-labelledby={`${offer.id}-title`}
                >
                  <p className={styles.giant} aria-hidden="true">{offer.eyebrow}</p>
                  <div className={styles.object}>
                    <Image
                      src={img.src}
                      alt={img.alt}
                      width={img.width}
                      height={img.height}
                      sizes="(max-width: 900px) 90vw, 46vw"
                      className={index === 0 ? styles.cutout : styles.photo}
                    />
                  </div>
                  <div className={styles.copy}>
                    <p className={styles.marker}>
                      <span>{String(index + 1).padStart(2, "0")}</span> {offer.eyebrow}
                    </p>
                    <h2 id={`${offer.id}-title`}>{offer.title}</h2>
                    <p className={styles.text}><Rich text={offer.text} /></p>
                    <ul className={styles.features}>
                      {offer.features?.map((f) => (
                        <li key={f.title}>
                          <h3>{f.title}</h3>
                          <p>{f.text}</p>
                        </li>
                      ))}
                    </ul>
                    <Link href={offer.cta.href} className={styles.link}>
                      {offer.cta.label} <ArrowRight />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </SolucoesStory>

        {/* 3. Fecho: a frase-tese em cartaz sobre a faixa quente (única da página) */}
        <section className={styles.closing}>
          <div className={styles.closingInner}>
            <p>{closing}</p>
            <Link className={styles.closingCta} href={hero.cta.href}>
              {hero.cta.label} <ArrowRight />
            </Link>
          </div>
        </section>
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
