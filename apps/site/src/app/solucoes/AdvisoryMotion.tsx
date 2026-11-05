"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cubicBezier, inView } from "framer-motion";
import v3 from "./advisory-v3.module.css";
import m from "./advisory-motion.module.css";

/* Movimento da Advisory. Método do tzolkin.cloud (ver docs/po/relatorios/motion-estudo-advisory.md): um progresso 0..1 por palco,
 * vindo de useScroll, vira variáveis CSS no próprio elemento; o CSS lê as variáveis (só transform e opacity; traço por pathLength).
 * Sem JS, com movimento reduzido ou em tela pequena (`live` desligado) nada é escondido: tudo aparece empilhado e completo.
 * O estado "armado" (data-arm) só existe depois da hidratação e só se o visitante não pediu movimento reduzido. */

const SETTLE = cubicBezier(0.33, 1, 0.68, 1);
const c = (v: number) => Math.min(1, Math.max(0, v));
const seg = (p: number, a: number, b: number) => c((p - a) / (b - a));

/* live = palco preso (1024+ de largura, 600+ de altura, sem movimento reduzido); armed = pode esconder para revelar. */
export function useMotionMode() {
  const [mode, setMode] = useState({ live: false, armed: false });
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const wide = window.matchMedia("(min-width: 1024px) and (min-height: 600px)");
    const sync = () => setMode({ armed: !reduce.matches, live: wide.matches && !reduce.matches });
    sync();
    wide.addEventListener("change", sync);
    reduce.addEventListener("change", sync);
    return () => {
      wide.removeEventListener("change", sync);
      reduce.removeEventListener("change", sync);
    };
  }, []);
  return mode;
}

/* Revela [data-r] ao entrar na tela (data-in, fica) e liga os laços lentos só enquanto visível (data-run). */
function useReveal(root: React.RefObject<HTMLElement | null>, armed: boolean) {
  useEffect(() => {
    const el = root.current;
    if (!el || !armed) return;
    const stops = [...el.querySelectorAll<HTMLElement>("[data-r]")].map((t) =>
      inView(
        t,
        () => {
          t.setAttribute("data-in", "");
          t.setAttribute("data-run", "");
          return () => t.removeAttribute("data-run");
        },
        { amount: 0.2, margin: "0px 0px -8% 0px" },
      ),
    );
    return () => stops.forEach((s) => s());
  }, [root, armed]);
}

/* Palco preso: devolve o ref do wrapper e chama `apply(p, el)` a cada quadro de rolagem (p = quanto do palco já foi percorrido, 0..1).
 * Medido direto do retângulo do wrapper, como StepsPin e BuildStory: não depende de a ref existir na primeira renderização. */
function useStage(live: boolean, apply: (p: number, el: HTMLElement) => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!live || !el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const run = rect.height - window.innerHeight;
      apply(run > 0 ? c(-rect.top / run) : 0, el);
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
      if (frame) cancelAnimationFrame(frame);
    };
  }, [live, apply]);
  return ref;
}

/* ---------- Seção 2: "A estratégia foi definida. E agora?" ---------- */

const GOLD_LIGHT = "#c4a673";
const IMPERIAL = "#28183b";

function applyProblem(p: number, el: HTMLElement) {
  const set = (k: string, v: number) => el.style.setProperty(k, v.toFixed(4));
  /* Palco encurtado (260 -> 170 svh): a sequência é a mesma, em janelas de rolagem mais justas. A frase da fase final nunca fica
   * apagada sem nada legível ao redor: ao entrar, "Não entregamos um plano." já está inteira e "Acompanhamos…" parte de 70%. */
  set("--line", seg(p, 0.05, 0.44));
  for (let i = 0; i < 4; i++) set(`--e${i}`, seg(p, 0.07 + i * 0.1, 0.15 + i * 0.1));
  const s = seg(p, 0.46, 0.62);
  set("--s", SETTLE(s));
  set("--soft", p < 0.78 ? seg(p, 0.52, 0.6) : 1 - 0.45 * seg(p, 0.78, 0.84));
  set("--strong", 0.7 + 0.3 * seg(p, 0.7, 0.84));
  set("--gold", seg(p, 0.84, 0.9));
  set("--sig", seg(p, 0.66, 0.9));
  for (let i = 0; i < 4; i++) set(`--m${i}`, seg(p, 0.85 + i * 0.03, 0.9 + i * 0.03));
  set("--mline", seg(p, 0.85, 0.99));
  const dark = s > 0.5;
  const phase = dark ? "dark" : "light";
  if (el.dataset.phase === phase) return;
  el.dataset.phase = phase;
  /* Camada escondida fora do alcance de teclado e leitor de tela (como o ApplicationsMethodStory). */
  const a = el.querySelector<HTMLElement>('[data-layer="a"]');
  const b = el.querySelector<HTMLElement>('[data-layer="b"]');
  a?.toggleAttribute("inert", dark);
  a?.setAttribute("aria-hidden", String(dark));
  b?.toggleAttribute("inert", !dark);
  b?.setAttribute("aria-hidden", String(!dark));
  /* O capítulo inteiro acompanha o fundo: faixa atrás do cabeçalho, rótulo "nº / total" e tom do cabeçalho (sem editar HeaderTone). */
  const ch = el.closest<HTMLElement>('[data-motion="curtain"]');
  if (ch) {
    if (dark) {
      ch.style.background = IMPERIAL;
      ch.style.setProperty("--lbl-bg", IMPERIAL);
      ch.style.setProperty("--lbl-fg", GOLD_LIGHT);
    } else {
      ch.style.removeProperty("background");
      ch.style.removeProperty("--lbl-bg");
      ch.style.removeProperty("--lbl-fg");
    }
  }
  document.documentElement.dataset.headerTone = dark ? "dark" : "light";
}

export function ProblemStage({ a, b, soft }: { a: ReactNode; b: ReactNode; soft: boolean }) {
  const { live, armed } = useMotionMode();
  const ref = useStage(live, applyProblem);
  useReveal(ref, armed && !live);
  /* Ao sair do modo palco, devolve o capítulo ao estado de origem. */
  useEffect(() => {
    if (live) return;
    const ch = ref.current?.closest<HTMLElement>('[data-motion="curtain"]');
    ch?.style.removeProperty("background");
    ch?.style.removeProperty("--lbl-bg");
    ch?.style.removeProperty("--lbl-fg");
  }, [live, ref]);
  return (
    <div ref={ref} className={`${m.advStory} ${soft ? m.soft : ""}`} data-live={live ? "" : undefined} data-arm={armed ? "" : undefined} data-phase="light" data-stage="problem">
      <div className={m.stick}>
        <div className={m.layA} data-layer="a">{a}</div>
        <div className={m.layB} data-layer="b" data-tone="dark">{b}</div>
      </div>
    </div>
  );
}

/* ---------- Seção 3: liderança ---------- */

const ROMAN = ["I", "II", "III", "IV", "V"];

function Pentagon({ active }: { active: number }) {
  const cx = 150;
  const cy = 142;
  const r = 100;
  const pts = ROMAN.map((_, k) => {
    const ang = ((-90 + 72 * k) * Math.PI) / 180;
    return { x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang), lx: cx + (r + 24) * Math.cos(ang), ly: cy + (r + 24) * Math.sin(ang) + 4 };
  });
  const poly = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const gold = active < 0 ? 0 : active >= 4 ? 1 : active / 5;
  return (
    <svg className={`${v3.avPentagon} ${m.pent}`} viewBox="0 0 300 290" fill="none" aria-hidden="true" focusable="false" style={{ "--pg": gold } as CSSProperties} data-all={active >= 4 ? "" : undefined}>
      <circle className={m.ring} pathLength={1} cx={cx} cy={cy} r={r + 8} stroke="currentColor" strokeWidth="0.8" opacity="0.35" />
      {pts.map((p, k) => (
        <line key={k} className={m.ring} pathLength={1} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
      ))}
      <polygon className={`${m.ring} ${m.polyBase}`} pathLength={1} points={poly} strokeWidth="1.4" strokeLinejoin="round" />
      <polygon className={m.polyGold} pathLength={1} points={poly} strokeWidth="1.6" strokeLinejoin="round" />
      {pts.map((p, k) => (
        <line key={k} className={m.spoke} pathLength={1} x1={cx} y1={cy} x2={p.x} y2={p.y} strokeWidth="1.6" strokeLinecap="round" data-on={k === active ? "" : undefined} />
      ))}
      <circle className={m.hub} cx={cx} cy={cy} r="4.5" fill="currentColor" />
      {pts.map((p, k) => (
        <g key={k}>
          <circle className={m.vertex} cx={p.x} cy={p.y} r="3.2" data-on={k === active || (active >= 4) ? "" : undefined} />
          <text x={p.lx} y={p.ly} textAnchor="middle" className={`${v3.avRoman} ${m.roman}`} data-on={k === active ? "" : undefined}>{ROMAN[k]}</text>
        </g>
      ))}
    </svg>
  );
}

export function LeadStage({ intro, items, soft }: { intro: ReactNode; items: { text: string; icon: ReactNode }[]; soft: boolean }) {
  const { live, armed } = useMotionMode();
  const [scrollActive, setScrollActive] = useState(-1);
  const [hover, setHover] = useState<number | null>(null);
  const [sel, setSel] = useState(-1);
  const n = items.length;
  const apply = useRef((p: number, el: HTMLElement) => {
    el.style.setProperty("--draw", seg(p, 0.0, 0.12).toFixed(4));
    const idx = p < 0.14 ? -1 : Math.min(n - 1, Math.floor(seg(p, 0.14, 0.98) * n));
    setScrollActive((prev) => (prev === idx ? prev : idx));
  });
  const ref = useStage(live, apply.current);
  useReveal(ref, armed && !live);
  /* Fora do palco o desenho do pentágono entra quando ele aparece na tela. */
  const figRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const fig = figRef.current;
    if (!fig || !armed || live) return;
    return inView(fig, () => void ref.current?.style.setProperty("--draw", "1"), { amount: 0.4 });
  }, [armed, live, ref]);

  const active = hover ?? (live ? scrollActive : sel);
  const goTo = (i: number) => {
    const el = ref.current;
    if (!el || !live) return setSel(i);
    const run = el.offsetHeight - window.innerHeight;
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + run * (0.14 + 0.84 * ((i + 0.5) / n)), behavior: "smooth" });
  };

  return (
    <div ref={ref} className={`${m.advStory} ${m.lead} ${soft ? m.soft : ""}`} data-live={live ? "" : undefined} data-arm={armed ? "" : undefined} data-stage="lead">
      <div className={m.stick}>
        <section className={`${v3.avLead} ${m.leadSection}`}>
          <div className={`${v3.wrap} ${v3.avLeadGrid}`}>
            <div className={v3.avLeadIntro}>
              {intro}
              <figure ref={figRef} className={v3.avPentFig} aria-hidden="true"><Pentagon active={active} /></figure>
            </div>
            <ol className={`${v3.avItems} ${m.items}`}>
              {items.map((it, i) => (
                <li key={it.text} data-r="" style={{ "--i": i } as CSSProperties} data-drawn={live ? (i <= scrollActive ? "" : undefined) : undefined}>
                  <button
                    type="button"
                    className={m.itemBtn}
                    aria-pressed={active === i}
                    data-on={active === i ? "" : undefined}
                    onPointerEnter={(e) => e.pointerType === "mouse" && setHover(i)}
                    onPointerLeave={() => setHover(null)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    onClick={() => goTo(i)}
                  >
                    <span className={v3.avRomanNum} aria-hidden="true">{ROMAN[i]}</span>
                    <span className={v3.avItemText}>{it.text}</span>
                    <span className={m.icon}>{it.icon}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ---------- Seções sem palco (rituais, critérios, fecho): revela [data-r] ao entrar na tela ---------- */

export function MotionRoot({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { armed } = useMotionMode();
  const ref = useRef<HTMLDivElement>(null);
  useReveal(ref, armed);
  return (
    <div ref={ref} className={`${m.root} ${className}`} data-arm={armed ? "" : undefined}>
      {children}
    </div>
  );
}

/* ---------- Seção 1: filete em arco da abertura ---------- */

/* Filete ouro fino que contorna o arco da foto, um pouco dentro dela (a foto fica recortada pelo arco, então o traço vive no mesmo
 * quadro). Medido no cliente; traçado por pathLength depois da entrada. Decorativo: sem JS não existe e nada falta. */
export function HeroArc() {
  const ref = useRef<SVGSVGElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const host = ref.current?.parentElement;
    if (!host) return;
    const read = () => setBox({ w: host.offsetWidth, h: host.offsetHeight });
    read();
    const ro = new ResizeObserver(read);
    ro.observe(host);
    return () => ro.disconnect();
  }, []);
  const inset = 14;
  const w = box ? box.w - inset * 2 : 0;
  const h = box ? box.h - inset * 2 : 0;
  const r = w / 2;
  return (
    <svg ref={ref} className={m.arc} width={box?.w ?? 0} height={box?.h ?? 0} viewBox={`0 0 ${box?.w ?? 0} ${box?.h ?? 0}`} fill="none" aria-hidden="true" focusable="false">
      {box && (
        <path pathLength={1} d={`M ${inset} ${inset + h} V ${inset + r} A ${r} ${r} 0 0 1 ${inset + w} ${inset + r} V ${inset + h}`} stroke="#c4a673" strokeWidth="1" strokeLinecap="round" />
      )}
    </svg>
  );
}

/* ---------- Seção 7: perguntas (abertura com altura por grid-template-rows) ---------- */

type Qa = { q: string; a: string };

function FaqItem({ item, armed }: { item: Qa; armed: boolean }) {
  const [open, setOpen] = useState(false); /* atributo [open] do <details>: fica ligado enquanto fecha */
  const [rows, setRows] = useState(false); /* 1fr / 0fr */
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    clearTimeout(timer.current);
    if (!rows) {
      setOpen(true);
      if (!armed) return setRows(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setRows(true)));
    } else {
      setRows(false);
      if (!armed) return setOpen(false);
      timer.current = setTimeout(() => setOpen(false), 420);
    }
  };
  return (
    <details open={open} className={m.faqItem} data-s={rows ? "open" : "closed"} data-arm={armed ? "" : undefined}>
      <summary onClick={toggle} aria-expanded={rows}>{item.q}</summary>
      <div className={m.faqBody}>
        <div className={m.faqInner}>
          <p>{item.a}</p>
        </div>
      </div>
    </details>
  );
}

export function FaqList({ items, className }: { items: Qa[]; className?: string }) {
  const { armed } = useMotionMode();
  return (
    <div className={className}>
      {items.map((it) => (
        <FaqItem key={it.q} item={it} armed={armed} />
      ))}
    </div>
  );
}

/* ---------- Seção 8: fechamento ---------- */

/* Nuvens com deslocamento vertical leve ligado à rolagem (só transform). */
export function ClosingBg({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    const host = el?.parentElement;
    if (!el || !host || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const r = host.getBoundingClientRect();
      const t = c((window.innerHeight - r.top) / (window.innerHeight + r.height));
      el.style.transform = `translate3d(0, ${((0.5 - t) * 64).toFixed(1)}px, 0) scale(1.14)`;
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
      if (frame) cancelAnimationFrame(frame);
      el.style.transform = "";
    };
  }, []);
  return (
    <div ref={ref} className={className} aria-hidden="true">
      {children}
    </div>
  );
}

/* A frase entra por linhas (uma por sentença) e a última palavra, em ouro, por último. O texto e a ordem das palavras não mudam. */
export function ClosingText({ text, goldClass }: { text: string; goldClass: string }) {
  const lines = text.split(/(?<=\.)\s+/);
  const last = lines.length - 1;
  const cut = lines[last].lastIndexOf(" ");
  return (
    <MotionRoot>
      <p>
        {lines.map((line, i) => (
          <span key={i} className={m.line} data-r="" style={{ "--i": i } as CSSProperties}>
            {i === last && cut > 0 ? (
              <>
                {line.slice(0, cut + 1)}
                <span className={`${goldClass} ${m.goldWord}`} data-r="" style={{ "--i": lines.length + 1 } as CSSProperties}>{line.slice(cut + 1)}</span>
              </>
            ) : (
              line
            )}
            {i < last ? " " : ""}
          </span>
        ))}
      </p>
    </MotionRoot>
  );
}
