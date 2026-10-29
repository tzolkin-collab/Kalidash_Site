"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import styles from "./SidebarMenu.module.css";
import BrandLogo from "../components/BrandLogo";
import { config, nav, navCta } from "./content";
import { ArrowRight, ChevronDown, Close, Facebook, Instagram, Linkedin, WhatsApp, Youtube } from "./icons";

interface SidebarMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const subscribeNoop = () => () => {};

export default function SidebarMenu({
  isOpen,
  onClose,
}: SidebarMenuProps) {
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

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

  const toggleGroup = (label: string) => {
    setExpandedGroup((prev) => (prev === label ? null : label));
  };

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
          {/* Topo da Gaveta */}
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

          {/* Faixa decorativa superior da marca no lugar do border cinza */}
          <div className={styles.menuStripTop} aria-hidden="true" />

          {/* Seção de Navegação Principal */}
          <nav className={styles.navSection} aria-label="Navegação">
            <ul className={styles.navList}>
              {nav.map((item, index) => {
                const hasChildren = Boolean(item.children && item.children.length > 0);
                const isExpanded = expandedGroup === item.label;

                return (
                  <li
                    key={item.label}
                    className={styles.navItem}
                    style={{ "--delay": index } as React.CSSProperties}
                  >
                    {hasChildren ? (
                      <>
                        <button
                          type="button"
                          className={styles.groupToggle}
                          onClick={() => toggleGroup(item.label)}
                          aria-expanded={isExpanded}
                        >
                          <span className={styles.navLabel}>{item.label}</span>
                          <span
                            className={styles.chevronWrap}
                            data-expanded={isExpanded}
                            aria-hidden="true"
                          >
                            <ChevronDown />
                          </span>
                        </button>

                        <div
                          className={styles.subListWrap}
                          data-expanded={isExpanded}
                        >
                          <ul className={styles.subList}>
                            {item.children?.map((child) => (
                              <li key={child.href}>
                                <Link
                                  href={child.href}
                                  className={styles.subLink}
                                  onClick={onClose}
                                >
                                  <span className={styles.subTitle}>{child.label}</span>
                                  <span className={styles.subArrow} aria-hidden="true">
                                    <ArrowRight />
                                  </span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </>
                    ) : item.href.startsWith("/") ? (
                      <Link
                        href={item.href}
                        className={styles.navLink}
                        onClick={onClose}
                      >
                        <span className={styles.navLabel}>{item.label}</span>
                        <span className={styles.arrowIcon} aria-hidden="true">
                          <ArrowRight />
                        </span>
                      </Link>
                    ) : (
                      <a
                        href={item.href}
                        className={styles.navLink}
                        onClick={onClose}
                      >
                        <span className={styles.navLabel}>{item.label}</span>
                        <span className={styles.arrowIcon} aria-hidden="true">
                          <ArrowRight />
                        </span>
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Faixa decorativa inferior da marca no lugar do border cinza */}
          <div className={styles.menuStripBottom} aria-hidden="true" />

          {/* Ações e CTAs */}
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

          {/* Rodapé da Gaveta */}
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

            <span className={styles.footerNote}>© Kalidash · Eficiência Operacional</span>
          </div>
        </div>
      </aside>
    </>
  );

  return typeof document !== "undefined"
    ? createPortal(content, document.body)
    : null;
}
