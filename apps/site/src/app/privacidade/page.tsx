import type { Metadata } from "next";
import home from "../home/home.module.css";
import HomeHeader from "../home/HomeHeader";
import SiteFooter from "../home/SiteFooter";
import { SITE_URL } from "@/lib/siteUrl";
import { policy, type PolicyBlock } from "./content";
import styles from "./privacidade.module.css";

const title = "Política de Privacidade | Kalidash";
const description =
  "Como a Kalidash coleta, usa, armazena, compartilha e protege dados pessoais, em conformidade com a LGPD.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: `${SITE_URL}/privacidade` },
  openGraph: { type: "website", locale: "pt_BR", siteName: "Kalidash", url: `${SITE_URL}/privacidade`, title, description },
};

/* E-mails no texto viram links de mailto. */
function Text({ text }: { text: string }) {
  return (
    <>
      {text.split(/([\w.+-]+@[\w-]+\.[\w.]+[a-z])/gi).map((part, i) =>
        i % 2 ? (
          <a key={i} href={`mailto:${part}`}>
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}

function Block({ block }: { block: PolicyBlock }) {
  if ("p" in block) return <p><Text text={block.p} /></p>;
  if ("item" in block)
    return (
      <p>
        <strong>{block.item.label}:</strong> <Text text={block.item.text} />
      </p>
    );
  return (
    <ul>
      {block.list.map((li) => (
        <li key={li}><Text text={li} /></li>
      ))}
    </ul>
  );
}

export default function PrivacidadePage() {
  return (
    <div className={`${home.home} ${styles.page}`} data-page="privacidade">
      <HomeHeader />
      <main className={styles.main}>
        <header className={styles.head}>
          <p className={styles.eyebrow}>LGPD</p>
          <h1>Política de Privacidade</h1>
          <p className={styles.meta}>
            {policy.company} · Última atualização: {policy.lastUpdate}
          </p>
          <p className={styles.meta}>
            <a href={policy.pdf} target="_blank" rel="noopener noreferrer">Baixar em PDF</a>
          </p>
        </header>

        <div className={styles.layout}>
          <nav className={styles.toc} aria-label="Seções da política">
            <ol>
              {policy.sections.map((s) => (
                <li key={s.id}><a href={`#${s.id}`}>{s.title.replace(/^\d+\.\s*/, "")}</a></li>
              ))}
            </ol>
          </nav>
          <article className={styles.body}>
            {policy.sections.map((s) => (
              <section key={s.id} id={s.id}>
                <h2>{s.title}</h2>
                {s.blocks.map((b, i) => <Block key={i} block={b} />)}
              </section>
            ))}
          </article>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
