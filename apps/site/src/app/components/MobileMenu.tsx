"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import styles from "../motion.module.css";
import { List, X, ArrowUpRight } from "@phosphor-icons/react";

const LINKS = [
  { href: "#metodo", label: "Método" },
  { href: "#desafio", label: "O Desafio" },
  { href: "#frentes", label: "O Que Fazemos" },
  { href: "#autoridade", label: "Autoridade" },
  { href: "#depoimentos", label: "Cases" },
  { href: "/blog", label: "Blog", interno: true },
];

export default function MobileMenu() {
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (!aberto) return;

    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAberto(false);
    };

    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", aoTeclar);

    return () => {
      document.body.style.overflow = anterior;
      window.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  const handleLinkClick = () => {
    setAberto(false);
  };

  const menuModal = aberto ? (
    <div
      id="menu-mobile"
      className={styles.mobileMenu}
      aria-modal="true"
      role="dialog"
    >
      <div className={styles.mobileMenuTop}>
        <span className={styles.mobileBrandLabel}>KALIDASH</span>
        <button
          type="button"
          className={styles.mobileClose}
          onClick={() => setAberto(false)}
          aria-label="Fechar menu"
        >
          <span>Fechar</span>
          <X size={18} weight="bold" />
        </button>
      </div>

      <nav className={styles.mobileNavLinks} aria-label="Navegação mobile">
        {LINKS.map((link, idx) =>
          link.interno ? (
            <Link
              key={link.href}
              href={link.href}
              className={styles.mobileLink}
              style={{ "--stagger": idx } as React.CSSProperties}
              onClick={handleLinkClick}
            >
              <span>{link.label}</span>
              <ArrowUpRight size={18} weight="bold" />
            </Link>
          ) : (
            <a
              key={link.href}
              href={link.href}
              className={styles.mobileLink}
              style={{ "--stagger": idx } as React.CSSProperties}
              onClick={handleLinkClick}
            >
              <span>{link.label}</span>
              <ArrowUpRight size={18} weight="bold" />
            </a>
          )
        )}
      </nav>

      <div className={styles.mobileBottomAction}>
        <a
          className={styles.mobileCta}
          href="#diagnostico"
          onClick={handleLinkClick}
        >
          Conversar com a Kalidash <ArrowUpRight size={18} weight="bold" />
        </a>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        className={styles.burger}
        aria-expanded={aberto}
        aria-controls="menu-mobile"
        aria-label={aberto ? "Fechar menu" : "Abrir menu"}
        onClick={() => setAberto(true)}
      >
        <List size={18} weight="bold" />
      </button>

      {typeof document !== "undefined" && menuModal
        ? createPortal(menuModal, document.body)
        : null}
    </>
  );
}
