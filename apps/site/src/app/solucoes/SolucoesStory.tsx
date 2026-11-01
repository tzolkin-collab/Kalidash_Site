"use client";

import { useEffect, useRef } from "react";

/* Liga a rolagem a duas variáveis CSS do próprio elemento, sem estado React (nada re-renderiza):
 *  --p  progresso 0..1 da seção fixada;
 *  --w  progresso da cortina entre os dois produtos (0 = Kognis, 1 = Spectra AI).
 * Sem JS ou com prefers-reduced-motion, `data-live` não é ligado e as duas telas ficam empilhadas. */
const clamp = (v: number) => Math.min(1, Math.max(0, v));
const ease = (t: number) => t * t * (3 - 2 * t);

export default function SolucoesStory({ className, children }: { className: string; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) return;
    el.dataset.live = "";

    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const run = rect.height - window.innerHeight;
      const p = run > 0 ? clamp(-rect.top / run) : 0;
      el.style.setProperty("--p", p.toFixed(4));
      el.style.setProperty("--w", ease(clamp((p - 0.36) / 0.28)).toFixed(4));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
      delete el.dataset.live;
    };
  }, []);

  return (
    <section ref={ref} className={className} aria-label="Kognis e Spectra AI">
      {children}
    </section>
  );
}

/* Paralaxe do hero: o busto sobe mais devagar que a página. Só transform. */
export function HeroParallax({ className, children }: { className: string; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const h = el.offsetHeight || 1;
      el.style.setProperty("--h", clamp(window.scrollY / h).toFixed(4));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <header ref={ref} className={className}>
      {children}
    </header>
  );
}
