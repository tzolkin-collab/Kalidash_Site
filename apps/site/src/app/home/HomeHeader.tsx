"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import styles from "./home.module.css";
import BrandLogo from "../components/BrandLogo";
import SidebarMenu from "./SidebarMenu";
import { nav, navCta } from "./content";
import { ArrowRight, Close, Menu } from "./icons";

export default function HomeHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");
  const [hidden, setHidden] = useState(false);
  const openRef = useRef(false);
  const lastYRef = useRef(0);
  const close = () => setOpen(false);

  useEffect(() => {
    openRef.current = open;
    if (open) setHidden(false);
  }, [open]);

  // Efeito de rolagem para elevação/desfoque do header com rAF throttling
  useEffect(() => {
    lastYRef.current = window.scrollY;
    const mountedAt = performance.now();
    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;

      requestAnimationFrame(() => {
        const y = window.scrollY;
        const nextScrolled = y > 15;
        setScrolled((prev) => (prev !== nextScrolled ? nextScrolled : prev));

        if (y < 120) {
          setActiveSection((prev) => (prev ? "" : prev));
        }

        // Esconde ao rolar para baixo, reaparece ao rolar um pouco para cima (apenas mobile/tablet)
        if (typeof window !== "undefined" && window.innerWidth <= 900) {
          const delta = y - lastYRef.current;
          // Salto grande (âncora) ou rolagem nos primeiros instantes (restauração do reload, que chega em etapas
          // conforme a página cresce): não esconde o header.
          const settling = performance.now() - mountedAt < 1500;
          if (openRef.current || y < 80 || settling || Math.abs(delta) > 600) {
            setHidden((prev) => (prev ? false : prev));
            lastYRef.current = y;
          } else if (delta > 12) {
            setHidden((prev) => (!prev ? true : prev));
            lastYRef.current = y;
          } else if (delta < -12) {
            setHidden((prev) => (prev ? false : prev));
            lastYRef.current = y;
          }
        } else {
          setHidden((prev) => (prev ? false : prev));
        }

        ticking = false;
      });
    };

    // Ao recarregar, o navegador restaura a rolagem sem (ou antes de) disparar "scroll":
    // sincroniza o estado na montagem, no load/pageshow e logo depois da restauração.
    const sync = () => {
      lastYRef.current = window.scrollY;
      handleScroll();
    };
    sync();
    const timer = window.setTimeout(sync, 150);

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("load", sync);
    window.addEventListener("pageshow", sync);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("load", sync);
      window.removeEventListener("pageshow", sync);
    };
  }, []);

  // Scrollspy: detecta qual seção está visível na tela
  useEffect(() => {
    const sectionIds = nav
      .map((item) => (item.href.startsWith("/#") ? item.href.slice(2) : null))
      .filter(Boolean) as string[];

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && window.scrollY >= 120) {
            setActiveSection(`#${entry.target.id}`);
          }
        });
      },
      {
        rootMargin: "-15% 0px -65% 0px",
        threshold: 0,
      },
    );

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <>
      <header
        className={styles.header}
        data-block="home-header"
        data-open={open}
        data-scrolled={scrolled}
        data-hidden={hidden}
      >
        <div className={styles.headerInner}>
          <Link
            href="/"
            className={styles.logo}
            aria-label="Kalidash — início"
            data-logo-hover
            data-collapsed={scrolled}
            onClick={close}
          >
            <BrandLogo animated collapsed={scrolled} />
          </Link>

          <nav id="home-nav" className={styles.nav} aria-label="Principal">
            {nav.map((item) => {
              const link = item.href.startsWith("/") ? (
                <Link href={item.href} data-active={activeSection === item.href.slice(1)} onClick={close}>
                  {item.label}
                </Link>
              ) : (
                <a
                  href={item.href}
                  data-active={activeSection === item.href}
                  onClick={close}
                >
                  {item.label}
                </a>
              );

              if (!item.children) return <span key={item.label}>{link}</span>;

              return (
                <div key={item.label} className={styles.navGroup} data-has-children>
                  {link}
                  <ul className={styles.navDropdown}>
                    {item.children.map((child) => (
                      <li key={child.href}>
                        <Link href={child.href} onClick={close}>
                          <strong>{child.label}</strong>
                          <small>{child.hint}</small>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            <Link
              href={navCta.href}
              className={styles.navCta}
              onClick={close}
            >
              {navCta.label} <ArrowRight />
            </Link>
          </nav>

          <button
            type="button"
            className={styles.burger}
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
            aria-controls="sidebar-navigation"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <Close /> : <Menu />}
          </button>
        </div>
      </header>

      <SidebarMenu
        isOpen={open}
        onClose={close}
      />
    </>
  );
}

