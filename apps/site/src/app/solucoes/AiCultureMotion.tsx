"use client";

/* AI Culture (/treinamento-corporativo-ia): layout V3 e movimento de rolagem. Toda a copy vem de pages.ts e é só repartida em peças
 * (nenhuma palavra muda). Movimento: framer-motion (useScroll/useTransform/useInView), só opacity e transform. Nada nasce escondido:
 * o estado "armado" (esconder para revelar) só liga depois da hidratação e só sem movimento reduzido. */

import Image from "next/image";
import Link from "next/link";
import { useRef, useSyncExternalStore, type ReactNode, type SVGProps } from "react";
import { LazyMotion, domAnimation, m, useInView, useScroll, useTransform } from "framer-motion";
import home from "../home/home.module.css";
import { ArrowRight } from "../home/icons";
import type { Block } from "../institucional/pages";
import { Legend } from "./ProductPage";
import prod from "./product.module.css";
import s from "./ai-culture-motion.module.css";

type Of<T extends Block["type"]> = Extract<Block, { type: T }>;

function Rich({ text }: { text: string }) {
  return <>{text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))}</>;
}

/* true só depois da hidratação e sem movimento reduzido: antes disso (SSR, sem JS) tudo aparece completo. */
const RM = "(prefers-reduced-motion: reduce)";
function subscribeRM(cb: () => void) {
  const mq = window.matchMedia(RM);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function useArmed() {
  /* servidor e hidratação: false (tudo visível); no cliente: true se o movimento não estiver reduzido */
  return useSyncExternalStore(subscribeRM, () => !window.matchMedia(RM).matches, () => false);
}

/* ---------- Ícones de linha (24×24) ---------- */
const base: SVGProps<SVGSVGElement> = { viewBox: "0 0 24 24", width: 24, height: 24, fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, focusable: false };
const ICONS: ReactNode[] = [
  /* trilhas por área: um caminho que se divide */
  <path key="a" pathLength={1} d="M4 20c5 0 5-8 8-8s3-8 8-8M12 12c3 0 3 8 8 8M4 4h3M17 20h3" />,
  /* casos da sua empresa: prédio */
  <path key="b" pathLength={1} d="M5 21V4h9v17M14 9h5v12M3 21h18M8 8h3M8 12h3M8 16h3" />,
  /* uso responsável: escudo */
  <path key="c" pathLength={1} d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6zM9 12l2.2 2.2L15 10" />,
  /* mão na massa: ferramenta */
  <path key="d" pathLength={1} d="M14.5 5.5a4 4 0 0 0 4.6 5.2L9.7 20.1a2 2 0 0 1-2.8-2.8l9.4-9.4A4 4 0 0 0 14.5 5.5z" />,
];

function LineIcon({ index }: { index: number }) {
  return <svg {...base} className={s.icon}>{ICONS[index % ICONS.length]}</svg>;
}

/* ---------- 3. "Ter acesso à IA não é saber trabalhar com ela." ---------- */

const TOOLS_RE = /(ChatGPT|Copilot|Gemini)/;

export function AcCapacity({ block }: { block: Of<"text"> }) {
  const ref = useRef<HTMLElement>(null);
  const armed = useArmed();
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start 75%", "end 35%"] });
  /* os nomes perdem o foco, um depois do outro */
  const t0 = useTransform(p, [0.22, 0.42], [1, 0.28]);
  const t1 = useTransform(p, [0.3, 0.5], [1, 0.28]);
  const t2 = useTransform(p, [0.38, 0.58], [1, 0.28]);
  const tools = [t0, t1, t2];
  const sign = useTransform(p, [0.5, 0.72], [0.35, 1]);
  const line = useTransform(p, [0.66, 0.9], [0, 1]);
  const word = block.highlightAccent ?? "";
  const hl = block.highlight?.join(" ") ?? "";
  const at = word ? hl.indexOf(word) : -1;
  const para = block.paragraphs?.[0] ?? "";
  return (
    <LazyMotion features={domAnimation}>
      <section ref={ref} className={`${prod.section} ${s.cap}`} data-state="cap">
        <div className={prod.wrap}>
          {block.eyebrow && <Legend>{block.eyebrow}</Legend>}
          <div className={s.capTop}>
            <h2>{block.title.join(" ")}</h2>
            <p className={s.capText}>
              {para.split(TOOLS_RE).map((part, i) =>
                TOOLS_RE.test(part)
                  ? <m.span key={i} className={s.tool} style={armed ? { opacity: tools[(i - 1) / 2] } : undefined}>{part}</m.span>
                  : part)}
            </p>
          </div>
        </div>
        <div className={s.capBand}>
          <div className={prod.wrap}>
              <m.p className={s.capSign} style={armed ? { opacity: sign } : undefined}>
                {at < 0 ? hl : (
                  <>
                    {hl.slice(0, at)}
                    <span className={s.capWord}>
                      <em>{word}</em>
                      <svg viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                        <m.path d="M1 4C20 1.5 45 1 99 3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ pathLength: armed ? line : 1 }} />
                      </svg>
                    </span>
                    {hl.slice(at + word.length)}
                  </>
                )}
              </m.p>
          </div>
        </div>
      </section>
    </LazyMotion>
  );
}

/* ---------- 5. Formatos ---------- */

type Format = Of<"formats">["items"][number];

function Block2Bg({ src, alt, width, height }: { src: string; alt: string; width: number; height: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const armed = useArmed();
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(p, [0, 1], [-18, 18]);
  return (
    <div ref={ref} className={s.bg} aria-hidden="true">
      <m.div className={s.bgInner} style={armed ? { y } : undefined}>
        <Image src={src} alt={alt} width={width} height={height} sizes="(max-width: 900px) 100vw, 1100px" loading="lazy" />
      </m.div>
    </div>
  );
}

export function AcFormats({ block }: { block: Of<"formats"> }) {
  const armed = useArmed();
  return (
    <LazyMotion features={domAnimation}>
      <section className={`${prod.section} ${s.formats}`} data-state="formats">
        <div className={prod.wrap}>
          <Legend>{block.eyebrow}</Legend>
          <h2 className={prod.h2Wide}>{block.title.join(" ")}</h2>
          <ol className={s.blocks}>
            {block.items.map((item, i) => (
              <FormatBlock key={item.title} item={item} index={i} armed={armed} bg={i === 1 ? block.background : undefined} />
            ))}
          </ol>
        </div>
      </section>
    </LazyMotion>
  );
}

function FormatBlock({ item, index, armed, bg }: { item: Format; index: number; armed: boolean; bg?: Of<"formats">["background"] }) {
  const ref = useRef<HTMLLIElement>(null);
  const seen = useInView(ref, { once: true, margin: "0px 0px -18% 0px" });
  const dark = index === 1;
  return (
    <li ref={ref} className={`${s.block} ${dark ? s.dark : s.light}`} data-armed={armed ? "" : undefined} data-in={seen ? "" : undefined}>
      {bg && <Block2Bg {...bg} />}
      <div className={s.blockHead}>
        <span className={s.blockNum}>{String(index + 1).padStart(2, "0")}</span>
        <i className={s.blockRule} />
      </div>
      <div className={s.blockGrid}>
        <div className={s.blockMain}>
          <h3>{item.title}</h3>
          <p className={s.audience}><Rich text={item.audience} /></p>
          <Link className={item.ctaStyle === "primary" ? home.primaryButton : home.secondaryButton} href={item.cta.href}>
            {item.cta.label} <ArrowRight />
          </Link>
        </div>
        <i className={s.vrule} />
        <div className={s.blockSide}>
          <p className={s.lede}>{item.text}</p>
          {item.features && (
            <ul className={s.feats}>
              {item.features.map((f, k) => (
                <li key={f.title} style={{ "--k": k } as React.CSSProperties}>
                  <LineIcon index={k} />
                  <strong>{f.title}</strong>
                  <span>{f.text}</span>
                </li>
              ))}
            </ul>
          )}
          {item.extra && <p className={s.extra}>{item.extra}</p>}
          <p className={s.foot}>{item.support}</p>
        </div>
      </div>
    </li>
  );
}

/* ---------- 7. Fechamento ---------- */

export function AcClosing({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const armed = useArmed();
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start 85%", "end 50%"] });
  const one = useTransform(p, [0.1, 0.45], [1, 0.45]);
  const two = useTransform(p, [0.2, 0.55], [0.5, 1]);
  const gold = useTransform(p, [0.55, 0.85], [0.25, 1]);
  const line = useTransform(p, [0.7, 1], [0, 1]);
  const cut = text.indexOf(". ") + 1;
  const first = cut > 0 ? text.slice(0, cut) : text;
  const rest = cut > 0 ? text.slice(cut + 1) : "";
  const wi = rest.lastIndexOf(" ");
  const lead = wi < 0 ? "" : rest.slice(0, wi + 1);
  const last = wi < 0 ? rest : rest.slice(wi + 1);
  return (
    <LazyMotion features={domAnimation}>
      <p ref={ref} className={s.closeP}>
        <m.span className={s.closeOne} style={armed ? { opacity: one } : undefined}>{first}</m.span>{" "}
        <m.span className={s.closeTwo} style={armed ? { opacity: two } : undefined}>
          {lead}
          <m.span className={s.closeGold} style={armed ? { opacity: gold } : undefined}>
            {last}
            <svg viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true" focusable="false">
              <m.path d="M1 4C20 1.5 45 1 99 3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ pathLength: armed ? line : 1 }} />
            </svg>
          </m.span>
        </m.span>
      </p>
    </LazyMotion>
  );
}
