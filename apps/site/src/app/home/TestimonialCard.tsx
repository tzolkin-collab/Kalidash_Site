"use client";

import Image from "next/image";
import { useRef } from "react";
import FlickeringGrid from "../components/FlickeringGrid";
import styles from "./TestimonialCard.module.css";

interface TestimonialCardProps {
  quote: string;
  author: string;
  role: string;
  avatarSrc: string;
}

/**
 * Depoimento premium. Combina o "Magic Card" (spotlight que segue o cursor) e o
 * "Border Beam" (feixe de luz orbitando a borda) do Magic UI, com o FlickeringGrid
 * já usado no site como textura de fundo.
 */
export default function TestimonialCard({ quote, author, role, avatarSrc }: TestimonialCardProps) {
  const cardRef = useRef<HTMLElement>(null);

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const el = cardRef.current;
    if (!el || e.pointerType !== "mouse") return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--my", `${e.clientY - rect.top}px`);
  };

  return (
    <figure ref={cardRef} className={styles.card} onPointerMove={onPointerMove}>
      <span className={styles.beam} aria-hidden="true" />
      <span className={styles.spotlight} aria-hidden="true" />
      <div className={styles.grid} aria-hidden="true">
        <FlickeringGrid squareSize={3} gridGap={7} color="rgb(240, 179, 159)" maxOpacity={0.16} flickerChance={0.12} />
      </div>
      <span className={styles.glow} aria-hidden="true" />

      <svg className={styles.quoteMark} viewBox="0 0 48 40" aria-hidden="true">
        <path d="M0 40V24C0 10.5 7.5 2.2 20 0l1.8 5.6C14.6 7.4 11 12 10.6 18H20v22H0Zm28 0V24C28 10.5 35.5 2.2 48 0l-1.8 5.6C42.6 7.4 39 12 38.6 18H48v22H28Z" />
      </svg>

      <blockquote className={styles.quote}>
        <p>“{quote}”</p>
      </blockquote>

      <figcaption className={styles.footer}>
        <span className={styles.avatar}>
          <Image src={avatarSrc} alt="" width={292} height={195} />
        </span>
        <div>
          <strong>{author}</strong>
          <span>{role}</span>
        </div>
      </figcaption>
    </figure>
  );
}
