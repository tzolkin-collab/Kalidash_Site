"use client";

/* AI Culture (/treinamento-corporativo-ia): layout V3 e movimento de rolagem. Toda a copy vem de pages.ts e é só repartida em peças
 * (nenhuma palavra muda). Movimento: progresso de rolagem lido do retângulo do elemento e aplicado direto no estilo (opacity, transform e
 * traço do filete), como na Execução. Sem biblioteca: o framer-motion saiu desta página (ajuste 16 do vídeo da Carol: o código do
 * movimento pesava no TBT com CPU 4x). Nada nasce escondido: o estado "armado" só liga depois da hidratação e só sem movimento reduzido. */

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type SVGProps } from "react";
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

/* Equivalente ao useScroll({ offset: [start, end] }) + useTransform: p = 0 quando a borda de cima do elemento chega a `a` da altura da janela
 * (0..1) e p = 1 quando a borda de baixo chega a `b`. `apply` recebe p a cada quadro de rolagem e escreve o estilo direto (sem estado). */
function useScrollProgress<T extends HTMLElement>(armed: boolean, a: number, b: number, apply: (p: number) => void) {
  const ref = useRef<T>(null);
  const applyRef = useRef(apply);
  useEffect(() => {
    applyRef.current = apply;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el || !armed) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const span = vh * a - vh * b + r.height;
      applyRef.current(Math.min(1, Math.max(0, span > 0 ? (vh * a - r.top) / span : 0)));
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
  }, [armed, a, b]);
  return ref;
}
/* useTransform(p, [i0, i1], [o0, o1]): linear e preso nas pontas. */
const lerp = (p: number, i0: number, i1: number, o0: number, o1: number) => o0 + (o1 - o0) * Math.min(1, Math.max(0, (p - i0) / (i1 - i0)));
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
  const armed = useArmed();
  const toolEls = useRef<(HTMLSpanElement | null)[]>([]);
  const signEl = useRef<HTMLParagraphElement>(null);
  const lineEl = useRef<SVGPathElement>(null);
  /* start 75% / end 35%: os nomes perdem o foco um depois do outro, a assinatura firma e o filete se traça. */
  const ref = useScrollProgress<HTMLElement>(armed, 0.75, 0.35, (p) => {
    [0.22, 0.3, 0.38].forEach((s, i) => {
      const el = toolEls.current[i];
      if (el) el.style.opacity = String(lerp(p, s, s + 0.2, 1, 0.28));
    });
    if (signEl.current) signEl.current.style.opacity = String(lerp(p, 0.5, 0.72, 0.35, 1));
    if (lineEl.current) Object.assign(lineEl.current.style, { strokeDasharray: `${lerp(p, 0.66, 0.9, 0, 1)} 1`, strokeDashoffset: "0" });
  });
  const word = block.highlightAccent ?? "";
  const hl = block.highlight?.join(" ") ?? "";
  const at = word ? hl.indexOf(word) : -1;
  const para = block.paragraphs?.[0] ?? "";
  return (
    <section ref={ref} className={`${prod.section} ${s.cap}`} data-state="cap">
      <div className={prod.wrap}>
        {block.eyebrow && <Legend>{block.eyebrow}</Legend>}
        <div className={s.capTop}>
          <h2>{block.title.join(" ")}</h2>
          <p className={s.capText}>
            {para.split(TOOLS_RE).map((part, i) =>
              TOOLS_RE.test(part)
                ? <span key={i} ref={(el) => { toolEls.current[(i - 1) / 2] = el; }} className={s.tool}>{part}</span>
                : part)}
          </p>
        </div>
      </div>
      <div className={s.capBand}>
        <div className={prod.wrap}>
          <p ref={signEl} className={s.capSign}>
            {at < 0 ? hl : (
              <>
                {hl.slice(0, at)}
                <span className={s.capWord}>
                  <em>{word}</em>
                  <svg viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                    <path ref={lineEl} pathLength={1} d="M1 4C20 1.5 45 1 99 3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                  </svg>
                </span>
                {hl.slice(at + word.length)}
              </>
            )}
          </p>
        </div>
      </div>
    </section>
  );
}

/* ---------- 5. Formatos ---------- */

type Format = Of<"formats">["items"][number];

function Block2Bg({ src, alt, width, height, armed }: { src: string; alt: string; width: number; height: number; armed: boolean }) {
  const inner = useRef<HTMLDivElement>(null);
  /* start end / end start: o fundo desliza de -18 a 18 px com a rolagem. */
  const ref = useScrollProgress<HTMLDivElement>(armed, 1, 0, (p) => {
    if (inner.current) inner.current.style.transform = `translate3d(0, ${lerp(p, 0, 1, -18, 18).toFixed(2)}px, 0)`;
  });
  return (
    <div ref={ref} className={s.bg} aria-hidden="true">
      <div ref={inner} className={s.bgInner}>
        <Image src={src} alt={alt} width={width} height={height} sizes="(max-width: 900px) 100vw, 1100px" loading="lazy" />
      </div>
    </div>
  );
}

export function AcFormats({ block }: { block: Of<"formats"> }) {
  const armed = useArmed();
  return (
    <>
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
    </>
  );
}

function FormatBlock({ item, index, armed, bg }: { item: Format; index: number; armed: boolean; bg?: Of<"formats">["background"] }) {
  const ref = useRef<HTMLLIElement>(null);
  /* Entra uma vez, quando o bloco passa de 18% acima do pé da janela (o que o useInView com margin -18% fazia). */
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -18% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  const dark = index === 1;
  return (
    <li ref={ref} className={`${s.block} ${dark ? s.dark : s.light}`} data-armed={armed ? "" : undefined} data-in={seen ? "" : undefined}>
      {bg && <Block2Bg {...bg} armed={armed} />}
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
  const armed = useArmed();
  const oneEl = useRef<HTMLSpanElement>(null);
  const twoEl = useRef<HTMLSpanElement>(null);
  const goldEl = useRef<HTMLSpanElement>(null);
  const lineEl = useRef<SVGPathElement>(null);
  /* start 85% / end 50%: a primeira frase recua, a segunda firma, a palavra de ouro acende e o filete se traça. */
  const ref = useScrollProgress<HTMLParagraphElement>(armed, 0.85, 0.5, (p) => {
    if (oneEl.current) oneEl.current.style.opacity = String(lerp(p, 0.1, 0.45, 1, 0.45));
    if (twoEl.current) twoEl.current.style.opacity = String(lerp(p, 0.2, 0.55, 0.5, 1));
    if (goldEl.current) goldEl.current.style.opacity = String(lerp(p, 0.55, 0.85, 0.25, 1));
    if (lineEl.current) Object.assign(lineEl.current.style, { strokeDasharray: `${lerp(p, 0.7, 1, 0, 1)} 1`, strokeDashoffset: "0" });
  });
  const cut = text.indexOf(". ") + 1;
  const first = cut > 0 ? text.slice(0, cut) : text;
  const rest = cut > 0 ? text.slice(cut + 1) : "";
  const wi = rest.lastIndexOf(" ");
  const lead = wi < 0 ? "" : rest.slice(0, wi + 1);
  const last = wi < 0 ? rest : rest.slice(wi + 1);
  return (
    <p ref={ref} className={s.closeP}>
      <span ref={oneEl} className={s.closeOne}>{first}</span>{" "}
      <span ref={twoEl} className={s.closeTwo}>
        {lead}
        <span ref={goldEl} className={s.closeGold}>
          {last}
          <svg viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <path ref={lineEl} pathLength={1} d="M1 4C20 1.5 45 1 99 3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
        </span>
      </span>
    </p>
  );
}
