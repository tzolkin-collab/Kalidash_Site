import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, FlaskConical, Menu, Search, X } from 'lucide-react';
import type { Lifecycle } from '../domain';
import { LIFECYCLE_LABEL, LIFECYCLE_TONE } from '../lib/people';
import { useShell } from '../lib/shell';

// Peças de interface compartilhadas pelas páginas do admin.

type HeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: { label: string; to: string };
};

export function PageHeader({ title, subtitle, actions, back }: HeaderProps) {
  const { openMenu, navigate } = useShell();
  return (
    <header className="page-header">
      <div className="page-header-main">
        <button type="button" className="mobile-menu-btn" onClick={openMenu} aria-label="Abrir menu">
          <Menu size={24} />
        </button>
        <div>
          {back && (
            <button type="button" className="page-back" onClick={() => navigate(back.to)}>
              <ArrowLeft size={14} /> {back.label}
            </button>
          )}
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="page crm-scope crm-fs-md">{children}</div>;
}

type Tab<T extends string> = { id: T; label: string; count?: number };

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: Tab<T>[]; value: T; onChange: (id: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={value === t.id} className={`tab ${value === t.id ? 'active' : ''}`} onClick={() => onChange(t.id)}>
          {t.label}
          {t.count !== undefined && <span className="tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

export function Badge({ tone = 'neutral', children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return <span className={`badge badge-${tone}`} title={title}>{children}</span>;
}

export function LifecycleBadge({ value }: { value: Lifecycle }) {
  return <Badge tone={LIFECYCLE_TONE[value]}>{LIFECYCLE_LABEL[value]}</Badge>;
}

export function StatCard({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tone }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${tone ? `tone-${tone}` : ''}`}>{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

/** Aviso fixo nas telas que ainda usam dados de exemplo. */
export function SampleBanner({ phase, children }: { phase?: number; children?: ReactNode }) {
  return (
    <div className="sample-banner" role="note">
      <FlaskConical size={14} />
      <span>
        <strong>Dados de exemplo.</strong> {children ?? 'Esta tela ainda não tem API: nada aqui é gravado e recarregar a página restaura o exemplo.'}{' '}
        {phase !== undefined && <span className="text-muted">Ligação prevista na fase {phase} do plano.</span>}
      </span>
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-title">{title}</div>
      {children && <p className="empty-text">{children}</p>}
      {action}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="search-box">
      <Search size={14} className="text-muted" />
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}

type PagerProps = {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
};

export function Pagination({ page, pageSize, total, onPage, onPageSize }: PagerProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="pager">
      <span className="text-muted">{from}–{to} de {total}</span>
      <div className="pager-controls">
        <label className="pager-size">
          Por página
          <select className="select select-sm" value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}>
            {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button type="button" className="icon-btn" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Página anterior"><ChevronLeft size={16} /></button>
        <span className="text-muted">{page} / {pages}</span>
        <button type="button" className="icon-btn" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Próxima página"><ChevronRight size={16} /></button>
      </div>
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
      <span className="switch-knob" />
    </button>
  );
}

type PanelProps = {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

/** Painel lateral modal, para criar e editar sem sair da página. */
export function SidePanel({ title, subtitle, onClose, children, footer }: PanelProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="panel-overlay" onClick={onClose}>
      <aside className="panel-side crm-scope crm-fs-md" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className="panel-head">
          <div>
            <h2 className="panel-title">{title}</h2>
            {subtitle && <p className="panel-subtitle">{subtitle}</p>}
          </div>
          <button type="button" className="peek-icon-btn" onClick={onClose} title="Fechar (Esc)"><X size={18} /></button>
        </header>
        <div className="panel-body">{children}</div>
        {footer && <footer className="panel-foot">{footer}</footer>}
      </aside>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}
