"use client";

import type { ReactNode } from "react";
import styles from "./home.module.css";
import { ArrowLeft, ArrowRight } from "./icons";

/* Carrossel horizontal por scroll-snap: funciona sem JS (arrastar/rolar); as setas só
 * rolam de um item por vez. Os itens são os filhos diretos de [data-role="rail"]. */
export function CarouselArrows({ targetId, label }: { targetId: string; label: string }) {
  const go = (dir: 1 | -1) => {
    const rail = document.getElementById(targetId);
    if (!rail) return;
    const first = rail.firstElementChild as HTMLElement | null;
    const gap = parseFloat(getComputedStyle(rail).columnGap || "0") || 0;
    const step = (first?.getBoundingClientRect().width ?? rail.clientWidth * 0.8) + gap;
    rail.scrollBy({ left: dir * step, behavior: "smooth" });
  };
  return (
    <div className={styles.arrows} data-role="arrows">
      <button type="button" aria-label={`${label}: anterior`} onClick={() => go(-1)}><ArrowLeft /></button>
      <button type="button" aria-label={`${label}: próximo`} onClick={() => go(1)}><ArrowRight /></button>
    </div>
  );
}

export function Rail({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  return (
    <div id={id} className={`${styles.rail} ${className ?? ""}`} data-role="rail" tabIndex={0}>
      {children}
    </div>
  );
}
