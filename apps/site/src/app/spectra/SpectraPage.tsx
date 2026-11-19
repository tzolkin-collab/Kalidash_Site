import Image from "next/image";
import Link from "next/link";
import home from "../home/home.module.css";
import HomeHeader from "../home/HomeHeader";
import SiteFooter from "../home/SiteFooter";
import { ArrowRight, WhatsApp } from "../home/icons";
import { config } from "../home/content";
import type { Block, PageContent } from "../institucional/pages";
import KitFonts from "../solucoes/KitFonts";
import sol from "../solucoes/solucoes.module.css";
import prod from "../solucoes/product.module.css";
import SpectraSteps from "./SpectraSteps";
import SpectraTurno from "./SpectraTurno";
import s from "./spectra.module.css";

/* Página do Spectra AI na linguagem da apresentação do produto ("A Cúpula", Google Slides da Carol): o busto de mármore
 * com circuitos na abertura, as imagens reais das câmeras e da plataforma no "Como funciona" e a estátua que lê, com a
 * frase do Taiichi Ohno, antes do fecho. Texto e imagens vêm de pages.ts. */

type Of<T extends Block["type"]> = Extract<Block, { type: T }>;
const find = <T extends Block["type"]>(page: PageContent, type: T) => page.blocks.find((b): b is Of<T> => b.type === type);

export default function SpectraPage({ page, closing }: { page: PageContent; closing: string }) {
  const hero = find(page, "heroMedia");
  const what = find(page, "cards");
  const how = find(page, "steps");
  if (!hero) return null;
  const [first, second] = hero.title;
  const [quote, author] = how?.closing ?? [];

  return (
    <div className={`${home.home} ${sol.page} ${sol.brandV3} ${prod.brandTitles} ${s.page}`} data-page={page.slug}>
      <link rel="preconnect" href="https://use.typekit.net" crossOrigin="anonymous" />
      <link rel="preload" as="style" href="https://use.typekit.net/krs4uwp.css" />
      <KitFonts />
      <HomeHeader />
      <main>
        {/* 1. Abertura: Imperial, a frase da capa em duas vozes e o busto que olha para ela */}
        <header className={s.hero} data-tone="dark">
          <div className={s.heroArt}>
            <Image src={hero.image.src} alt={hero.image.alt} fill priority fetchPriority="high" quality={90} sizes="(max-width: 1023px) 100vw, 62vw" />
          </div>
          <div className={`${s.wrap} ${s.heroCopy}`}>
            {/* Logo do produto no lugar do rótulo; a entrada animada está dentro do próprio SVG (some com movimento reduzido). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={s.heroLogo} src="/spectra/logo/spectra-logo-escuro-animada.svg" alt="Spectra AI" width={618} height={120} />
            <h1>
              <span className={s.heroSeen}>{first}</span>
              {second && <span className={s.heroHeard}>{second}</span>}
            </h1>
            <div className={s.heroLead}>
              {hero.lead.map((p) => (
                <p key={p}>{p}</p>
              ))}
              {hero.support && <p className={s.support}>{hero.support}</p>}
              {hero.cta && (
                <Link className={`${home.primaryButton} ${s.goldButton}`} href={hero.cta.href}>
                  {hero.cta.label} <ArrowRight />
                </Link>
              )}
            </div>
          </div>
          <div className={s.plinth} aria-hidden="true" />
        </header>

        {/* 2. O que faz: a promessa em uma frase e as três leituras em linhas */}
        {what && (
          <section className={s.what} aria-labelledby="spectra-what">
            <div className={`${s.wrap} ${s.whatGrid}`}>
              <header>
                {what.eyebrow && <p className={s.labelInk}>{what.eyebrow}</p>}
                <h2 id="spectra-what">{what.title.join(" ")}</h2>
              </header>
              <ol className={s.whatList}>
                {what.items.map((item, i) => (
                  <li key={item.title}>
                    <span className={s.whatNum}>{["I", "II", "III", "IV"][i]}</span>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}

        {/* 3. Como funciona: passos e o monitor com as imagens reais */}
        {how && <SpectraSteps block={how} />}

        {/* 3b. Um turno visto pelo Spectra: o gráfico traçado pela rolagem, os retratos nas pontas e uma ficha por vez */}
        <SpectraTurno />

        {/* 4. A frase do Ohno com a estátua que lê (slide de fecho da apresentação) */}
        {quote && (
          <section className={s.quote} aria-label="Citação">
            <div className={`${s.wrap} ${s.quoteGrid}`}>
              <figure className={s.quoteText}>
                <blockquote>
                  <p>{quote.replace(/^[“"]|[”"]$/g, "")}</p>
                </blockquote>
                {author && <figcaption>{author}</figcaption>}
              </figure>
              <div className={s.statue}>
                <Image src="/spectra/estatua-leitura.png" alt="" width={1200} height={1028} sizes="(max-width: 1023px) 86vw, 46vw" loading="lazy" />
              </div>
            </div>
          </section>
        )}

        {/* 5. Fecho: o mesmo das páginas irmãs (Imperial com as nuvens douradas) */}
        <section className={sol.closing}>
          <div className={sol.closingInner}>
            <p>{closing}</p>
            {hero.cta && (
              <Link className={sol.closingCta} href={hero.cta.href}>
                {hero.cta.label} <ArrowRight />
              </Link>
            )}
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
