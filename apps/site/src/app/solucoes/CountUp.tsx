"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./countup.module.css";

/* Número que conta uma vez, quando entra na tela ("+10 mil", "3x", "+90%", "8 horas").
 * O valor final está sempre no DOM e no aria-label: o SSR, o leitor de tela e quem desliga o movimento
 * veem o número certo. A largura é reservada por uma cópia invisível (CSS `attr`), então o layout não se mexe. */
export default function CountUp({ value }: { value: string }) {
  const match = value.match(/^(\D*?)(\d+)(.*)$/);
  const prefix = match?.[1] ?? "";
  const suffix = match?.[3] ?? "";
  const target = match ? Number(match[2]) : null;
  const ref = useRef<HTMLSpanElement>(null);
  const [current, setCurrent] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || target === null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const mountedAt = performance.now();
    let frame = 0;
    let done = false;

    const run = () => {
      const started = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - started) / 1100);
        const eased = 1 - Math.pow(1 - t, 3);
        if (t < 1) {
          setCurrent(Math.round(target * eased));
          frame = requestAnimationFrame(tick);
        } else {
          setCurrent(null);
        }
      };
      setCurrent(0);
      frame = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (done || !entries.some((e) => e.isIntersecting)) return;
        done = true;
        observer.disconnect();
        /* Já estava na tela ao carregar: não anima, para não piscar o valor final antes de zerar. */
        if (performance.now() - mountedAt < 600) return;
        run();
      },
      { threshold: 0.6 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [target]);

  if (target === null) return <>{value}</>;
  return (
    <span ref={ref} role="img" aria-label={value} className={styles.count}>
      <span className={styles.sizer} data-value={value} aria-hidden="true" />
      <span className={styles.live} aria-hidden="true">{current === null ? value : `${prefix}${current}${suffix}`}</span>
    </span>
  );
}
