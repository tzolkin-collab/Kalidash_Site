"use client";

/* Execução, "Como entregamos" (teste de 09/11): céu ao fundo e quatro pilastras que sobem uma a uma com a rolagem. A pilastra do
 * momento fica em foco, com o texto do passo sobre o fuste; o título do passo vai em cima do capitel e sobe junto. No fim as quatro
 * ficam em foco. A subida segue a rolagem (--p, 0..1); o foco troca por data-step (0..3, ou "all" no fim).
 * Depois disso a rolagem continua pelas pilastras até a base, com o céu parado, e a frase final monta ao pé delas.
 * Sem JS, com movimento reduzido, em tela baixa ou no celular, data-live não liga: os passos viram uma lista simples sobre o céu. */
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Block } from "../institucional/pages";
import s from "./pillars.module.css";

type Of<T extends Block["type"]> = Extract<Block, { type: T }>;

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const START = 0.04; /* a primeira pilastra começa a subir */
const SPAN = 0.2; /* trecho de cada passo */
const END = START + SPAN * 4; /* depois disso, as quatro em foco */

export default function ExecucaoPillars({ block }: { block: Of<"steps"> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    const root = el?.parentElement;
    if (!el || !root) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const wide = window.matchMedia("(min-width: 1024px) and (min-height: 640px)");
    let on = false;
    const sync = () => {
      on = wide.matches && !reduce.matches;
      setLive(on);
    };
    sync();
    wide.addEventListener("change", sync);
    reduce.addEventListener("change", sync);

    /* Quanto da pilastra sobra abaixo do palco preso (--over, em px): é o que aparece quando a rolagem continua, até a base.
     * O bloco de baixo começa depois disso. Medido sem depender da subida (a coluna não tem transform; fuste e pilastra sobem juntos). */
    const measure = () => {
      const stage = el.querySelector<HTMLElement>(`.${s.stage}`);
      const col = el.querySelector<HTMLElement>(`.${s.col}`);
      const lift = el.querySelector<HTMLElement>(`.${s.lift}`);
      const img = el.querySelector<HTMLElement>(`.${s.column}`);
      if (!on || !stage || !col || !lift || !img || !img.offsetHeight) return;
      const stageBox = stage.getBoundingClientRect();
      const top = col.getBoundingClientRect().top - stageBox.top + (img.getBoundingClientRect().top - lift.getBoundingClientRect().top);
      root.style.setProperty("--over", `${Math.max(0, Math.round(top + img.offsetHeight - stageBox.height))}px`);
    };

    let frame = 0;
    let last = "";
    const update = () => {
      frame = 0;
      if (!on) return;
      const rect = el.getBoundingClientRect();
      const run = rect.height - window.innerHeight;
      const p = run > 0 ? clamp(-rect.top / run / 0.9) : 0; /* termina em 90% do palco: o fim fica parado antes de soltar */
      root.style.setProperty("--p", p.toFixed(4));
      const step = p >= END ? "all" : String(Math.min(3, Math.max(0, Math.floor((p - START) / SPAN))));
      if (step !== last) {
        last = step;
        root.dataset.step = step;
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const onResize = () => {
      measure();
      onScroll();
    };
    update();
    measure();
    const img = el.querySelector<HTMLImageElement>(`.${s.column}`);
    img?.addEventListener("load", measure);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      img?.removeEventListener("load", measure);
      wide.removeEventListener("change", sync);
      reduce.removeEventListener("change", sync);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [live]);

  return (
    <section className={s.sky} data-state="pilares" data-live={live ? "" : undefined} data-step="0">
      {/* O céu fica parado atrás da seção inteira: do palco preso até o bloco de baixo. */}
      <div className={s.backdropTrack} aria-hidden="true">
        <div className={s.backdrop}>
          <Image src="/execucao/ceu.jpg" alt="" fill sizes="100vw" loading="lazy" />
        </div>
      </div>
      <div ref={ref} className={s.track}>
        <div className={s.stage}>
          <div className={s.inner}>
            <h2 className={s.heading}>{block.title.join(" ")}</h2>
            <ol className={s.row}>
              {block.items.map((item, i) => (
                <li key={item.title} className={s.col} data-i={i} style={{ "--t": (START + SPAN * i).toFixed(2) } as React.CSSProperties}>
                  <div className={s.lift}>
                    <div className={s.cap}>
                      <span className={s.num}>{String(i + 1).padStart(2, "0")}</span>
                      <h3>{item.title}</h3>
                    </div>
                    <div className={s.shaft}>
                      <Image className={s.column} src="/execucao/pilastra.webp" alt="" width={440} height={1749} sizes="(min-width: 1024px) 18vw, 0px" loading="lazy" />
                      <p className={s.plaque}>{item.text}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
      {block.closing && (
        <div className={s.after}>
          {/* Cartão em que as bases das pilastras encostam. */}
          <div className={s.afterCard}>
            <p className={s.afterLine}>{block.closing[0]}</p>
            {block.closing[1] && <p className={s.afterSub}>{block.closing[1]}</p>}
          </div>
        </div>
      )}
    </section>
  );
}
