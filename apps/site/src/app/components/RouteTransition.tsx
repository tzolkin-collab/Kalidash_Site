"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import styles from "./route-transition.module.css";

/* Transição entre páginas no celular: dois fundos (roxo e terracota) entram da direita, a mesma direção do menu,
 * a navegação acontece por baixo deles e eles saem para a esquerda revelando a página nova.
 * - Só no celular (até 900px), nunca com prefers-reduced-motion e nunca com a abertura da Home rodando.
 * - Só clique normal em link interno para outra rota. Voltar/avançar do navegador, abas novas, links de outra origem,
 *   âncoras da mesma página e /admin e /preview seguem o comportamento padrão.
 * - As camadas nascem escondidas (visibility) e CSS puro: sem JS elas nunca aparecem, e um limite de tempo as
 *   recolhe se a rota nova não chegar. */
const COVER_MS = 600;
const LEAVE_MS = 920;
const GIVE_UP_MS = 6000;

export default function RouteTransition() {
  const router = useRouter();
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);
  const pending = useRef<string | null>(null);
  const timers = useRef<number[]>([]);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  const setPhase = (phase: "idle" | "cover" | "leave") => {
    rootRef.current?.setAttribute("data-phase", phase);
    /* Enquanto a página nova monta coberta, as entradas dela esperam (globals.css: --enter-delay). */
    if (phase === "cover") document.documentElement.setAttribute("data-route-cover", "");
    if (phase === "idle") document.documentElement.removeAttribute("data-route-cover");
  };
  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (!window.matchMedia("(max-width: 900px)").matches) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      if ((location.pathname === "/" && document.documentElement.hasAttribute("data-intro")) || pending.current) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target || a.hasAttribute("download") || a.hasAttribute("data-no-transition")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || /^\/(admin|preview)(\/|$)/.test(url.pathname)) return;
      if (url.pathname === location.pathname) return;

      e.preventDefault();
      e.stopImmediatePropagation();
      pending.current = url.pathname;
      setPhase("cover");
      later(() => router.push(url.pathname + url.search + url.hash), COVER_MS);
      later(() => {
        pending.current = null;
        setPhase("idle");
      }, GIVE_UP_MS);
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clear();
    };
  }, [router]);

  useEffect(() => {
    if (pending.current === null || pathname !== pending.current) return;
    pending.current = null;
    clear();
    setPhase("leave");
    later(() => setPhase("idle"), LEAVE_MS);
  }, [pathname]);

  return (
    <div ref={rootRef} className={styles.root} data-phase="idle" data-route-transition="" aria-hidden="true">
      <div className={`${styles.layer} ${styles.first}`} />
      <div className={`${styles.layer} ${styles.second}`} />
    </div>
  );
}
