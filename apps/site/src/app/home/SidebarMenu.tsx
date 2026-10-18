"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import styles from "./SidebarMenu.module.css";
import BrandLogo from "../components/BrandLogo";
import { config, nav, navCta } from "./content";
import { ArrowRight, Close, Facebook, Instagram, Linkedin, WhatsApp, Youtube } from "./icons";

interface SidebarMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SidebarMenu({
  isOpen,
  onClose,
}: SidebarMenuProps) {
  const [mounted, setMounted] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Bloqueio de scroll do body e listener para ESC
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const timer = setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 100);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timer);
    };
  }, [isOpen, onClose]);

  if (!mounted) return null;

  const content = (
    <>
      <div
        className={styles.overlay}
        data-open={isOpen}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        id="sidebar-navigation"
        className={styles.sheet}
        data-open={isOpen}
        role="dialog"
        aria-modal="true"
        aria-label="Menu principal"
      >
        <div className={styles.sheetInner}>
          <div className={styles.topBar}>
            <Link
              href="/"
              className={styles.brandLink}
              onClick={onClose}
              aria-label="Kalidash — início"
            >
              <BrandLogo tone="dark" />
            </Link>

            <button
              ref={closeButtonRef}
              type="button"
              className={styles.closeButton}
              onClick={onClose}
              aria-label="Fechar menu"
            >
              <Close />
            </button>
          </div>

          <nav className={styles.navSection} aria-label="Navegação">
            <ul className={styles.navList}>
              {nav.map((item, index) => {
                const isAnchor = !item.href.startsWith("/");
                const formattedIndex = String(index + 1).padStart(2, "0");

                return (
                  <li
                    key={item.href}
                    className={styles.navItem}
                    style={{ "--delay": index } as React.CSSProperties}
                  >
                    {isAnchor ? (
                      <a
                        href={item.href}
                        className={styles.navLink}
                        onClick={onClose}
                      >
                        <div className={styles.navLeft}>
                          <span className={styles.navIndex}>{formattedIndex}</span>
                          <span className={styles.navLabel}>{item.label}</span>
                        </div>
                        <div className={styles.navRight}>
                          <span className={styles.arrowIcon}>
                            <ArrowRight />
                          </span>
                        </div>
                      </a>
                    ) : (
                      <Link
                        href={item.href}
                        className={styles.navLink}
                        onClick={onClose}
                      >
                        <div className={styles.navLeft}>
                          <span className={styles.navIndex}>{formattedIndex}</span>
                          <span className={styles.navLabel}>{item.label}</span>
                        </div>
                        <div className={styles.navRight}>
                          <span className={styles.arrowIcon}>
                            <ArrowRight />
                          </span>
                        </div>
                      </Link>
                    )}
                    {item.children && (
                      <ul className={styles.subList}>
                        {item.children.map((child) => (
                          <li key={child.href}>
                            <Link href={child.href} className={styles.subLink} onClick={onClose}>
                              {child.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className={styles.actions}>
            <Link
              href={navCta.href}
              className={styles.ctaButton}
              onClick={onClose}
            >
              <span>{navCta.label}</span>
              <ArrowRight />
            </Link>

            {config.whatsappUrl && (
              <a
                href={config.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.whatsappLink}
              >
                <WhatsApp />
                <span>Conversar no WhatsApp</span>
              </a>
            )}
          </div>

          <div className={styles.footer}>
            <div className={styles.socialGroup}>
              {config.social.instagram && (
                <a
                  href={config.social.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.socialLink}
                  aria-label="Instagram"
                >
                  <Instagram />
                </a>
              )}
              {config.social.linkedin && (
                <a
                  href={config.social.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.socialLink}
                  aria-label="LinkedIn"
                >
                  <Linkedin />
                </a>
              )}
              {config.social.facebook && (
                <a
                  href={config.social.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.socialLink}
                  aria-label="Facebook"
                >
                  <Facebook />
                </a>
              )}
              {config.social.youtube && (
                <a
                  href={config.social.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.socialLink}
                  aria-label="YouTube"
                >
                  <Youtube />
                </a>
              )}
            </div>

            <span className={styles.footerNote}>Kalidash</span>
          </div>
        </div>
      </aside>
    </>
  );

  return typeof document !== "undefined"
    ? createPortal(content, document.body)
    : null;
}
