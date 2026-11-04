"use client";

import { useEffect } from "react";

/* Movimento de rolagem por JS onde o CSS de rolagem (animation-timeline) não serve: no celular/tela baixa sempre (o Safari do
 * iOS não tem suporte completo e foi onde o efeito não aparecia) e em qualquer navegador sem suporte. Recomendação do Chrome:
 * em vez do polyfill, IntersectionObserver para o que entra na tela e um ouvinte de rolagem para o paralaxe.
 *  - [data-motion="curtain"]: capítulo sobe em cortina ao entrar (html[data-motion="js"] liga o estado inicial no CSS);
 *  - títulos, figuras e perguntas dentro dele surgem ao entrar (fora de capítulos com animação própria);
 *  - [data-motion="hero"]: abertura Imperial; texto e foto descem mais devagar que a página (--drift 0..1).
 * Nada fica escondido sem JS: o estado inicial só existe depois que este script marca o <html>. Desligado com movimento reduzido. */
export default function ScrollMotion() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const small = window.matchMedia("(max-width: 900px), (max-height: 739px)").matches;
    const native =
      typeof CSS !== "undefined" &&
      CSS.supports("(animation-timeline: view()) and (animation-range: entry 0% entry 40%)");
    if (!small && native) return;

    const root = document.documentElement;
    root.dataset.motion = "js";

    const own = '[class*="story"], [class*="pin"], [class*="countup"], [data-state], [data-live]';
    const chapters = [...document.querySelectorAll<HTMLElement>('[data-motion="curtain"]')];
    const surge = chapters
      .filter((c) => !c.querySelector(own))
      .flatMap((c) => [...c.querySelectorAll<HTMLElement>("h2, figure, details")]);
    surge.forEach((el) => (el.dataset.surge = ""));

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            (e.target as HTMLElement).dataset.in = "";
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0 },
    );
    [...chapters, ...surge].forEach((el) => io.observe(el));

    /* Abertura como no desktop: fica presa e o primeiro capítulo sobe por cima. No celular ela é mais alta que a tela, então
     * prende pelo pé (top negativo = altura da tela - altura da abertura): rola até o fim dela aparecer inteiro e só então
     * fica parada enquanto é coberta. --drift (0..1) mede o quanto já foi coberta e afunda o texto e a foto. */
    const hero = document.querySelector<HTMLElement>('[data-motion="hero"]');
    let frame = 0;
    let pinTop = 0;
    const measure = () => {
      if (!hero) return;
      pinTop = Math.min(0, window.innerHeight - hero.offsetHeight);
      hero.style.setProperty("--pin-top", `${pinTop}px`);
    };
    const update = () => {
      frame = 0;
      if (!hero) return;
      const covered = window.scrollY + pinTop; // quanto já rolou depois de a abertura prender
      const span = Math.max(1, window.innerHeight * 0.9);
      hero.style.setProperty("--drift", Math.min(1, Math.max(0, covered / span)).toFixed(4));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const onResize = () => {
      measure();
      onScroll();
    };
    if (hero) {
      measure();
      update();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onResize);
    }

    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (frame) cancelAnimationFrame(frame);
      surge.forEach((el) => {
        delete el.dataset.surge;
        delete el.dataset.in;
      });
      chapters.forEach((el) => delete el.dataset.in);
      delete root.dataset.motion;
    };
  }, []);
  return null;
}
