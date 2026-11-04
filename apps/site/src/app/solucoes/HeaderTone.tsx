"use client";

import { useEffect } from "react";

/* Diz ao CSS se o que está sob o cabeçalho é claro ou escuro (html[data-header-tone]), para a logo do cabeçalho trocar de cor
 * (branca sobre Imperial, Imperial sobre claro) sem mexer em nada do comportamento dele (some ao rolar, volta ao subir, logo que
 * recolhe). Não renderiza nada e não mexe no layout; sem JS a logo fica na cor padrão.
 * Global: está no HomeHeader, então vale em todas as páginas. Duas fontes, nesta ordem:
 *  1. seções marcadas com data-tone ("dark" ou outra coisa = claro), como nas páginas de capítulos;
 *  2. sem marcação, mede a cor de fundo do que está sob o topo da tela (sobe pelos ancestrais até achar um fundo opaco). */
const luminance = (r: number, g: number, b: number) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

function toneUnderHeader(): "dark" | "light" {
  const stack = document.elementsFromPoint(Math.round(window.innerWidth / 2), 44);
  for (const el of stack) {
    if (el.closest('header[data-block="home-header"]')) continue;
    if (getComputedStyle(el).position === "fixed") continue;
    for (let n: Element | null = el; n; n = n.parentElement) {
      const m = getComputedStyle(n).backgroundColor.match(/rgba?\(([^)]+)\)/);
      if (!m) continue;
      const [r, g, b, a = 1] = m[1].split(",").map((v) => parseFloat(v));
      if (a > 0.6) return luminance(r, g, b) < 0.4 ? "dark" : "light";
    }
  }
  return "light";
}

export default function HeaderTone() {
  useEffect(() => {
    const root = document.documentElement;
    /* Só blocos de página contam como fundo. A logo (BrandLogo, inclusive a do rodapé) e etiquetas pequenas também usam
     * data-tone para outra coisa; se entrassem aqui, uma página sem capítulos ficaria presa ao modo "marcado" com só a logo
     * do rodapé e a logo do cabeçalho nunca clarearia sobre as faixas Imperial. */
    const marked = [...document.querySelectorAll<HTMLElement>("[data-tone]")].filter(
      (el) =>
        (el.dataset.tone === "dark" || el.dataset.tone === "soft" || el.dataset.tone === "paper") &&
        !el.closest('header[data-block="home-header"]') &&
        !(el instanceof SVGElement) &&
        el.tagName !== "SPAN",
    );
    let io: IntersectionObserver | undefined;
    let frame = 0;
    const cleanup: Array<() => void> = [];

    if (marked.length) {
      const seen = new Map<Element, boolean>();
      const apply = () => {
        /* O último elemento visível na faixa do topo (ordem do documento) é o que está sob o cabeçalho. */
        let tone = "";
        for (const el of marked) if (seen.get(el)) tone = el.dataset.tone === "dark" ? "dark" : "light";
        if (tone) root.dataset.headerTone = tone;
      };
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) seen.set(e.target, e.isIntersecting);
          apply();
        },
        { rootMargin: "0px 0px -92% 0px", threshold: 0 },
      );
      marked.forEach((el) => io!.observe(el));
    } else {
      const update = () => {
        frame = 0;
        root.dataset.headerTone = toneUnderHeader();
      };
      const onScroll = () => {
        if (!frame) frame = requestAnimationFrame(update);
      };
      update();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
      cleanup.push(() => {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
        if (frame) cancelAnimationFrame(frame);
      });
    }
    return () => {
      io?.disconnect();
      cleanup.forEach((fn) => fn());
      delete root.dataset.headerTone;
    };
  }, []);
  return null;
}
