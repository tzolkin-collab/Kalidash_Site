"use client";

import { useEffect } from "react";

/* Diz ao CSS se o que está sob o cabeçalho é claro ou escuro (html[data-header-tone]), para a logo da Home trocar de cor
 * sem mexer em nada do comportamento do cabeçalho (some ao rolar, volta ao subir, logo que recolhe). Não renderiza nada
 * e não mexe no layout; sem JS a logo fica clara, que é a cor da abertura Imperial. */
export default function HeaderTone() {
  useEffect(() => {
    const root = document.documentElement;
    const els = [...document.querySelectorAll<HTMLElement>("[data-tone]")];
    if (!els.length) return;
    const seen = new Map<Element, boolean>();
    const apply = () => {
      /* O último elemento visível na faixa do topo (ordem do documento) é o que está sob o cabeçalho. */
      let tone = "";
      for (const el of els) if (seen.get(el)) tone = el.dataset.tone === "dark" ? "dark" : "light";
      if (tone) root.dataset.headerTone = tone;
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target, e.isIntersecting);
        apply();
      },
      { rootMargin: "0px 0px -92% 0px", threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      delete root.dataset.headerTone;
    };
  }, []);
  return null;
}
