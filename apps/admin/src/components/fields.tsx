import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Eye, Plus, Trash2, X } from 'lucide-react';
import type { ContactPoint } from '../domain';
import { CustomSelect } from './ui';

// Campos da ficha com edição por campo: clica, edita, Enter ou sair do campo salva, Esc cancela.
// O mesmo comportamento da oportunidade. Cada campo avisa quem o usa por `onCommit`.

export function PropRow({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="peek-prop prop-row">
      <div className="peek-prop-label" title={hint}>{label}</div>
      <div className="peek-prop-value">{children}</div>
      <span />
    </div>
  );
}

const Empty = ({ text = 'Vazio' }: { text?: string }) => <span className="text-muted">{text}</span>;

type TextProps = {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  mono?: boolean;
  type?: 'text' | 'email' | 'tel' | 'date' | 'url';
  multiline?: boolean;
  /** Devolve a mensagem de erro, ou null se estiver certo. O campo continua aberto enquanto houver erro. */
  validate?: (value: string) => string | null;
  /** Aplica máscara enquanto digita (CPF, CNPJ, telefone). */
  format?: (value: string) => string;
  readOnly?: boolean;
  hint?: string;
  display?: ReactNode;
  required?: boolean;
};

export function TextField(props: TextProps) {
  if (props.type === 'date') return <DateTextField {...props} />;
  return <BasicTextField {...props} />;
}

function BasicTextField({ label, value, onCommit, placeholder, mono, type = 'text', multiline, validate, format, readOnly, hint, display, required }: TextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const finished = useRef(true); // evita salvar duas vezes (Enter + blur)

  const start = () => {
    if (readOnly) return;
    finished.current = false;
    setDraft(value);
    setError(null);
    setEditing(true);
  };
  const close = () => { finished.current = true; setEditing(false); setError(null); };

  const commit = () => {
    if (finished.current) return;
    const next = draft.trim();
    if (required && next === '') { setError('Este campo não pode ficar vazio.'); return; }
    if (next === value) { close(); return; }
    const problem = next === '' ? null : validate?.(next) ?? null;
    if (problem) { setError(problem); return; }
    close();
    onCommit(next);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
  };

  const change = (v: string) => setDraft(format ? format(v) : v);

  return (
    <PropRow label={label} hint={hint}>
      {editing ? (
        <>
          {multiline ? (
            <textarea autoFocus className="inline-input" rows={3} value={draft} placeholder={placeholder} onChange={(e) => change(e.target.value)} onBlur={commit} onKeyDown={onKeyDown} aria-label={label} />
          ) : (
            <input autoFocus className={`inline-input ${mono ? 'mono' : ''}`} type={type} value={draft} placeholder={placeholder} onChange={(e) => change(e.target.value)} onBlur={commit} onKeyDown={onKeyDown} aria-label={label} />
          )}
          {error && <div className="field-error" role="alert">{error}</div>}
        </>
      ) : (
        <button type="button" className={`inline-value ${readOnly ? 'is-readonly' : ''} ${mono ? 'mono' : ''}`} onClick={start} disabled={readOnly} title={readOnly ? hint : 'Clique para editar'}>
          {display ?? (value ? value : <Empty />)}
        </button>
      )}
    </PropRow>
  );
}

type DateParts = { day: string; month: string; year: string; hour: string; minute: string };

const todayParts = (): DateParts => {
  const now = new Date();
  return { day: String(now.getDate()), month: String(now.getMonth() + 1), year: String(now.getFullYear()), hour: String(now.getHours()).padStart(2, '0'), minute: String(now.getMinutes()).padStart(2, '0') };
};

function partsFromValue(value: string): { parts: DateParts; withTime: boolean } {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const hasTime = /T\d{2}:\d{2}/.test(value);
  const date = dateOnly ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])) : value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return { parts: todayParts(), withTime: false };
  return { parts: { day: String(date.getDate()), month: String(date.getMonth() + 1), year: String(date.getFullYear()), hour: String(date.getHours()).padStart(2, '0'), minute: String(date.getMinutes()).padStart(2, '0') }, withTime: hasTime };
}

function DateTextField({ label, value, onCommit, hint, display, readOnly }: TextProps) {
  const [editing, setEditing] = useState(false);
  const [parts, setParts] = useState<DateParts>(todayParts);
  const [timeEnabled, setTimeEnabled] = useState(false);
  const [monthView, setMonthView] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const editorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!editing) return;
    const frame = requestAnimationFrame(() => editorRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    return () => cancelAnimationFrame(frame);
  }, [editing]);
  const validDate = (p: DateParts) => {
    const day = Number(p.day); const month = Number(p.month); const year = Number(p.year);
    return p.day !== '' && p.month !== '' && p.year.length === 4 && year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= new Date(year, month, 0).getDate();
  };
  const selected = validDate(parts) ? new Date(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) : null;
  const start = new Date(monthView.getFullYear(), monthView.getMonth(), 1);
  const offset = (start.getDay() + 6) % 7;
  const days = new Date(monthView.getFullYear(), monthView.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, i) => i - offset + 1);

  const open = () => {
    if (readOnly) return;
    const parsed = partsFromValue(value);
    setParts(parsed.parts);
    setTimeEnabled(parsed.withTime);
    setMonthView(new Date(Number(parsed.parts.year), Number(parsed.parts.month) - 1, 1));
    setEditing(true);
  };
  const updateDate = (day: number, month = monthView.getMonth() + 1, year = monthView.getFullYear()) => {
    setParts((p) => ({ ...p, day: String(day), month: String(month), year: String(year) }));
    setMonthView(new Date(year, month - 1, 1));
  };
  const commit = () => {
    if (!selected) return;
    const date = `${parts.year}-${parts.month.padStart(2, '0')}-${parts.day.padStart(2, '0')}`;
    const hour = Number(parts.hour); const minute = Number(parts.minute);
    if (timeEnabled && (hour > 23 || minute > 59 || parts.hour === '' || parts.minute === '')) return;
    const next = timeEnabled ? new Date(Number(parts.year), Number(parts.month) - 1, Number(parts.day), hour, minute).toISOString() : date;
    setEditing(false);
    if (next !== value) onCommit(next);
  };
  const cancel = () => setEditing(false);
  const setPart = (key: keyof DateParts, raw: string) => {
    const max = key === 'day' || key === 'month' ? 2 : key === 'year' ? 4 : 2;
    const next = raw.replace(/\D/g, '').slice(0, max);
    setParts((p) => ({ ...p, [key]: next }));
    if (key === 'month' || key === 'year') {
      const month = key === 'month' ? Number(next) : Number(parts.month);
      const year = key === 'year' ? Number(next) : Number(parts.year);
      if (month >= 1 && month <= 12 && year > 0) setMonthView(new Date(year, month - 1, 1));
    }
  };

  return (
    <PropRow label={label} hint={hint}>
      {editing ? (
        <div ref={editorRef} className="date-editor" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); cancel(); } if (e.key === 'Enter' && validDate(parts)) { e.preventDefault(); commit(); } }}>
          <div className="date-editor-head">
            <strong>Data e horário</strong>
            <span>Digite os valores ou escolha uma data no calendário.</span>
          </div>
          <div className="date-editor-fields">
            <label><span>Dia</span><input autoFocus inputMode="numeric" placeholder="DD" value={parts.day} onFocus={(e) => e.currentTarget.select()} onChange={(e) => setPart('day', e.target.value)} aria-label="Dia" /></label>
            <i>/</i>
            <label><span>Mês</span><input inputMode="numeric" placeholder="MM" value={parts.month} onFocus={(e) => e.currentTarget.select()} onChange={(e) => setPart('month', e.target.value)} aria-label="Mês" /></label>
            <i>/</i>
            <label className="date-year"><span>Ano</span><input inputMode="numeric" value={parts.year} onFocus={(e) => e.currentTarget.select()} onChange={(e) => setPart('year', e.target.value)} aria-label="Ano" /></label>
            <button type="button" className="date-today" onClick={() => { const p = todayParts(); setParts((old) => ({ ...old, day: p.day, month: p.month, year: p.year })); setMonthView(new Date(Number(p.year), Number(p.month) - 1, 1)); }}>Hoje</button>
          </div>
          <div className="date-calendar">
            <div className="date-calendar-head">
              <button type="button" aria-label="Mês anterior" onClick={() => setMonthView(new Date(monthView.getFullYear(), monthView.getMonth() - 1, 1))}><ChevronLeft size={16} /></button>
              <strong>{monthView.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</strong>
              <button type="button" aria-label="Próximo mês" onClick={() => setMonthView(new Date(monthView.getFullYear(), monthView.getMonth() + 1, 1))}><ChevronRight size={16} /></button>
            </div>
            <div className="date-calendar-grid date-weekdays">{['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'].map((d) => <span key={d}>{d}</span>)}</div>
            <div className="date-calendar-grid">
              {cells.map((day, i) => {
                const inMonth = day > 0 && day <= days;
                const isSelected = inMonth && selected?.getDate() === day && selected.getMonth() === monthView.getMonth() && selected.getFullYear() === monthView.getFullYear();
                const now = new Date(); const isToday = inMonth && now.getDate() === day && now.getMonth() === monthView.getMonth() && now.getFullYear() === monthView.getFullYear();
                return inMonth ? <button type="button" key={i} className={`${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`} onClick={() => updateDate(day)} aria-label={`${day} de ${monthView.toLocaleDateString('pt-BR', { month: 'long' })}`}>{day}</button> : <span key={i} />;
              })}
            </div>
          </div>
          <div className="date-time-row">
            <label className="date-time-toggle"><input type="checkbox" checked={timeEnabled} onChange={(e) => setTimeEnabled(e.target.checked)} /><Clock3 size={14} /> Incluir horário</label>
            {timeEnabled && <div className="date-time-inputs"><input inputMode="numeric" value={parts.hour} onFocus={(e) => e.currentTarget.select()} onChange={(e) => setPart('hour', e.target.value)} aria-label="Hora" placeholder="HH" /><span>:</span><input inputMode="numeric" value={parts.minute} onFocus={(e) => e.currentTarget.select()} onChange={(e) => setPart('minute', e.target.value)} aria-label="Minuto" placeholder="MM" /></div>}
          </div>
          <div className="date-editor-actions">
            <button type="button" className="date-clear" onClick={() => { setEditing(false); if (value) onCommit(''); }}>Limpar</button>
            <button type="button" className="btn btn-sm" onClick={cancel}>Cancelar</button>
            <button type="button" className="btn btn-sm btn-solid" onClick={commit} disabled={!selected}>Aplicar</button>
          </div>
        </div>
      ) : (
        <button type="button" className={`inline-value ${readOnly ? 'is-readonly' : ''}`} onClick={open} disabled={readOnly} title={readOnly ? hint : 'Clique para editar'}>
          {display ?? (value ? value : <Empty />)}
          {!readOnly && <CalendarDays className="date-value-icon" size={14} />}
        </button>
      )}
    </PropRow>
  );
}

type Option = { value: string; label: string; disabled?: boolean };

export function SelectField({ label, value, options, onCommit, readOnly, hint, empty }: { label: string; value: string; options: Option[]; onCommit: (value: string) => void; readOnly?: boolean; hint?: string; empty?: string }) {
  return (
    <PropRow label={label} hint={hint}>
      <CustomSelect className="inline-select" value={value} disabled={readOnly} title={readOnly ? hint : undefined} onChange={(e) => onCommit(e.target.value)} aria-label={label}>
        {empty !== undefined && <option value="">{empty}</option>}
        {options.map((o) => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
      </CustomSelect>
    </PropRow>
  );
}

/** Mostra um valor calculado que não se edita à mão (ex.: ciclo de vida). */
export function ReadOnlyField({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <PropRow label={label} hint={hint}>{children}</PropRow>;
}

export function TagsField({ label, value, options, allowCreate, onCommit, onCreate, hint }: { label: string; value: string[]; options: string[]; allowCreate?: boolean; onCommit: (tags: string[]) => void; onCreate?: (tag: string) => void; hint?: string }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const available = options.filter((o) => !value.includes(o));

  const add = (raw: string) => {
    const tag = raw.trim();
    setDraft('');
    setAdding(false);
    if (!tag || value.includes(tag)) return;
    const known = options.find((o) => o.toLowerCase() === tag.toLowerCase());
    if (!known && !allowCreate) return;
    if (!known) onCreate?.(tag);
    onCommit([...value, known ?? tag]);
  };

  return (
    <PropRow label={label} hint={hint}>
      <div className="chip-list">
        {value.map((t) => (
          <span key={t} className="tag tag-removable">
            {t}
            <button type="button" onClick={() => onCommit(value.filter((x) => x !== t))} aria-label={`Remover ${t}`}><X size={11} /></button>
          </span>
        ))}
        {adding ? (
          <>
            <input
              autoFocus
              className="inline-input tag-input"
              list={`tags-${label}`}
              value={draft}
              placeholder={allowCreate ? 'Escolha ou crie' : 'Escolha uma tag'}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => add(draft)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(draft); } if (e.key === 'Escape') { e.stopPropagation(); setDraft(''); setAdding(false); } }}
            />
            <datalist id={`tags-${label}`}>{available.map((o) => <option key={o} value={o} />)}</datalist>
          </>
        ) : (
          <button type="button" className="chip-add" onClick={() => setAdding(true)}><Plus size={12} /> Tag</button>
        )}
      </div>
    </PropRow>
  );
}

/** Lista de contatos extras (e-mails ou telefones), cada um com um rótulo. */
export function ContactListField({ label, value, onCommit, kind }: { label: string; value: ContactPoint[]; onCommit: (list: ContactPoint[]) => void; kind: 'email' | 'phone' }) {
  const [rows, setRows] = useState<ContactPoint[] | null>(null);
  const editing = rows !== null;
  const list = rows ?? value;

  const save = (next: ContactPoint[]) => {
    const clean = next.map((r) => ({ value: r.value.trim(), label: r.label.trim() })).filter((r) => r.value !== '');
    setRows(null);
    if (JSON.stringify(clean) !== JSON.stringify(value)) onCommit(clean);
  };

  const bad = (v: string) => kind === 'email' && v.trim() !== '' && !/^\S+@\S+\.\S+$/.test(v.trim());

  return (
    <PropRow label={label}>
      <div className="list-field">
        {list.length === 0 && !editing && <Empty text="Nenhum" />}
        {list.map((r, i) => (
          <div key={i} className="list-row">
            {editing ? (
              <>
                <input className={`inline-input ${bad(r.value) ? 'is-invalid' : ''}`} type={kind === 'email' ? 'email' : 'tel'} value={r.value} onChange={(e) => setRows(list.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} aria-label={`${label} ${i + 1}`} />
                <input className="inline-input list-label" value={r.label} placeholder="Rótulo" onChange={(e) => setRows(list.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} aria-label="Rótulo" />
                <button type="button" className="icon-btn bare" onClick={() => setRows(list.filter((_, j) => j !== i))} aria-label="Remover"><Trash2 size={13} /></button>
              </>
            ) : (
              <span>{r.value} {r.label && <span className="text-muted">· {r.label}</span>}</span>
            )}
          </div>
        ))}
        <div className="list-actions">
          {editing ? (
            <>
              <button type="button" className="btn btn-sm" onClick={() => setRows([...list, { value: '', label: '' }])}><Plus size={12} /> Outro</button>
              <button type="button" className="btn btn-sm btn-solid" disabled={list.some((r) => bad(r.value))} onClick={() => save(list)}>Salvar</button>
              <button type="button" className="btn btn-sm" onClick={() => setRows(null)}>Cancelar</button>
            </>
          ) : (
            <button type="button" className="chip-add" onClick={() => setRows(value.length ? value : [{ value: '', label: '' }])}><Plus size={12} /> {value.length ? 'Editar' : 'Adicionar'}</button>
          )}
        </div>
      </div>
    </PropRow>
  );
}

/** CPF: aparece mascarado, revela sob permissão (e a revelação vai para o histórico). CNPJ aparece inteiro. */
export function DocumentField({ label, value, kind, onCommit, validate, format, canReveal, onReveal, placeholder }: {
  label: string;
  value: string;
  kind: 'cpf' | 'cnpj';
  onCommit: (value: string) => void;
  validate: (value: string) => string | null;
  format: (value: string) => string;
  canReveal?: boolean;
  onReveal?: () => void;
  placeholder: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const sensitive = kind === 'cpf';
  const hidden = sensitive && value !== '' && !revealed;
  const masked = value.replace(/\d(?=.*\d{2}$)/g, '•');
  const lockedByPermission = sensitive && value !== '' && !canReveal;

  return (
    <div className="doc-field">
      <TextField
        label={label}
        value={hidden ? '' : value}
        display={hidden ? <span className="mono">{masked}</span> : undefined}
        mono
        placeholder={placeholder}
        format={format}
        validate={validate}
        onCommit={onCommit}
        readOnly={hidden || lockedByPermission}
        hint={lockedByPermission ? 'Só Admin e Gerente veem e editam o CPF.' : hidden ? 'Revele o CPF para editar.' : undefined}
      />
      {hidden && canReveal && (
        <button type="button" className="btn btn-sm doc-reveal" onClick={() => { setRevealed(true); onReveal?.(); }} title="Revela o CPF e registra no histórico">
          <Eye size={12} /> Revelar
        </button>
      )}
    </div>
  );
}

/** Título editável do cabeçalho da ficha. */
export function EditableTitle({ value, onCommit, placeholder = 'Sem nome' }: { value: string; onCommit: (v: string) => void; placeholder?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const finished = useRef(true);

  const close = () => { finished.current = true; setEditing(false); };
  const commit = () => {
    if (finished.current) return;
    const next = draft.trim();
    close();
    if (next && next !== value) onCommit(next);
  };

  if (editing) {
    return <input autoFocus className="peek-input peek-input-title" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } if (e.key === 'Escape') { e.stopPropagation(); close(); } }} aria-label="Nome" />;
  }
  return <h2 className="peek-title" onClick={() => { finished.current = false; setDraft(value); setEditing(true); }} title="Clique para editar">{value || placeholder}</h2>;
}
