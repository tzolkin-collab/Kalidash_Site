"use client";

import { useEffect } from "react";
import { CHEVRON, GOLD_BOTTOM, GOLD_TOP, LETTERS_DATA } from "./BrandLogo";
import styles from "./logo-intro.module.css";

/* Abertura da Home: o logo da Kalidash entra em tela cheia e a cortina sobe.
 * - Roda uma vez por sessão, nunca em reload e nunca com prefers-reduced-motion.
 * - A decisão é tomada no layout raiz (script inline no head, antes da pintura), que marca <html data-intro>.
 *   Sem a marca o overlay é `display: none`: quem não vê a abertura não vê piscada nenhuma. O script não pode
 *   ficar neste componente: tag de script dentro de componente client gera aviso do React e não executa em navegação.
 * - O overlay se esconde sozinho no fim da animação CSS (visibility), então nunca fica preso se o JS falhar.
 * - O movimento das letras é o da própria marca (saem de trás do símbolo, em cascata, com os mesmos deslocamentos). */
const KEY = "kalidash:intro-played";
const TOTAL_MS = 2600;

export default function LogoIntro() {
  useEffect(() => {
    const root = document.documentElement;
    if (!root.hasAttribute("data-intro")) return;
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      /* sem sessionStorage: a abertura só roda de novo numa próxima visita, sem erro */
    }
    const timer = window.setTimeout(() => root.removeAttribute("data-intro"), TOTAL_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <>
      <div className={styles.overlay} aria-hidden="true">
        <svg className={styles.logo} viewBox="0 0 174 27" role="presentation">
          <defs>
            <clipPath id="logo-intro-clip">
              <rect x="28" y="-4" width="150" height="35" />
            </clipPath>
          </defs>
          <g clipPath="url(#logo-intro-clip)">
            {[...LETTERS_DATA].reverse().map((item) => (
              <g
                key={item.index}
                className={styles.letter}
                style={{ "--shift-x": `${item.shiftX}px`, "--i": item.index } as React.CSSProperties}
              >
                <path d={item.d} />
              </g>
            ))}
          </g>
          <g className={styles.mark}>
            <path className={`${styles.gold} ${styles.goldTop}`} d={GOLD_TOP} />
            <path className={`${styles.gold} ${styles.goldBottom}`} d={GOLD_BOTTOM} />
            <path className={styles.chevron} d={CHEVRON} />
          </g>
        </svg>
        <div className={styles.edge} />
      </div>
    </>
  );
}
