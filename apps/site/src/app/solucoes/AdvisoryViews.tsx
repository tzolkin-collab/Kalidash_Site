import type { SVGProps } from "react";
import type { Block } from "../institucional/pages";
import { Legend } from "./ProductPage";
import styles from "./advisory-v3.module.css";
import { FaqList, LeadStage, MotionRoot, ProblemStage } from "./AdvisoryMotion";
import prod from "./product.module.css";
import mo from "./advisory-motion.module.css";
import { markArts } from "./MarkArt";

/* Seções da Advisory no desenho V3 (Ajustes V3, itens V2 a V4). Todo o texto vem de pages.ts e é só repartido em peças
 * (nenhuma string nova): a ordem de leitura e os níveis mudam, a copy não. Numerais romanos, numerais 01-04 e ícones são desenho.
 * Cada função devolve só o miolo; o capítulo (cortina, rótulo "nº / total", surge) continua sendo montado pelo KitPage. */

type Of<T extends Block["type"]> = Extract<Block, { type: T }>;

/* ---------- Destaque por sentido ---------- */

/* A palavra escolhida em itálico dourado. Sem `word` (ou se ela não existir na frase), devolve o texto como está. */
export function Accent({ text, word, className }: { text: string; word?: string; className: string }) {
  const i = word ? text.indexOf(word) : -1;
  if (!word || i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <em className={className}>{word}</em>
      {text.slice(i + word.length)}
    </>
  );
}

function Rich({ text }: { text: string }) {
  return <>{text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))}</>;
}

/* ---------- Ícones de linha (24×24, traço 1.5, herdam a cor) ---------- */

const base: SVGProps<SVGSVGElement> = {
  viewBox: "0 0 24 24",
  width: 24,
  height: 24,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
};

const I = {
  search: (p: SVGProps<SVGSVGElement>) => (<svg {...base} {...p}><circle pathLength={1} cx="10.5" cy="10.5" r="6" /><path pathLength={1} d="m15 15 5.5 5.5M8 10.5h5M10.5 8v5" /></svg>),
  structure: (p: SVGProps<SVGSVGElement>) => (<svg {...base} {...p}><rect pathLength={1} x="9" y="3" width="6" height="5" rx="1" /><rect pathLength={1} x="3" y="16" width="6" height="5" rx="1" /><rect pathLength={1} x="15" y="16" width="6" height="5" rx="1" /><path pathLength={1} d="M12 8v4M6 16v-4h12v4" /></svg>),
  bars: (p: SVGProps<SVGSVGElement>) => (<svg {...base} {...p}><path pathLength={1} d="M4 20h16M7 20v-7M12 20V6M17 20v-10" /></svg>),
  signal: (p: SVGProps<SVGSVGElement>) => (<svg {...base} {...p}><circle pathLength={1} cx="12" cy="9" r="1.6" /><path pathLength={1} d="M12 10.6V21M8.2 5.6a5.2 5.2 0 0 0 0 6.8M15.8 5.6a5.2 5.2 0 0 1 0 6.8M5.6 3.4a8.6 8.6 0 0 0 0 11.2M18.4 3.4a8.6 8.6 0 0 1 0 11.2" /></svg>),
  nodes: (p: SVGProps<SVGSVGElement>) => (<svg {...base} {...p}><circle pathLength={1} cx="12" cy="12" r="2.4" /><circle pathLength={1} cx="5" cy="5.5" r="1.8" /><circle pathLength={1} cx="19" cy="5.5" r="1.8" /><circle pathLength={1} cx="5" cy="18.5" r="1.8" /><circle pathLength={1} cx="19" cy="18.5" r="1.8" /><path pathLength={1} d="m6.4 6.9 3.8 3.4M17.6 6.9l-3.8 3.4M6.4 17.1l3.8-3.4M17.6 17.1l-3.8-3.4" /></svg>),
  council: (p: SVGProps<SVGSVGElement>) => (<svg {...base} {...p}><circle pathLength={1} cx="12" cy="12" r="4.2" /><circle pathLength={1} cx="12" cy="3.6" r="1.5" /><circle pathLength={1} cx="20.2" cy="9.6" r="1.5" /><circle pathLength={1} cx="17" cy="19.4" r="1.5" /><circle pathLength={1} cx="7" cy="19.4" r="1.5" /><circle pathLength={1} cx="3.8" cy="9.6" r="1.5" /></svg>),
  trend: (p: SVGProps<SVGSVGElement>) => (<svg {...base} {...p}><path pathLength={1} d="M3 21h18M4 17l5-5 4 3 7-8" /><circle pathLength={1} cx="4" cy="17" r="1.2" /><circle pathLength={1} cx="9" cy="12" r="1.2" /><circle pathLength={1} cx="13" cy="15" r="1.2" /><circle pathLength={1} cx="20" cy="7" r="1.2" /></svg>),
  mentor: (p: SVGProps<SVGSVGElement>) => (<svg {...base} {...p}><circle pathLength={1} cx="9" cy="12" r="6" /><circle pathLength={1} cx="15" cy="12" r="6" /><circle pathLength={1} cx="12" cy="12" r="1" /></svg>),
  panel: (p: SVGProps<SVGSVGElement>) => (<svg {...base} {...p}><rect pathLength={1} x="3" y="4" width="18" height="16" rx="2" /><path pathLength={1} d="M7.5 16v-4M12 16V8.5M16.5 16v-6" /></svg>),
  report: (p: SVGProps<SVGSVGElement>) => (<svg {...base} {...p}><path pathLength={1} d="M6 3h8l4 4v14H6z" /><path pathLength={1} d="M14 3v4h4M9 12h6M9 15.5h6M9 8.5h2" /></svg>),
  stairs: (p: SVGProps<SVGSVGElement>) => (<svg {...base} {...p}><path pathLength={1} d="M3 20h4v-4h4v-4h4V8h4M17 4l3 4-3 0M20 8V4" /></svg>),
};

const leaderIcons = [I.search, I.structure, I.bars, I.signal, I.nodes];
/* Ícones vivos dos rituais (só se movem com o cartão visível; ver advisory-motion.module.css): o comitê reúne pontos em órbita,
 * o acompanhamento traça a tendência e o último ponto pulsa, a mentoria aproxima dois círculos até se cruzarem. */
const R = {
  council: (p: SVGProps<SVGSVGElement>) => (<svg {...base} {...p}><circle cx="12" cy="12" r="4.2" /><g className={mo.orbit}><circle cx="12" cy="3.6" r="1.5" /><circle cx="20.2" cy="9.6" r="1.5" /><circle cx="17" cy="19.4" r="1.5" /><circle cx="7" cy="19.4" r="1.5" /><circle cx="3.8" cy="9.6" r="1.5" /></g></svg>),
  trend: (p: SVGProps<SVGSVGElement>) => (<svg {...base} {...p}><path d="M3 21h18" /><path className={mo.trendLine} pathLength={1} d="M4 17l5-5 4 3 7-8" /><circle cx="4" cy="17" r="1.2" /><circle cx="9" cy="12" r="1.2" /><circle cx="13" cy="15" r="1.2" /><circle className={mo.pulse} cx="20" cy="7" r="1.2" /></svg>),
  mentor: (p: SVGProps<SVGSVGElement>) => (<svg {...base} {...p}><circle className={mo.cA} cx="9" cy="12" r="6" /><circle className={mo.cB} cx="15" cy="12" r="6" /><circle cx="12" cy="12" r="1" /></svg>),
};
const ritualIcons = [R.council, R.trend, R.mentor];
const receiveIcons = [I.panel, I.report, I.stairs];

/* ---------- V2 · "A estratégia foi definida. E agora?" ---------- */

/* Marca de linha (círculo, triângulo, ponto) no lugar do busto: ancora a assinatura sem competir com ela. */
function Sigil() {
  return (
    <svg className={styles.sigil} viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true" focusable="false">
      <circle pathLength={1} cx="60" cy="60" r="58" />
      <path pathLength={1} d="M60 24 94 84H26Z" />
      <circle pathLength={1} cx="60" cy="66" r="1.6" fill="currentColor" />
    </svg>
  );
}

/* Repartição da copy (sem mudar nenhuma palavra). Devolve null se a forma do texto não for a esperada: o KitPage cai no TextView. */
function splitProblem(block: Of<"text">) {
  const [p1, p2] = block.paragraphs ?? [];
  const hl = block.highlight?.join(" ");
  if (!p1 || !p2 || !hl) return null;
  const steps = p1.match(/:\s+(.+?)\.?$/)?.[1].split(/,\s+|\s+e\s+(?=[^,]+$)/);
  const dot = p2.indexOf(". ");
  const events = dot > 0 ? p2.slice(dot + 2).replace(/\.$/, "").split(/,\s+/) : null;
  const cut = hl.indexOf(". ");
  if (!steps || steps.length < 2 || !events || events.length < 2 || cut < 0) return null;
  return { p1, lead: p2.slice(0, dot + 1), events, steps, soft: hl.slice(0, cut + 1), strong: hl.slice(cut + 2) };
}

export function canProblem(block: Of<"text">) {
  return splitProblem(block) !== null;
}

export function ProblemView({ block, soft }: { block: Of<"text">; soft: boolean }) {
  const s = splitProblem(block)!;
  const title = block.title.join(" ");
  const top = (
    <section className={`${styles.avProblemTop}${soft ? ` ${styles.onSoft}` : ""}`}>
      <div className={styles.wrap}>
        {block.eyebrow && <Legend>{block.eyebrow}</Legend>}
        <div className={styles.avProblemHead}>
          <h2><Accent text={title} word={block.accent} className={styles.goldEm} /></h2>
          <div className={styles.avProblemText}>
            <p>{s.p1}</p>
            <p>{s.lead}</p>
          </div>
        </div>
        <ol className={styles.avEvents} data-part="events" data-r="line">
          {s.events.map((e, i) => (
            <li key={e} data-r="" style={{ "--i": i } as React.CSSProperties}><b className={styles.avEventNum} aria-hidden="true">{i + 1}.</b><span>{e}</span></li>
          ))}
        </ol>
      </div>
    </section>
  );
  const bottom = (
    <section className={styles.avProblemBottom}>
      <div className={styles.wrap}>
        <div className={styles.avSignature}>
          <p>
            <span className={styles.avSoft} data-part="soft">{s.soft}</span>
            <span className={styles.avStrong} data-part="strong">
              <Accent text={s.strong} word={block.highlightAccent} className={styles.goldEmDark} />
            </span>
          </p>
          <figure className={styles.avSigil} aria-hidden="true" data-part="sigil" data-r="sig"><Sigil /></figure>
        </div>
        <ol className={styles.avMarks} data-part="marks">
          {s.steps.map((step, i) => (
            <li key={step} data-r="" style={{ "--i": i } as React.CSSProperties}>
              {markArts[i] && (() => {
                const Art = markArts[i];
                return <figure className={styles.avMarkArt} aria-hidden="true"><Art /></figure>;
              })()}
              <span className={styles.avNum}>{String(i + 1).padStart(2, "0")}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
  /* Palco preso (desktop alto): a rolagem traça a linha, faz a troca Limestone para Imperial e acende a assinatura. Ver AdvisoryMotion. */
  return <ProblemStage a={top} b={bottom} soft={soft} />;
}

/* ---------- V3 · "Ajudamos sua liderança a decidir melhor sobre IA." ---------- */


export function LeadershipView({ block, soft }: { block: Of<"text">; soft: boolean }) {
  const title = block.title.join(" ");
  const intro = (
    <>
      {block.eyebrow && <Legend>{block.eyebrow}</Legend>}
      <h2><Accent text={title} word={block.accent} className={styles.goldEm} /></h2>
      {block.paragraphs?.map((p) => (<p key={p}><Rich text={p} /></p>))}
    </>
  );
  const items = (block.chips ?? []).map((chip, i) => {
    const Icon = leaderIcons[i % leaderIcons.length];
    return { text: chip, icon: <Icon className={styles.avIcon} /> };
  });
  return <LeadStage intro={intro} items={items} soft={soft} />;
}

/* ---------- V4 · "Três rituais que mantêm a IA na agenda da diretoria." ---------- */

/* "Descrição. Frase final." → a última frase (se houver mais de uma) vai para o pé do cartão, em itálico ouro. */
function splitFoot(text: string) {
  const m = text.match(/^(.+?[.!?])\s+([^.!?]+[.!?])$/);
  return m ? { body: m[1], foot: m[2] } : { body: text, foot: null as string | null };
}

export function RitualsView({ block }: { block: Of<"cards"> }) {
  const title = block.title.join(" ");
  const closing = block.closing?.[0];
  const label = closing?.match(/^\*\*(.+?)\*\*\s*(.*)$/);
  const gets = label ? label[2].split(/\s+·\s+/).map((g) => g.replace(/\.$/, "")) : null;
  return (
    <MotionRoot>
    <section className={styles.avRituals}>
      <div className={styles.wrap}>
        {block.eyebrow && <Legend>{block.eyebrow}</Legend>}
        <h2 className={styles.avRitualsTitle}><Accent text={title} word={block.accent} className={styles.goldEmDark} /></h2>
        <ul className={`${styles.avCards} ${mo.cards}`}>
          {block.items.map((item, i) => {
            const { body, foot } = item.foot && item.text.endsWith(item.foot)
              ? { body: item.text.slice(0, -item.foot.length).trim().replace(/[,;]$/, ""), foot: item.foot }
              : splitFoot(item.text);
            const Icon = ritualIcons[i % ritualIcons.length];
            return (
              <li key={item.title} data-r="" style={{ "--i": i } as React.CSSProperties}>
                <Icon className={styles.avCardIcon} width={40} height={40} strokeWidth={1.2} />
                <h3>{item.title}</h3>
                <p>{body}</p>
                {foot && <p className={`${styles.avCardFoot} ${mo.foot}`}>{foot}</p>}
              </li>
            );
          })}
        </ul>
        {label && gets && (
          <div className={`${styles.avReceive} ${mo.recv}`} data-r="" style={{ "--i": 4 } as React.CSSProperties}>
            <p className={styles.avReceiveLabel}>{label[1]}</p>
            <ul>
              {gets.map((g, i) => {
                const Icon = receiveIcons[i % receiveIcons.length];
                return (
                  <li key={g} style={{ "--j": i } as React.CSSProperties}>
                    <Icon className={styles.avIcon} />
                    <span>{g}{i === gets.length - 1 ? "." : ""}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
    </MotionRoot>
  );
}

/* ---------- Seção 7 · perguntas: mesmo desenho de sempre, com abertura animada (FaqList) e o mesmo JSON-LD FAQPage ---------- */

export function FaqView({ block, soft }: { block: Of<"faq">; soft: boolean }) {
  return (
    <section className={`${prod.section} ${prod.split}${soft ? ` ${prod.soft}` : ""}`}>
      <div className={`${prod.wrap} ${prod.splitGrid}`}>
        <header className={prod.sticky}>
          <h2>{block.title}</h2>
        </header>
        <FaqList className={prod.faq} items={block.items} />
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: block.items.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })),
          }).replace(/</g, "\\u003c"),
        }}
      />
    </section>
  );
}
