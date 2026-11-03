"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./steps-pin.module.css";

const clamp = (v: number) => Math.min(1, Math.max(0, v));

/* "Como entregamos": prende a faixa de passos na tela e liga a rolagem à variável --p (0..1) do próprio elemento.
 * O CSS estica a linha e acende os passos um após o outro a partir dela (só transform e opacity; os passos nunca
 * nascem escondidos). Sem JS, com movimento reduzido, em tela baixa ou no celular, `data-live` não é ligado e a faixa
 * fica como sempre foi. */
export default function StepsPin({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const wide = window.matchMedia("(min-width: 1024px) and (min-height: 700px)");
    let on = false;
    const sync = () => {
      on = wide.matches && !reduce.matches;
      setLive(on);
    };
    sync();
    wide.addEventListener("change", sync);
    reduce.addEventListener("change", sync);

    let frame = 0;
    const update = () => {
      frame = 0;
      if (!on) return;
      const rect = el.getBoundingClientRect();
      const run = rect.height - window.innerHeight;
      el.style.setProperty("--p", (run > 0 ? clamp(-rect.top / run) : 0).toFixed(4));
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
  }, []);

  return (
    <div ref={ref} className={styles.pin} data-live={live ? "" : undefined}>
      <div className={styles.sticky}>{children}</div>
    </div>
  );
}
