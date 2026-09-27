"use client";

import { useEffect, useState } from "react";
import styles from "./pixel.module.css";

interface PixelTransitionProps {
  children: React.ReactNode;
  gridCols?: number;
  gridRows?: number;
  color?: string;
  duration?: number;
  pixelDuration?: number;
  className?: string;
}

/**
 * PixelTransition — Implementação React 19 / Next.js 15 segura contra erros de DOM removeChild.
 * Desmonta a grade após a conclusão da animação para economizar memória da GPU.
 */
export default function PixelTransition({
  children,
  gridCols = 14,
  gridRows = 10,
  color = "#050507",
  duration = 1400,
  pixelDuration = 450,
  className = "",
}: PixelTransitionProps) {
  const [active, setActive] = useState(true);

  useEffect(() => {
    // Desmonta a camada de pixels após a animação terminar (+100ms de margem de segurança)
    const timer = setTimeout(() => {
      setActive(false);
    }, duration + 100);

    return () => clearTimeout(timer);
  }, [duration]);

  const centerRow = (gridRows - 1) / 2;
  const centerCol = (gridCols - 1) / 2;
  const maxDist = Math.hypot(centerRow, centerCol);
  const maxDelay = Math.max(0, duration - pixelDuration);

  const totalPixels = gridRows * gridCols;
  const pixels = Array.from({ length: totalPixels }).map((_, index) => {
    const row = Math.floor(index / gridCols);
    const col = index % gridCols;

    const dist = Math.hypot(row - centerRow, col - centerCol);
    const delay = Math.round((dist / maxDist) * maxDelay);

    return {
      id: index,
      delay,
    };
  });

  return (
    <div className={`${styles.wrapper} ${className}`}>
      {children}

      <div
        className={styles.pixelGrid}
        style={
          {
            display: active ? "grid" : "none",
            "--grid-cols": gridCols,
            "--grid-rows": gridRows,
            "--pixel-color": color,
            "--pixel-duration": `${pixelDuration}ms`,
          } as React.CSSProperties
        }
        aria-hidden="true"
      >
        {pixels.map((px) => (
          <div
            key={px.id}
            className={styles.pixel}
            style={{
              animationDelay: `${px.delay}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
