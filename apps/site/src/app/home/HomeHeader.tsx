"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./home.module.css";
import BrandLogo from "../components/BrandLogo";
import SidebarMenu from "./SidebarMenu";
import { nav, navCta } from "./content";
import { ArrowRight, Close, Menu } from "./icons";

export default function HomeHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");
  const close = () => setOpen(false);

  // Efeito de rolagem para elevação/desfoque do header
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 15);
      if (window.scrollY < 120) {
        setActiveSection("");
      }
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
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

