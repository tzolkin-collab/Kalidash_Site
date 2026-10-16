import { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { ArrowLeft, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, CircleHelp, FlaskConical, Menu, Search, X } from 'lucide-react';
import type { Lifecycle } from '../domain';
import { LIFECYCLE_LABEL, LIFECYCLE_TONE } from '../lib/people';
import { useShell } from '../lib/shell';
import { useViewSettings } from '../lib/viewSettings';
import Peek from './Peek';

import { Children, isValidElement } from 'react';

export function CustomSelect({ value, onChange, children, className = '', disabled, title, style, autoFocus, 'aria-label': ariaLabel }: { value: string; onChange: (e: { target: { value: string } }) => void; children: ReactNode; className?: string; disabled?: boolean; title?: string; style?: React.CSSProperties; autoFocus?: boolean; 'aria-label'?: string; }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (autoFocus) triggerRef.current?.focus(); }, []);

  const options: { value: string; label: string; disabled?: boolean }[] = [];

  // Um <option> com mais de um filho (ex.: {label} ({id})) chega aqui como array — "".toString()
  // nisso junta tudo com vírgula ("Rótulo, (,id,)"), não concatena. Percorre e junta de verdade.
  const flattenText = (node: ReactNode): string => {
    if (node === null || node === undefined || typeof node === 'boolean') return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(flattenText).join('');
    if (isValidElement(node)) return flattenText((node.props as { children?: ReactNode }).children);
    return '';
  };

  const extract = (nodes: ReactNode) => {
    Children.forEach(nodes, (child) => {
      if (!isValidElement(child)) return;
      if (child.type === 'option') {
        const props = child.props as { value?: unknown; children?: ReactNode; disabled?: boolean };
        options.push({
          value: String(props.value ?? flattenText(props.children)),
          label: flattenText(props.children),
          disabled: props.disabled,
        });
      } else if (child.props && (child.props as { children?: ReactNode }).children) {
        extract((child.props as { children?: ReactNode }).children);
      }
    });
  };
  extract(children);

  const selected = options.find((o) => o.value === String(value));

  return (
    <div className={`custom-select-wrapper ${className}`} ref={ref} title={title} style={style} aria-label={ariaLabel}>
      <button ref={triggerRef} type="button" className={`custom-select-trigger ${open ? 'open' : ''}`} onClick={() => !disabled && setOpen(!open)} disabled={disabled}>
        <span className="custom-select-value">{selected ? selected.label : <span className="text-muted">Selecione...</span>}</span>
        <ChevronDown size={14} className="custom-select-icon" />
      </button>
      {open && !disabled && (
        <div className="custom-select-popover">
          <ul className="custom-select-list" role="listbox">
            {options.map((o) => (
              <li 
                key={o.value} 
                role="option" 
                aria-selected={String(value) === o.value}
                className={`custom-select-item ${String(value) === o.value ? 'selected' : ''} ${o.disabled ? 'disabled' : ''}`}
                onClick={() => {
                  if (o.disabled) return;
                  onChange({ target: { value: o.value } });
                  setOpen(false);
                }}
              >
                {o.label}
                {String(value) === o.value && <Check size={14} className="custom-select-check" />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

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

export function Badge({ tone = 'neutral', variant = 'default', children, title }: { tone?: Tone; variant?: 'default' | 'line'; children: ReactNode; title?: string }) {
  if (variant === 'line') {
    return (
      <span className={`badge-line badge-${tone}`} title={title}>
        <span className="badge-text">{children}</span>
      </span>
    );
  }

  return (
    <span className={`badge badge-${tone} badge-${variant}`} title={title}>
      {children}
    </span>
  );
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
          <CustomSelect className="select-sm" value={String(pageSize)} onChange={(e) => onPageSize(Number(e.target.value))}>
            {[10, 20, 50].map((n) => <option key={n} value={String(n)}>{n}</option>)}
          </CustomSelect>
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

/**
 * Painel de criar/editar, para não sair da página. Usa a mesma casca global da ficha (Peek):
 * painel lateral ou popup central, conforme "Configurar visualização" — não tem chave própria,
 * é sempre a preferência de quem está usando.
 */
/**
 * Onde os painéis se encaixam. Fora de um provedor, o SidePanel abre como gaveta/modal (Peek) e cobre a tela. Dentro de um
 * (o workflow), ele vira uma barra lateral fixa ao lado do conteúdo: a tela continua usável (arrastar, dar zoom, clicar
 * em outro nó) com o painel aberto.
 */
export const DockContext = createContext<HTMLElement | null>(null);

export function SidePanel({ title, subtitle, onClose, children, footer }: PanelProps) {
  const { settings } = useViewSettings();
  const dock = useContext(DockContext);
  const shell = (
    <div className="panel-shell">
      <header className="panel-head">
        <div>
          <h2 className="panel-title">{title}</h2>
          {subtitle && <p className="panel-subtitle">{subtitle}</p>}
        </div>
        <button type="button" className="peek-icon-btn" onClick={onClose} title="Fechar (Esc)"><X size={18} /></button>
      </header>
      <div className="panel-body">{children}</div>
      {footer && <footer className="panel-foot">{footer}</footer>}
    </div>
  );
  if (dock) {
    return createPortal(
      <div className="dock-panel" role="complementary" aria-label={title} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}>
        {shell}
      </div>,
      dock,
    );
  }
  return (
    <Peek mode={settings.openMode} fontSize={settings.fontSize} onClose={onClose} label={title}>
      {shell}
    </Peek>
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

type PopupDialogProps = {
  title: string;
  description?: ReactNode;
  eyebrow?: string;
  tone?: 'accent' | 'success' | 'warning' | 'danger';
  onClose: () => void;
  children?: ReactNode;
  footer?: ReactNode;
};

/** Diálogo compacto para confirmações, entradas rápidas e resultados de ações. */
export function PopupDialog({ title, description, eyebrow = 'KALIDASH', tone = 'accent', onClose, children, footer }: PopupDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'warning' || tone === 'danger' ? CircleAlert : CircleHelp;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog?.contains(previouslyFocused)) {
      (dialog?.querySelector<HTMLElement>('[autofocus]') ?? dialog?.querySelector<HTMLElement>('.popup-footer button:not(:disabled)') ?? dialog?.querySelector<HTMLElement>('.popup-close'))?.focus();
    }
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, []);

  return (
    <div className="popup-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className={`popup-card popup-${tone}`} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} tabIndex={-1}>
        <header className="popup-header">
          <span className="popup-symbol"><Icon size={19} /></span>
          <div className="popup-heading-copy">
            <span className="popup-eyebrow">{eyebrow}</span>
            <h2 id={titleId} className="popup-title">{title}</h2>
            {description && <p id={descriptionId} className="popup-description">{description}</p>}
          </div>
          <button type="button" className="popup-close" onClick={onClose} aria-label="Fechar"><X size={17} /></button>
        </header>
        {children && <div className="popup-body">{children}</div>}
        {footer && <footer className="popup-footer">{footer}</footer>}
      </section>
    </div>
  );
}
