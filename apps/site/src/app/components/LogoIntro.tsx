"use client";

import { useEffect, useRef } from "react";
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
const TOTAL_MS = 4500;

/* As 4 primeiras seções da Home carregam por baixo da abertura; o resto, quando ela termina.
 * Só roda quando a abertura roda: sem ela, o lazy nativo segue como sempre foi. */
const EARLY_BLOCKS = ["home-hero", "home-problem", "home-fronts", "home-experience"];

function promote(selector: string) {
  document.querySelectorAll<HTMLImageElement>(`${selector} img[loading="lazy"]`).forEach((img) => {
    img.loading = "eager";
  });
}

/* Centro do K dentro do viewBox do logo (0 a 174 de largura). */
const K_CENTER = 13.5 / 174;

export default function LogoIntro() {
  const logoRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    /* FLIP: mede UMA vez, antes de o K andar, onde está o K do cabeçalho e manda o K da abertura pousar ali, só com
     * transform. A posição de partida vem do layout (camada centralizada, tamanho calculado), nunca de
     * getBoundingClientRect do próprio logo: assim a medida não muda se o K já estiver animando. Nada é medido durante
     * a animação. Sem medida, vale o padrão do CSS. */
    const svg = logoRef.current;
    if (!svg || !document.documentElement.hasAttribute("data-intro")) return;
    const stage = svg.parentElement;
    let frame = 0;
    const started = performance.now();
    const measure = (): boolean => {
      const target = document.querySelector<SVGSVGElement>("[data-header-logo] > svg");
      const b = target?.getBoundingClientRect();
      if (!stage || !b || !b.width) return false;
      const w = parseFloat(getComputedStyle(svg).width);
      if (!w) return false;
      const h = (w * 27) / 174;
      const left = (stage.clientWidth - w) / 2;
      const top = (stage.clientHeight - h) / 2;
      svg.style.setProperty("--tx", `${b.left + b.width * K_CENTER - (left + w * K_CENTER)}px`);
      svg.style.setProperty("--ty", `${b.top + b.height / 2 - (top + h / 2)}px`);
      svg.style.setProperty("--s", String(b.width / w));
      return true;
    };
    const first = () => {
      if (!measure() && performance.now() - started < 1500) frame = requestAnimationFrame(first);
    };
    first();
    /* O cabeçalho ainda pode estar se assentando na primeira medida: confirma uma vez, antes de o K começar (2,2 s). */
    const again = window.setTimeout(measure, 1750);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(again);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (!root.hasAttribute("data-intro")) return;
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      /* sem sessionStorage: a abertura só roda de novo numa próxima visita, sem erro */
    }
    const early = () => promote(EARLY_BLOCKS.map((b) => `[data-block="${b}"]`).join(","));
    const rest = () => promote("main");
    /* Espera o load da página para não competir com a imagem do herói (LCP). */
    if (document.readyState === "complete") early();
    else window.addEventListener("load", early, { once: true });
    const timer = window.setTimeout(() => {
      root.removeAttribute("data-intro");
      const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200));
      idle(rest);
    }, TOTAL_MS);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("load", early);
    };
  }, []);

  return (
    <>
      <div className={styles.overlay} aria-hidden="true">
        <div className={styles.edge} />
      </div>
      <div className={`${styles.layer} ${styles.purple}`} aria-hidden="true" />
      <div className={`${styles.layer} ${styles.terra}`} aria-hidden="true" />
      <div className={styles.stage} aria-hidden="true">
        <svg ref={logoRef} className={styles.logo} viewBox="0 0 174 27" role="presentation">
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
      </div>
    </>
  );
}
