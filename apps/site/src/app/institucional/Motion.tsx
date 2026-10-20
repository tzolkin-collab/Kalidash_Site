"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import styles from "./institucional.module.css";
import type { Testimonial } from "./pages";

/* Entrada ao rolar: só opacity/transform. Sem JS ou com prefers-reduced-motion o conteúdo fica visível (state "idle"/"in").
 * O estado "hidden" só é aplicado a elementos que ainda estão abaixo da dobra, então nada pisca no LCP. */
export function Reveal({
  as: Tag = "div",
  className,
  children,
  ...rest
}: {
  as?: "div" | "ol" | "ul";
  className?: string;
  children: React.ReactNode;
  [dataAttr: `data-${string}`]: string | number | undefined;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      el.dataset.state = "in";
      return;
    }
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) {
      el.dataset.state = "in";
      return;
    }
    el.dataset.state = "hidden";
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.dataset.state = "in";
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const Component = Tag as React.ElementType;
  return (
    <Component ref={ref} className={className} {...rest} data-reveal data-state="idle">
      {children}
    </Component>
  );
}

/* Só embeds de provedores conhecidos (YouTube sem cookies, Vimeo). */
const ALLOWED_EMBED = /^https:\/\/(www\.youtube-nocookie\.com\/embed\/|player\.vimeo\.com\/video\/)/;

export function TestimonialCard({ item }: { item: Testimonial }) {
  const [playing, setPlaying] = useState(false);
  const playable = item.status === "approved" && ALLOWED_EMBED.test(item.embedUrl);

  return (
    <figure className={styles.testimonial}>
      <div className={styles.video}>
        {playing && playable ? (
          <iframe
            src={`${item.embedUrl}${item.embedUrl.includes("?") ? "&" : "?"}autoplay=1`}
            title={`Depoimento de ${item.nome}`}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <>
            {item.posterUrl && <Image src={item.posterUrl} alt="" width={640} height={360} sizes="(max-width: 900px) 100vw, 560px" />}
            <button
              type="button"
              className={styles.play}
              onClick={() => setPlaying(true)}
              disabled={!playable}
              aria-label={playable ? `Assistir ao depoimento de ${item.nome}` : `Depoimento de ${item.nome} ainda indisponível`}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
            </button>
            {!playable && <span className={styles.pending}>Pendente: vídeo e autorização</span>}
          </>
        )}
      </div>
      <figcaption>
        <strong>{item.nome}</strong>
        <span>{item.cargo} · {item.empresa}</span>
      </figcaption>
    </figure>
  );
}
