"use client";

import { useEffect } from "react";
import styles from "./home.module.css";

/* Entradas da Home ao rolar: cada peça sobe e aparece assim que entra na tela, em sequência curta com as que entram junto.
 * Só marca o que ainda está fora da tela depois de montar: sem JS, com movimento reduzido ou para o que já está à vista, nada fica
 * escondido. Só opacity e transform, então o layout não se mexe. O hero, o carrossel de logos, a galeria, o holograma e os cartões de
 * depoimento têm movimento próprio e ficam de fora. Não renderiza nada. */
const c = (name: string) => `.${styles[name]}`;

const TARGETS = [
  `${c("problemTop")}`,
  `${c("hologramCol")}`,
  `${c("symptom")}`,
  `${c("frontsIntro")} > *`,
  `${c("frontRow")}`,
  `${c("expIntro")} ${c("eyebrow")}`,
  `${c("expIntroLeft")} h2`,
  `${c("expProof")}`,
  `${c("expIntroRight")} > *`,
  `${c("expAuthorityCol")}`,
  `${c("caseContent")} > div:first-child`,
  `${c("caseBody")} > *`,
  `${c("caseMedia")}`,
  `${c("resultsHead")} > *`,
  `${c("diagnosticoText")} > *`,
  `${c("diagnosticoCtaBox")} > *`,
].join(", ");

const STEP = 80; /* intervalo entre peças que entram juntas (ms) */
const SETTLE = 1500; /* depois disso a marca sai e o hover de cada peça volta a valer */

export default function HomeMotion() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const timers = new Set<number>();
    const io = new IntersectionObserver(
      (entries) => {
        /* A sequência conta só o que entrou agora: quem chega sozinho, rolando, não espera os vizinhos que já passaram. */
        entries
          .filter((e) => e.isIntersecting)
          .forEach((e, i) => {
            const el = e.target as HTMLElement;
            io.unobserve(el);
            const delay = Math.min(i, 4) * STEP;
            el.style.setProperty("--hm-d", `${delay}ms`);
            el.dataset.hm = "in";
            const id = window.setTimeout(() => {
              delete el.dataset.hm;
              el.style.removeProperty("--hm-d");
              timers.delete(id);
            }, SETTLE + delay);
            timers.add(id);
          });
      },
      { rootMargin: "0px 0px -4% 0px" },
    );
    const fold = window.innerHeight * 0.96;
    const armed = [...document.querySelectorAll<HTMLElement>(TARGETS)].filter((el) => el.getBoundingClientRect().top >= fold);
    armed.forEach((el) => {
      el.dataset.hm = "out";
      io.observe(el);
    });
    return () => {
      io.disconnect();
      timers.forEach((id) => window.clearTimeout(id));
      armed.forEach((el) => {
        delete el.dataset.hm;
        el.style.removeProperty("--hm-d");
      });
    };
  }, []);
  return null;
}
