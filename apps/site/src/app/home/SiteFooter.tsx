import Image from "next/image";
import Link from "next/link";
import styles from "./home.module.css";
import { Facebook, Instagram, Linkedin, Youtube } from "./icons";
import { config, footer } from "./content";

/* Anchors ("#x") só existem na Home; nas páginas internas viram "/#x". */
const resolve = (href: string) => (href.startsWith("#") ? `/${href}` : href);

export default function SiteFooter() {
  return (
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
              {column.links.map((link) => {
                const external = "external" in link && link.external;
                const href = resolve(link.href);
                return (
                  <li key={link.label}>
                    {href.startsWith("/") && !external ? (
                      <Link href={href}>{link.label}</Link>
                    ) : (
                      <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{link.label}</a>
                    )}
                  </li>
                );
              })}
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
  );
}
