import { useEffect, useRef, useState } from 'react';
import { Activity, AppWindow, CheckSquare, Columns3, EyeOff, FileText, Mail, MessageSquare, PanelRight, Phone, Send, X } from 'lucide-react';
import type { Note, Opportunity } from '../types';
import { API_URL } from '../lib/api';
import { formatCurrency, formatDate, moneyToInput, parseMoney } from '../lib/format';
import type { ColumnDef } from '../lib/columns';
import ColumnPicker from './ColumnPicker';

type Tab = 'overview' | 'notes' | 'tasks' | 'emails';
type Field = 'title' | 'value';

type Props = {
  opp: Opportunity;
  variant: 'side' | 'center';
  onClose: () => void;
  /** Chamado depois que o título ou o valor foram salvos. */
  onChange: (updated: Opportunity) => void;
  onMove: (id: string, stage: string) => void;
  onSwitchMode: () => void;
  /** Propriedades exibidas: as colunas visíveis da Lista, sem o título. */
  properties: ColumnDef[];
  hiddenColumns: ColumnDef[];
  editColumns: boolean;
  onHideColumn: (id: string) => void;
  onAddColumn: (id: string) => void;
  onToggleEditColumns: () => void;
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };

const NOTE_LABELS: Record<string, string> = {
  NOTE: 'Anotação',
  CALL: 'Ligação registrada',
  MEETING: 'Reunião',
  EMAIL: 'E-mail (registro)',
};

const TABS: { id: Tab; label: string; Icon: typeof Activity }[] = [
  { id: 'overview', label: 'Visão Geral', Icon: Activity },
  { id: 'notes', label: 'Anotações', Icon: FileText },
  { id: 'tasks', label: 'Tarefas', Icon: CheckSquare },
  { id: 'emails', label: 'E-mails', Icon: MessageSquare },
];

export default function OpportunityDetail({
  opp, variant, onClose, onChange, onMove, onSwitchMode, properties, hiddenColumns, editColumns, onHideColumn, onAddColumn, onToggleEditColumns,
}: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [noteType, setNoteType] = useState('NOTE');

  // Edição de título e valor. O rascunho nasce quando se clica no campo e morre ao sair dele:
  // nunca sobra texto de uma edição anterior para ser gravado por engano.
  const [editing, setEditing] = useState<Field | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const finished = useRef(true); // evita salvar duas vezes (Enter + blur)

  // O pai renderiza esta ficha com key={opp.id}, então o estado reinicia a cada oportunidade.
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/leads/notes?opportunityId=${encodeURIComponent(opp.id)}`)
      .then((res) => res.json())
      .then((data) => { if (!cancelled) setNotes(data || []); })
      .catch(console.error);
    return () => { cancelled = true; };
  }, [opp.id]);

  const startEdit = (field: Field) => {
    finished.current = false;
    setError(null);
    setDraft(field === 'title' ? opp.title : moneyToInput(opp.value));
    setEditing(field);
  };

  const finishEdit = () => {
    finished.current = true;
    setEditing(null);
    setError(null);
  };

  const addSystemNote = (content: string) => {
    fetch(`${API_URL}/api/leads/notes`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ content, type: 'NOTE', opportunityId: opp.id }),
    })
      .then((res) => res.json())
      .then((saved: Note) => setNotes((prev) => [saved, ...prev]))
      .catch(console.error);
  };

  /** Envia a oportunidade atual com SOMENTE o campo que mudou. */
  const save = async (changes: Partial<Pick<Opportunity, 'title' | 'value'>>) => {
    const updated: Opportunity = { ...opp, ...changes };
    try {
      const res = await fetch(`${API_URL}/api/leads`, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(updated) });
      if (!res.ok) throw new Error(String(res.status));
      onChange(updated);
      if (changes.title !== undefined) addSystemNote(`O título foi alterado para: "${changes.title}"`);
      if (changes.value !== undefined) addSystemNote(`O valor foi alterado para: ${formatCurrency(changes.value)}`);
    } catch {
      setError('Não foi possível salvar. Nada foi alterado.');
    }
  };

  const commitEdit = () => {
    if (finished.current || !editing) return;
    if (editing === 'title') {
      const title = draft.trim();
      finishEdit();
      if (title && title !== opp.title) void save({ title });
      return;
    }
    const value = parseMoney(draft);
    if (value === null) {
      setError('Valor inválido. Use, por exemplo, 5000 ou 5.000,50.');
      return; // continua editando: nada é gravado
    }
    finishEdit();
    if (value !== opp.value) void save({ value });
  };

  const onEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
    if (e.key === 'Escape') { e.stopPropagation(); finishEdit(); }
  };

  const addNote = () => {
    if (!newNote.trim()) return;
    fetch(`${API_URL}/api/leads/notes`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ content: newNote, type: noteType, opportunityId: opp.id }),
    })
      .then((res) => res.json())
      .then((saved: Note) => { setNotes((prev) => [saved, ...prev]); setNewNote(''); })
      .catch(console.error);
  };

  const createdAt = formatDate(opp.created_at);
  const humanNotes = notes.filter((n) => n.type === 'NOTE' || n.type === 'CALL' || n.type === 'MEETING');
  const emailNotes = notes.filter((n) => n.type === 'EMAIL');

  const renderNote = (note: Note) => (
    <div key={note.id} className="peek-tl-item">
      <div className="peek-tl-dot" data-type={note.type} />
      <div className="text-xs text-muted">
        {new Date(note.created_at).toLocaleString('pt-BR')}
        {note.authorName && ` • por ${note.authorName}`}
      </div>
      <div className="font-medium text-sm">{NOTE_LABELS[note.type] ?? 'Anotação'}</div>
      <div className="text-sm text-muted" style={{ whiteSpace: 'pre-wrap' }}>{note.content}</div>
    </div>
  );

  return (
    <div className="peek-detail">
      <div className="peek-topbar">
        <button type="button" className={`peek-icon-btn ${editColumns ? 'active' : ''}`} onClick={onToggleEditColumns} aria-pressed={editColumns} title={editColumns ? 'Concluir edição de propriedades' : 'Editar propriedades'}>
          <Columns3 size={16} />
        </button>
        <button type="button" className="peek-icon-btn" onClick={onSwitchMode} title={variant === 'side' ? 'Abrir como popup central' : 'Abrir como painel lateral'}>
          {variant === 'side' ? <AppWindow size={16} /> : <PanelRight size={16} />}
        </button>
        <button type="button" className="peek-icon-btn" onClick={onClose} title="Fechar (Esc)">
          <X size={18} />
        </button>
      </div>

      <div className="peek-scroll">
        <header className="peek-header">
          {editing === 'title' ? (
            <input
              autoFocus
              className="peek-input peek-input-title"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={onEditKeyDown}
              aria-label="Título da oportunidade"
            />
          ) : (
            <h2 className="peek-title" onClick={() => startEdit('title')} title="Clique para editar">{opp.title}</h2>
          )}

          {editing === 'value' ? (
            <input
              autoFocus
              className="peek-input peek-input-value"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={onEditKeyDown}
              placeholder="Ex: 5000,00"
              inputMode="decimal"
              aria-label="Valor da oportunidade"
            />
          ) : (
            <div className="peek-value" onClick={() => startEdit('value')} title="Clique para editar">{formatCurrency(opp.value)}</div>
          )}
          {error && <div className="peek-error" role="alert">{error}</div>}
        </header>

        <section className="peek-props" aria-label="Propriedades">
          {properties.map((col) => (
            <div className="peek-prop" key={col.id}>
              <div className="peek-prop-label">{col.label}</div>
              <div className="peek-prop-value">{col.render(opp)}</div>
              {editColumns && (
                <button type="button" className="peek-icon-btn" onClick={() => onHideColumn(col.id)} title="Ocultar propriedade">
                  <EyeOff size={14} />
                </button>
              )}
            </div>
          ))}
          {editColumns && <ColumnPicker hidden={hiddenColumns} onAdd={onAddColumn} label="Adicionar propriedade" />}
        </section>

        <nav className="peek-tabs" role="tablist">
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={`peek-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </nav>

        <div className="peek-tabpanel" role="tabpanel">
          {tab === 'overview' && (
            <>
              <div className="peek-composer">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder={noteType === 'EMAIL' ? 'Registro de e-mail...' : noteType === 'CALL' ? 'Resumo da ligação...' : 'Adicione uma anotação sobre a negociação...'}
                />
                <div className="peek-composer-bar">
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button type="button" className={`peek-chip ${noteType === 'NOTE' ? 'active' : ''}`} onClick={() => setNoteType('NOTE')}><FileText size={14} /> Anotação</button>
                    <button type="button" className={`peek-chip ${noteType === 'CALL' ? 'active' : ''}`} onClick={() => setNoteType('CALL')}><Phone size={14} /> Ligação</button>
                    <button type="button" className={`peek-chip ${noteType === 'EMAIL' ? 'active' : ''}`} onClick={() => setNoteType('EMAIL')}><Mail size={14} /> E-mail</button>
                  </div>
                  <button type="button" className="btn-primary" onClick={addNote} disabled={!newNote.trim()}>Salvar <Send size={14} /></button>
                </div>
              </div>

              <div className="peek-tl">
                {notes.map(renderNote)}
                <div className="peek-tl-item">
                  <div className="peek-tl-dot" />
                  <div className="text-xs text-muted">{createdAt ?? 'Criação'}</div>
                  <div className="font-medium text-sm">Oportunidade criada</div>
                </div>
              </div>
            </>
          )}

          {tab === 'notes' && (
            <div className="peek-tl">
              {humanNotes.length === 0 && <p className="text-muted text-sm">Nenhuma anotação ainda. Escreva a primeira na Visão Geral.</p>}
              {humanNotes.map(renderNote)}
            </div>
          )}

          {tab === 'tasks' && (
            <p className="text-muted text-sm">Ainda não há tarefas nesta oportunidade. Esta aba será ligada à página Tarefas.</p>
          )}

          {tab === 'emails' && (
            <div className="peek-tl">
              <p className="text-muted text-sm" style={{ marginBottom: '16px' }}>
                O envio de e-mail pelo CRM será ligado a esta aba. Por enquanto ela mostra os registros de e-mail desta oportunidade.
              </p>
              {emailNotes.length === 0 && <p className="text-muted text-sm">Nenhum registro de e-mail ainda.</p>}
              {emailNotes.map(renderNote)}
            </div>
          )}
        </div>
      </div>

      <footer className="peek-footer">
        <button type="button" className="btn-won" onClick={() => { onMove(opp.id, 'WON'); onClose(); }}>Marcar como ganho</button>
        <button type="button" className="btn-lost" disabled title="Ainda não há etapa Perdida no funil">Marcar como perdido</button>
      </footer>
    </div>
  );
}
