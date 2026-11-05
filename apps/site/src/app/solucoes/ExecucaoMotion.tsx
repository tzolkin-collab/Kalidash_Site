"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import home from "../home/home.module.css";
import { ArrowRight } from "../home/icons";
import type { Block } from "../institucional/pages";
import { Legend } from "./ProductPage";
import { Accent } from "./AdvisoryViews";
import CountUp from "./CountUp";
import prod from "./product.module.css";
import styles from "./kit.module.css";
import fx from "./execucao-motion.module.css";

/* Movimento da página /execucao fora do palco "O que construímos" e do StepsPin: seção 2 (gargalos), seção 5 (prova) e fecho.
 * Nenhuma palavra muda: o texto só é repartido em peças, na mesma ordem. Nada nasce escondido sem JS: o estado inicial só existe
 * depois de montar (data-ready) e só com movimento permitido. Só transform e opacity. */

type Of<T extends Block["type"]> = Extract<Block, { type: T }>;

const clamp = (v: number) => Math.min(1, Math.max(0, v));

/* Grupo que entra na vista (uma vez): data-ready liga o estado de partida, data-in o estado final. */
function Fx({ as: Tag = "div", className, children }: { as?: ElementType; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [state, setState] = useState<"" | "ready" | "in">("");
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.85) return; // já à vista no carregamento: fica como está
    setState("ready");
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setState("in");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={className} data-fx={state || undefined}>
      {children}
    </Tag>
  );
}

function Rich({ text }: { text: string }) {
  return <>{text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))}</>;
}

/* Seção 2: os três gargalos do parágrafo ganham destaque sucessivo ligado à rolagem; a frase final entra por último. */
export function ExecucaoLead({ block, soft }: { block: Of<"text">; soft: boolean }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      el.style.setProperty("--g", clamp((vh * 0.9 - r.top) / (vh * 0.8)).toFixed(3));
    };
    const on = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  /* "A, B, C. Resto": só a primeira frase se reparte, e só nas vírgulas. */
  const first = block.paragraphs?.[0] ?? "";
  const cut = first.indexOf(". ");
  const head = cut > 0 ? first.slice(0, cut) : "";
  const gaps = head.split(", ");
  const split = gaps.length === 3;
  return (
    <section ref={ref} className={`${prod.section}${soft ? ` ${prod.soft}` : ""} ${fx.lead}`}>
      <div className={prod.wrap}>
        {block.eyebrow && <Legend>{block.eyebrow}</Legend>}
        <div className={styles.assert}>
          <h2><Accent text={block.title.join(" ")} word={block.accent} className={styles.gold} /></h2>
          <div className={styles.paragraphs}>
            {block.paragraphs?.map((p, pi) =>
              pi === 0 && split ? (
                <p key={p}>
                  {gaps.map((g, i) => (
                    <span key={g}>
                      <span className={fx.gap} style={{ ["--i" as string]: i }}>{g}</span>
                      {i < 2 ? ", " : ""}
                    </span>
                  ))}
                  {first.slice(cut)}
                </p>
              ) : (
                <p key={p}><Rich text={p} /></p>
              ),
            )}
          </div>
        </div>
        {block.highlight && (
          <div className={`${styles.manifesto} ${fx.manifesto}`}>
            <p><Accent text={block.highlight.join(" ")} word={block.highlightAccent} className={styles.gold} /></p>
          </div>
        )}
      </div>
    </section>
  );
}

/* Seção 5: prova. Números com CountUp e filete que cresce, foto do case com máscara que abre, destaque nos dois números do piloto,
 * lista em stagger. */
export function ExecucaoProof({ block, soft }: { block: Of<"showcase">; soft: boolean }) {
  const metrics = block.metrics.filter((m) => m.confirmed);
  const f = block.featured;
  const statParts = f.stats?.confirmed ? f.stats.text.split(/(1\.681|97%)/g) : [];
  return (
    <section className={`${prod.section}${soft ? ` ${prod.soft}` : ""} ${fx.proof}`}>
      <div className={prod.wrap}>
        <Legend>{block.eyebrow}</Legend>
        <h2 className={prod.h2Wide}>{block.title.join(" ")}</h2>
        {metrics.length > 0 && (
          <Fx as="ul" className={`${styles.numbers} ${fx.numbers}`}>
            {metrics.map((m) => (
              <li key={m.value}>
                <strong><CountUp value={m.value} /></strong>
                <span>{m.label}</span>
              </li>
            ))}
          </Fx>
        )}
        <Fx as="article" className={`${styles.case} ${fx.case}`}>
          {f.image && (
            <div className={`${styles.casePhoto} ${fx.photo}`}>
              <Image src={f.image.src} alt={f.image.alt} width={f.image.width} height={f.image.height} sizes="(max-width: 900px) 100vw, 700px" loading="lazy" />
            </div>
          )}
          <div className={styles.caseText}>
            <p className={styles.badge}>{f.eyebrow}</p>
            <h3>{f.title}</h3>
            <p>{f.text}</p>
            {f.stats?.confirmed && (
              <p className={styles.stat}>
                {statParts.map((part, i) => (i % 2 ? <em key={i} className={fx.mark}>{part}</em> : part))}
              </p>
            )}
            <p className={styles.badge}>{f.badge}</p>
            {f.pageReady && (
              <Link href={f.cta.href} className={home.textLink}>
                {f.cta.label} <ArrowRight />
              </Link>
            )}
          </div>
        </Fx>
        {/* `hideItems`: a Carol ainda não confirmou a saída de Kognis e Spectra; o campo oculta a lista sem apagar o texto. */}
        {!block.hideItems && (
          <Fx as="ul" className={`${styles.products} ${fx.products}`}>
            {block.items.map((item, i) => (
              <li key={item.title} style={{ ["--i" as string]: i }}>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                {item.href && (
                  <Link href={item.href} className={home.textLink}>
                    Saiba mais <ArrowRight />
                  </Link>
                )}
              </li>
            ))}
          </Fx>
        )}
      </div>
    </section>
  );
}

/* Fecho: a frase entra por linhas e "começar." por último, em ouro. Mesma ordem de palavras. */
export function ExecucaoClosing({ text }: { text: string }) {
  const words = text.split(" ");
  const lines = [words.slice(0, 5).join(" "), words.slice(5, -1).join(" ")];
  const last = words[words.length - 1];
  return (
    <Fx as="p" className={fx.closing}>
      <span className={fx.cl} style={{ ["--i" as string]: 0 }}>{lines[0]}</span>{" "}
      <span className={fx.cl} style={{ ["--i" as string]: 1 }}>{lines[1]} <span className={`${styles.gold} ${fx.last}`}>{last}</span></span>
    </Fx>
  );
}
