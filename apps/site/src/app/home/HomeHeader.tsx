"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import styles from "./home.module.css";
import BrandLogo from "../components/BrandLogo";
import SidebarMenu from "./SidebarMenu";
import { nav, navCta } from "./content";
import { ArrowRight, Close, Menu } from "./icons";

const LOGO_INTRO_SESSION_KEY = "kalidash:logo-intro-played";
const HEADER_COLLAPSED_KEY = "kalidash:header-collapsed";
const HEADER_PATH_KEY = "kalidash:header-path";
let logoIntroPlayedInMemory = false;

type HomeHeaderProps = {
  filterSlot?: React.ReactNode;
  filtersActive?: boolean;
  bg?: "white" | "default";
};

export default function HomeHeader({
  filterSlot,
  filtersActive = false,
  bg = "default",
}: HomeHeaderProps = {}) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [logoReady, setLogoReady] = useState(false);
  const [playLogoIntro, setPlayLogoIntro] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");
  const [hidden, setHidden] = useState(false);
  const openRef = useRef(false);
  const lastYRef = useRef(0);
  const close = () => setOpen(false);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // Regra de controle da animação do logo no header:
  // 1. A animação de entrada (gold-in / chevron-in) só roda na primeira abertura da sessão
  //    e nunca se repete ao atualizar a página (reload / F5) nem ao navegar entre rotas.
  // 2. As transições de recolher/expandir as letras (logoReady) ficam desativadas durante
  //    o carregamento/restauração de scroll do reload e só ativam quando o usuário rola a página.
  useEffect(() => {
    let shouldPlayIntro = false;
    if (!logoIntroPlayedInMemory) {
      try {
        const navEntry = performance.getEntriesByType("navigation")[0] as
          | PerformanceNavigationTiming
          | undefined;
        const isReload = navEntry?.type === "reload";
        const alreadyPlayed = sessionStorage.getItem(LOGO_INTRO_SESSION_KEY) === "1";

        if (!isReload && !alreadyPlayed) {
          shouldPlayIntro = true;
        }
        sessionStorage.setItem(LOGO_INTRO_SESSION_KEY, "1");
      } catch {
        // Caso sessionStorage esteja bloqueado, mantém sem reanimar
      }
      logoIntroPlayedInMemory = true;
    }

    if (shouldPlayIntro) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlayLogoIntro(true);
    }
  }, []);

  // Efeito de rolagem para elevação/desfoque do header com rAF throttling
  useEffect(() => {
    lastYRef.current = window.scrollY;
    const mountedAt = performance.now();
    let ticking = false;

    const applyScrollState = (isUserScroll: boolean) => {
      const y = window.scrollY;
      const elapsed = performance.now() - mountedAt;
      const preCollapsed =
        document.documentElement.getAttribute("data-header-collapsed") === "true";

      // Durante a restauração do reload (primeiros 600ms), se o estado salvo já era recolhido
      // e o navegador ainda não terminou de restaurar scrollY, mantém recolhido sem piscar.
      const nextScrolled =
        !isUserScroll && elapsed < 600 && preCollapsed ? true : y > 15;

      if (isUserScroll && elapsed > 300) {
        setLogoReady((prev) => (prev ? prev : true));
      }

      document.documentElement.setAttribute(
        "data-header-collapsed",
        nextScrolled ? "true" : "false",
      );
      try {
        sessionStorage.setItem(HEADER_COLLAPSED_KEY, nextScrolled ? "1" : "0");
        sessionStorage.setItem(HEADER_PATH_KEY, window.location.pathname);
      } catch {
        // Ignora caso sessionStorage esteja indisponível
      }

      setScrolled((prev) => (prev !== nextScrolled ? nextScrolled : prev));

      if (y < 120) {
        setActiveSection((prev) => (prev ? "" : prev));
      }

      // Esconde ao rolar para baixo, reaparece ao rolar um pouco para cima (apenas mobile/tablet)
      if (typeof window !== "undefined" && window.innerWidth <= 900) {
        const delta = y - lastYRef.current;
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
    };

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;

      requestAnimationFrame(() => {
        applyScrollState(true);
        ticking = false;
      });
    };

    // Ao recarregar, o navegador restaura a rolagem sem (ou antes de) disparar "scroll":
    // sincroniza o estado imediatamente (sem transições de logo) na montagem e no load/pageshow.
    const sync = () => {
      lastYRef.current = window.scrollY;
      applyScrollState(false);
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
        data-hidden={hidden && !open && !(filtersActive && Boolean(filterSlot))}
        data-bg={bg}
        data-filters-active={filtersActive && Boolean(filterSlot) ? "true" : undefined}
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
            <BrandLogo
              animated={playLogoIntro}
              collapsed={scrolled}
              ready={logoReady}
              headerLogo
            />
          </Link>

          {filterSlot && (
            <div
              className={styles.headerFilters}
              data-active={filtersActive ? "true" : "false"}
              aria-hidden={!filtersActive}
            >
              {filterSlot}
            </div>
          )}

          <nav
            id="home-nav"
            className={styles.nav}
            aria-label="Principal"
            data-filters-active={filtersActive && Boolean(filterSlot) ? "true" : "false"}
          >
            <div
              className={styles.navLinks}
              data-hidden={filtersActive && Boolean(filterSlot) ? "true" : "false"}
            >
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
            </div>

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

