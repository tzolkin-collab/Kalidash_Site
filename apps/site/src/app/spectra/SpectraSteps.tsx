"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Block } from "../institucional/pages";
import s from "./spectra.module.css";

type Steps = Extract<Block, { type: "steps" }>;

/* "Como funciona": os passos à esquerda e, no desktop, um monitor preso à direita que troca a imagem conforme o passo
 * que está no meio da tela. Abaixo de 1024 px o monitor some e cada passo mostra a própria imagem logo abaixo do texto.
 * Sem JS fica no primeiro passo; a troca é só opacidade. */
export default function SpectraSteps({ block }: { block: Steps }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i));
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  /* data-state (num filho, a regra usa :has): tira a seção da entrada por rolagem da /solucoes (productSurge), que forçaria opacidade 1 nas imagens do monitor. */
  return (
    <section className={s.how} data-tone="dark" aria-labelledby="spectra-how">
      <div className={s.wrap} data-state={`passo-${active + 1}`}>
        <header className={s.howHead}>
          {block.eyebrow && <p className={s.label}>{block.eyebrow}</p>}
          <h2 id="spectra-how">{block.title.join(" ")}</h2>
        </header>
        <div className={s.howGrid}>
          <ol className={s.howList}>
            {block.items.map((item, i) => (
              <li
                key={item.title}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                data-i={i}
                data-active={i === active}
              >
                <span className={s.howNum}>{String(i + 1).padStart(2, "0")}</span>
                <div className={s.howText}>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
                {item.image && (
                  <figure className={s.inlineFig} data-kind={item.image.src.includes("camera") ? "camera" : "screen"}>
                    <div className={s.frame}>
                      <Image src={item.image.src} alt={item.image.alt} width={item.image.width} height={item.image.height} sizes="(max-width: 1023px) 92vw, 1px" />
                    </div>
                    {item.image.caption && <figcaption>{item.image.caption}</figcaption>}
                  </figure>
                )}
              </li>
            ))}
          </ol>
          <div className={s.monitorCol} aria-hidden="true">
            <div className={s.monitor}>
              {block.items.map((item, i) =>
                item.image ? (
                  <figure key={item.title} className={s.shot} data-on={i === active} data-kind={item.image.src.includes("camera") ? "camera" : "screen"}>
                    <div className={s.frame}>
                      <Image src={item.image.src} alt="" width={item.image.width} height={item.image.height} sizes="(max-width: 1023px) 1px, 680px" />
                    </div>
                    {item.image.caption && <figcaption><span>{String(i + 1).padStart(2, "0")}</span>{item.image.caption}</figcaption>}
                  </figure>
                ) : null,
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
