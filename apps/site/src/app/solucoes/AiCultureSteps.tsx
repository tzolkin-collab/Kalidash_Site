/* AI Culture, seção 4 (método): mesma faixa de Execução (StepsPin), com a frase final em dois tempos. Componente de servidor, sem
 * biblioteca de movimento: o progresso --p vem do StepsPin (herdado) e o CSS faz o resto. A copy só é repartida, não muda. */
import type { Block } from "../institucional/pages";
import { Legend } from "./ProductPage";
import prod from "./product.module.css";
import s from "./ai-culture-motion.module.css";

type Of<T extends Block["type"]> = Extract<Block, { type: T }>;

function Rich({ text }: { text: string }) {
  return <>{text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))}</>;
}

export function AcSteps({ block }: { block: Of<"steps"> }) {
  const [a, b] = (block.closing?.[0] ?? "").replace(/\*\*/g, "").split(/(?<=\.) /);
  return (
    <section className={`${prod.steps} ${s.method}`}>
      <div className={prod.wrap}>
        {block.eyebrow && <Legend>{block.eyebrow}</Legend>}
        <h2 className={prod.h2Wide}>{block.title.join(" ")}</h2>
        <ol className={prod.sequence} style={{ "--n": Math.min(4, block.items.length) } as React.CSSProperties}>
          {block.items.map((item, i) => (
            <li key={item.title}>
              <span className={prod.stepNum}>{String(i + 1).padStart(2, "0")}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </li>
          ))}
        </ol>
        {block.closing && (
          <div className={`${prod.stepsNote} ${s.end}`}>
            <p className={s.endLine}>
              <strong><span className={s.endOne}>{a}</span> <span className={s.endTwo}>{b}</span></strong>
            </p>
            {block.closing[1] && <p className={s.endSub}><Rich text={block.closing[1]} /></p>}
          </div>
        )}
      </div>
    </section>
  );
}

