"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./home.module.css";
import BrandLogo from "../components/BrandLogo";
import { nav } from "./content";
import { ArrowRight, ChevronDown, Close, Menu } from "./icons";

export default function HomeHeader() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className={styles.header} data-block="home-header" data-open={open}>
      <div className={styles.headerInner}>
        <Link href="/" className={styles.logo} aria-label="Kalidash — início" data-logo-hover onClick={close}>
          <BrandLogo animated />
        </Link>

        <button
          type="button"
          className={styles.burger}
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          aria-controls="home-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <Close /> : <Menu />}
        </button>

        <nav id="home-nav" className={styles.nav} aria-label="Principal">
          {nav.map((item) =>
            item.href.startsWith("/") ? (
              <Link key={item.label} href={item.href} onClick={close}>
                {item.label}
                {item.chevron && <ChevronDown />}
              </Link>
            ) : (
              <a key={item.label} href={item.href} onClick={close}>
                {item.label}
                {item.chevron && <ChevronDown />}
              </a>
            ),
          )}
          <a href="#diagnostico" className={styles.navCta} onClick={close}>
            Fazer Diagnóstico <ArrowRight />
          </a>
        </nav>
      </div>
    </header>
  );
}
