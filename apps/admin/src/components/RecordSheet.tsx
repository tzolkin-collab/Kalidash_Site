import { AppWindow, PanelRight, X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { FontSize, OpenMode } from '../lib/viewSettings';
import Peek from './Peek';
import { EditableTitle } from './fields';

export type SheetTab = { id: string; label: string; count?: number };

type Props = {
  mode: OpenMode;
  fontSize: FontSize;
  onClose: () => void;
  onSwitchMode: () => void;
  title: string;
  onTitle: (value: string) => void;
  /** Selos ao lado do título (ciclo de vida, arquivado…). */
  badges?: ReactNode;
  subtitle?: ReactNode;
  /** Botões extras na barra de cima (arquivar, ações). */
  actions?: ReactNode;
  tabs: SheetTab[];
  tab: string;
  onTab: (id: string) => void;
  children: ReactNode;
  footer?: ReactNode;
};

/** Ficha de qualquer registro: painel lateral ou popup, título editável, abas e rodapé de ações. */
export default function RecordSheet({ mode, fontSize, onClose, onSwitchMode, title, onTitle, badges, subtitle, actions, tabs, tab, onTab, children, footer }: Props) {
  return (
    <Peek mode={mode} fontSize={fontSize} onClose={onClose}>
      <div className="peek-detail">
        <div className="peek-topbar">
          {actions}
          <button type="button" className="peek-icon-btn" onClick={onSwitchMode} title={mode === 'side' ? 'Abrir como popup central' : 'Abrir como painel lateral'}>
            {mode === 'side' ? <AppWindow size={16} /> : <PanelRight size={16} />}
          </button>
          <button type="button" className="peek-icon-btn" onClick={onClose} title="Fechar (Esc)"><X size={18} /></button>
        </div>

        <div className="peek-scroll">
          <header className="peek-header">
            <EditableTitle value={title} onCommit={onTitle} />
            {(badges || subtitle) && (
              <div className="sheet-sub">
                {badges}
                {subtitle && <span className="text-sm text-muted">{subtitle}</span>}
              </div>
            )}
          </header>

          <nav className="peek-tabs" role="tablist" style={{ marginTop: '8px' }}>
            {tabs.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`peek-tab ${tab === t.id ? 'active' : ''}`} onClick={() => onTab(t.id)}>
                {t.label}
                {t.count !== undefined && t.count > 0 && <span className="tab-count">{t.count}</span>}
              </button>
            ))}
          </nav>

          <div className="peek-tabpanel" role="tabpanel">{children}</div>
        </div>

        {footer && <footer className="peek-footer sheet-footer">{footer}</footer>}
      </div>
    </Peek>
  );
}
