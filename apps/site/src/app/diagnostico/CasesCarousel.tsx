"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { diagnosticoCases } from "../home/content";
import { ArrowLeft, ArrowRight } from "../home/icons";
import styles from "./diagnostico.module.css";

const INTERVAL = 6000;

/* Carrossel do painel do Diagnóstico, sem card: logo, o que é o negócio e o que foi feito.
 * Todos os itens ocupam a mesma célula, então a altura não muda na troca. Passar o mouse ou focar pausa; com movimento reduzido, só troca pelas setas. */
export default function CasesCarousel() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = diagnosticoCases.length;

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setActive((i) => (i + 1) % total), INTERVAL);
    return () => window.clearInterval(id);
  }, [paused, total]);

  return (
    <section
      className={styles.cases}
      aria-label="Onde aplicamos"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className={styles.casesHead}>
        <span className={styles.casesLabel}>Onde aplicamos</span>
        <div className={styles.casesNav}>
          <button type="button" aria-label="Cliente anterior" onClick={() => setActive((i) => (i - 1 + total) % total)}><ArrowLeft /></button>
          <button type="button" aria-label="Próximo cliente" onClick={() => setActive((i) => (i + 1) % total)}><ArrowRight /></button>
        </div>
      </div>
      <div className={styles.casesStage}>
        {diagnosticoCases.map((item, i) => (
          <article key={item.name} className={styles.caseItem} data-on={i === active} aria-hidden={i !== active}>
            <Image className={styles.caseLogo} src={item.logo} alt={item.name} width={140} height={32} sizes="140px" loading="eager" />
            <p className={styles.caseBusiness}>{item.business}</p>
            <p className={styles.caseDone}>{item.done}</p>
          </article>
        ))}
      </div>
      <div className={styles.casesDots} aria-hidden="true">
        {diagnosticoCases.map((item, i) => (
          <i key={item.name} data-on={i === active} />
        ))}
      </div>
    </section>
  );
}
