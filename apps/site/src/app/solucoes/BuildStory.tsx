"use client";

import { useEffect, useRef, useState } from "react";
import BuildMocks, { InlineScene } from "./BuildMocks";
import styles from "./build-story.module.css";

type Item = { title: string; text: string; example?: string };

const clamp = (v: number) => Math.min(1, Math.max(0, v));

/* "O que construímos" da Execução: índice em acordeão (o item ativo abre) e, à direita, a tela ilustrativa da frente
 * ativa. No desktop a seção prende a tela e a rolagem troca o item; sem JS, com movimento reduzido ou em tela pequena
 * (`data-live` desligado) tudo aparece aberto e empilhado, com todo o texto. Só opacity e transform. */
export default function BuildStory({ eyebrow, title, items }: { eyebrow?: string; title: string; items: Item[] }) {
  const ref = useRef<HTMLElement>(null);
  const liveRef = useRef(false);
  const [live, setLive] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const wide = window.matchMedia("(min-width: 1024px) and (min-height: 600px)");
    const sync = () => {
      liveRef.current = wide.matches && !reduce.matches;
      setLive(liveRef.current);
    };
    sync();
    wide.addEventListener("change", sync);
    reduce.addEventListener("change", sync);

    let frame = 0;
    const update = () => {
      frame = 0;
      if (!liveRef.current) return;
      const rect = el.getBoundingClientRect();
      const run = rect.height - window.innerHeight;
      const p = run > 0 ? clamp(-rect.top / run) : 0;
      const at = Math.min(items.length - 1, Math.floor(p * items.length));
      /* Progresso do item ativo (0..1): a tela completa o movimento aos 78% do trecho e segura o resto. */
      el.style.setProperty("--s", clamp((p * items.length - at) / 0.78).toFixed(4));
      el.style.setProperty("--p", p.toFixed(4));
      setActive(at);
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
      wide.removeEventListener("change", sync);
      reduce.removeEventListener("change", sync);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [items.length]);

  const goTo = (i: number) => {
    const el = ref.current;
    if (!el || !live) return setActive(i);
    const run = el.offsetHeight - window.innerHeight;
    /* Posição no documento (offsetTop é relativo ao capítulo, não à página) e 80% do trecho do item, onde a tela já terminou de montar. */
    const top = el.getBoundingClientRect().top + window.scrollY + run * ((i + 0.8) / items.length);
    /* Com a rolagem suave (Lenis) ligada, o salto passa por ela; a rolagem nativa "smooth" brigaria com a Lenis. */
    const lenis = (window as unknown as { __lenis?: { scrollTo: (to: number, opts?: { duration?: number; force?: boolean }) => void } }).__lenis;
    if (lenis) lenis.scrollTo(top, { duration: 0.9, force: true });
    else window.scrollTo({ top, behavior: "smooth" });
  };

  return (
    <section ref={ref} className={styles.story} data-live={live ? "" : undefined} style={{ ["--n" as string]: items.length }}>
      <div className={styles.sticky}>
        <div className={styles.inner}>
          <div className={styles.copy}>
            {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
            <h2>{title}</h2>
            <ol className={styles.list}>
              {items.map((it, i) => {
                const on = !live || i === active;
                return (
                  <li key={it.title} data-on={on ? "true" : "false"}>
                    <button type="button" className={styles.head} aria-expanded={on} onClick={() => goTo(i)}>
                      <span className={styles.name}>{it.title}</span>
                    </button>
                    <div className={styles.detail}>
                      <div>
                        <p>{it.text}</p>
                        {it.example && <p className={styles.example}>{it.example}</p>}
                        {!live && <InlineScene index={i} />}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
          <div className={styles.visual}>
            <BuildMocks active={active} />
          </div>
        </div>
      </div>
    </section>
  );
}
