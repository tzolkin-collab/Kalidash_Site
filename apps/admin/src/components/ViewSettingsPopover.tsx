import { useEffect, useRef, useState } from 'react';
import { AppWindow, Columns3, PanelRight, SlidersHorizontal } from 'lucide-react';
import type { FontSize, OpenMode, ViewSettings } from '../lib/viewSettings';

type Props = {
  settings: ViewSettings;
  onChange: (patch: Partial<ViewSettings>) => void;
  onReset: () => void;
  /** As colunas só existem na Lista. */
  view: 'kanban' | 'table';
  editColumns: boolean;
  onToggleEditColumns: () => void;
};

const OPEN_MODES: { value: OpenMode; label: string; Icon: typeof PanelRight }[] = [
  { value: 'side', label: 'Painel lateral', Icon: PanelRight },
  { value: 'center', label: 'Popup central', Icon: AppWindow },
];

const FONT_SIZES: { value: FontSize; label: string; sample: string }[] = [
  { value: 'sm', label: 'Pequena', sample: '12px' },
  { value: 'md', label: 'Média', sample: '14px' },
  { value: 'lg', label: 'Grande', sample: '17px' },
];

/** Botão "Configurar visualização" e o popover pequeno que ele abre. */
export default function ViewSettingsPopover({ settings, onChange, onReset, view, editColumns, onToggleEditColumns }: Props) {
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

  const canEditColumns = view === 'table';

  return (
    <div className="vs" ref={ref}>
      <button
        type="button"
        className={`vs-trigger ${open || editColumns ? 'active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Configurar visualização"
      >
        <SlidersHorizontal size={16} />
      </button>

      {open && (
        <div className="vs-popover" role="dialog" aria-label="Configurar visualização">
          <div className="vs-title">Configurar visualização</div>

          <div className="vs-section">
            <div className="vs-label">Abrir oportunidade como</div>
            <div className="vs-seg" role="radiogroup" aria-label="Abrir oportunidade como">
              {OPEN_MODES.map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={settings.openMode === value}
                  className={`vs-seg-btn ${settings.openMode === value ? 'active' : ''}`}
                  onClick={() => onChange({ openMode: value })}
                >
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>
          </div>

          <div className="vs-section">
            <div className="vs-label">Tamanho da fonte</div>
            <div className="vs-seg" role="radiogroup" aria-label="Tamanho da fonte">
              {FONT_SIZES.map(({ value, label, sample }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={settings.fontSize === value}
                  className={`vs-seg-btn ${settings.fontSize === value ? 'active' : ''}`}
                  onClick={() => onChange({ fontSize: value })}
                >
                  <span style={{ fontSize: sample, lineHeight: 1 }}>Aa</span> {label}
                </button>
              ))}
            </div>
          </div>

          <div className="vs-section">
            <div className="vs-label">Colunas</div>
            <button
              type="button"
              className={`vs-toggle ${editColumns ? 'on' : ''}`}
              onClick={() => { onToggleEditColumns(); if (!editColumns) setOpen(false); }}
              disabled={!canEditColumns}
              aria-pressed={editColumns}
            >
              <span className="vs-toggle-text">
                <Columns3 size={14} /> Editar colunas
              </span>
              <span className="vs-switch" aria-hidden="true"><span className="vs-knob" /></span>
            </button>
            <div className="vs-hint">
              {canEditColumns
                ? 'Adicione ou remova colunas da Lista, inclusive campos personalizados.'
                : 'Disponível na Lista. Troque a visão para editar as colunas.'}
            </div>
          </div>

          <button type="button" className="vs-reset" onClick={onReset}>Restaurar padrão</button>
        </div>
      )}
    </div>
  );
}
