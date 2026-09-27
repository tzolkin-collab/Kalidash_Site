import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import type { ColumnDef } from '../lib/columns';

type Props = {
  /** Colunas que ainda não estão visíveis. */
  hidden: ColumnDef[];
  onAdd: (id: string) => void;
  label?: string;
};

/** Botão "+" que abre a lista do que dá para acrescentar (do sistema e personalizados). */
export default function ColumnPicker({ hidden, onAdd, label = 'Adicionar coluna' }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const system = hidden.filter((c) => c.group === 'system');
  const custom = hidden.filter((c) => c.group === 'custom');

  const pick = (id: string) => {
    onAdd(id);
    setOpen(false);
  };

  return (
    <div className="colpicker" ref={ref}>
      <button type="button" className="colpicker-btn" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} title={label}>
        <Plus size={14} /> <span>{label}</span>
      </button>
      {open && (
        <div className="colpicker-menu" role="menu">
          {hidden.length === 0 && <div className="colpicker-empty">Todas as colunas já estão visíveis.</div>}
          {system.length > 0 && <div className="colpicker-group">Do sistema</div>}
          {system.map((c) => (
            <button key={c.id} type="button" role="menuitem" className="colpicker-item" onClick={() => pick(c.id)}>{c.label}</button>
          ))}
          <div className="colpicker-group">Personalizados</div>
          {custom.length === 0 && <div className="colpicker-empty">Nenhum campo personalizado ainda. Os campos guardados em jsonb aparecem aqui quando a API os enviar.</div>}
          {custom.map((c) => (
            <button key={c.id} type="button" role="menuitem" className="colpicker-item" onClick={() => pick(c.id)}>{c.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
