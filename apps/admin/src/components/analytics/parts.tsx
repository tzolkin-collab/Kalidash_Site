import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';

/** Cartão de relatório: título, uma visualização e o caminho para o relatório completo. */
export function Card({ title, note, children, action, onAction, span }: { title: string; note?: string; children: ReactNode; action?: string; onAction?: () => void; span?: 'half' }) {
  return (
    <section className="an-card" data-span={span}>
      <header>
        <h2>{title}</h2>
        {note && <p>{note}</p>}
      </header>
      <div className="an-card-body">{children}</div>
      {action && onAction && (
        <footer><button type="button" className="an-link" onClick={onAction}>{action} <ArrowRight size={14} /></button></footer>
      )}
    </section>
  );
}

export type BarRow = { key: string; label: string; sub?: string; value: number; display: string; icon?: ReactNode };

/** Ranking em barras horizontais: rótulo, barra proporcional ao maior e o valor escrito. */
export function BarList({ rows, head, empty, picked, onPick }: { rows: BarRow[]; head?: [string, string]; empty: string; picked?: string; onPick?: (key: string) => void }) {
  if (!rows.length) return <p className="an-none">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value), 0);
  return (
    <div className="an-bars">
      {head && <div className="an-bars-head"><span>{head[0]}</span><span>{head[1]}</span></div>}
      <ul>
        {rows.map((r) => {
          const inner = (
            <>
              <span className="an-bar-label" title={r.label}>{r.icon}<span className="an-bar-text">{r.label}{r.sub && <small>{r.sub}</small>}</span></span>
              <span className="an-bar-value">{r.display}</span>
              <span className="an-bar-track" aria-hidden><span style={{ width: max ? `${(r.value / max) * 100}%` : 0 }} /></span>
            </>
          );
          return (
            <li key={r.key}>
              {onPick
                ? <button type="button" className="an-bar" aria-pressed={picked === r.key} onClick={() => onPick(r.key)}>{inner}</button>
                : <div className="an-bar">{inner}</div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange, label }: { options: { id: T; label: string }[]; value: T; onChange: (id: T) => void; label: string }) {
  return (
    <div className="an-seg" role="group" aria-label={label}>
      {options.map((o) => <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>{o.label}</button>)}
    </div>
  );
}

export function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="an-section">
      <header className="an-section-head">
        <h2>{title}</h2>
        {note && <p>{note}</p>}
      </header>
      {children}
    </section>
  );
}
