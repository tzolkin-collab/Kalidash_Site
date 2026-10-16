import { useMemo, useState } from 'react';
import { Check, Circle, Pencil, Trash2, X } from 'lucide-react';
import type { EntityKind, TaskItem } from '../domain';
import { emit } from '../lib/events';
import type { EventContext } from '../lib/events';
import { formatDate } from '../lib/format';
import { logChange, useHistory } from '../lib/history';
import { canDeleteTask, dateToDueAt, deleteTask, editTask, toggleTask } from '../lib/taskActions';
import { describeChange } from '../lib/historyText';
import { useStore } from '../lib/store';
import { pipelinesStore } from '../mocks/pipelines';
import { addTask, tasksStore } from '../mocks/tasks';
import { teamStore } from '../mocks/team';
import { Badge, EmptyState } from './ui';
import { CustomSelect } from '../components/ui';

const when = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/** Linha do tempo de tudo o que mudou no registro: quem, quando, antes e depois. */
export function HistoryTab({ entity, id, createdAt }: { entity: EntityKind; id: string; createdAt: string }) {
  const entries = useHistory(entity, id);
  return (
    <div className="peek-tl">
      {entries.map((h) => {
        const d = describeChange(h);
        return (
          <div key={h.id} className="peek-tl-item">
            <div className="peek-tl-dot" data-type={h.kind === 'edit' ? 'NOTE' : h.kind === 'lifecycle' ? 'CALL' : 'EMAIL'} />
            <div className="text-xs text-muted">{when(h.at)} • {h.actor}</div>
            <div className="font-medium text-sm">{d.title}</div>
            {d.detail && <div className="text-sm text-muted">{d.detail}</div>}
          </div>
        );
      })}
      <div className="peek-tl-item">
        <div className="peek-tl-dot" />
        <div className="text-xs text-muted">{formatDate(createdAt) ?? 'Criação'}</div>
        <div className="font-medium text-sm">Cadastro criado</div>
      </div>
    </div>
  );
}

const TAG_FALLBACK = ['Dados do cliente', 'Dados da empresa', 'Comercial', 'Jurídico', 'Pós-venda', 'Configuração'];

/** Tarefas do registro. Concluir uma emite `tarefa.concluida`. */
export function TasksTab({ entity, id, name, ctx }: { entity: EntityKind; id: string; name: string; ctx: EventContext }) {
  const [all] = useStore(tasksStore);
  const [pipelines] = useStore(pipelinesStore);
  const [team] = useStore(teamStore);
  const tasks = useMemo(() => all.filter((t) => t.entity === entity && t.entityId === id), [all, entity, id]);
  const tags = useMemo(() => [...new Set([...pipelines.flatMap((p) => p.taskTags), ...TAG_FALLBACK])], [pipelines]);

  const [title, setTitle] = useState('');
  const [tag, setTag] = useState(tags[0] ?? 'Geral');
  const [assignee, setAssignee] = useState('');
  const [due, setDue] = useState('');
  const [now] = useState(() => Date.now());

  const add = () => {
    if (!title.trim()) return;
    addTask({ entity, entityId: id, entityName: name, title: title.trim(), tag, assignee: assignee || undefined, dueAt: dateToDueAt(due), source: 'manual' });
    logChange({ entity, entityId: id, entityName: name, kind: 'event', note: `Tarefa criada: ${title.trim()}` });
    emit('tarefa.criada', ctx);
    setTitle('');
    setDue('');
  };

  const toggle = (taskId: string) => {
    const task = all.find((t) => t.id === taskId);
    if (task) toggleTask(task, ctx);
  };

  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: '', assignee: '', due: '' });
  const startEdit = (t: TaskItem) => {
    setEditing(t.id);
    setDraft({ title: t.title, assignee: t.assignee ?? '', due: t.dueAt ? t.dueAt.slice(0, 10) : '' });
  };
  const saveEdit = (task: TaskItem) => {
    if (!draft.title.trim()) return;
    editTask(task, { title: draft.title, assignee: draft.assignee || undefined, dueAt: dateToDueAt(draft.due) });
    setEditing(null);
  };
  const remove = (task: TaskItem) => {
    if (window.confirm(`Excluir a tarefa "${task.title}"?`)) deleteTask(task);
  };

  const open = tasks.filter((t) => !t.done);
  const closed = tasks.filter((t) => t.done);
  const overdue = (iso?: string) => iso !== undefined && new Date(iso).getTime() < now;

  return (
    <div>
      <div className="task-add">
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} placeholder="Nova tarefa…" aria-label="Título da tarefa" />
        <CustomSelect className="select" value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Tag">{tags.map((t) => <option key={t}>{t}</option>)}</CustomSelect>
        <CustomSelect className="select" value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="Responsável"><option value="">Sem responsável</option>{team.map((m) => <option key={m.id}>{m.name}</option>)}</CustomSelect>
        <input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Prazo" />
        <button type="button" className="btn btn-solid" disabled={!title.trim()} onClick={add}>Adicionar</button>
      </div>

      {tasks.length === 0 && <EmptyState title="Nenhuma tarefa">As tarefas dos requisitos e dos passos do ciclo de vida aparecem aqui.</EmptyState>}
      <ul className="task-list">
        {[...open, ...closed].map((t) => editing === t.id ? (
          <li key={t.id} className="task-row task-editing">
            <span />
            <div className="task-edit">
              <input className="input" value={draft.title} autoFocus onChange={(e) => setDraft({ ...draft, title: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveEdit(t); } if (e.key === 'Escape') setEditing(null); }} aria-label="Título da tarefa" />
              <CustomSelect className="select" value={draft.assignee} onChange={(e) => setDraft({ ...draft, assignee: e.target.value })} aria-label="Responsável"><option value="">Sem responsável</option>{team.map((m) => <option key={m.id}>{m.name}</option>)}</CustomSelect>
              <input className="input" type="date" value={draft.due} onChange={(e) => setDraft({ ...draft, due: e.target.value })} aria-label="Prazo" />
            </div>
            <div className="tag-row">
              <button type="button" className="btn btn-solid" disabled={!draft.title.trim()} onClick={() => saveEdit(t)}>Salvar</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)} aria-label="Cancelar edição"><X size={14} /></button>
            </div>
          </li>
        ) : (
          <li key={t.id} className={`task-row ${t.done ? 'done' : ''}`}>
            <button type="button" className="task-check" onClick={() => toggle(t.id)} aria-label={t.done ? 'Reabrir' : 'Concluir'}>{t.done ? <Check size={14} /> : <Circle size={14} />}</button>
            <div className="cell-stack">
              <span className="cell-primary">{t.title}</span>
              <span className="text-xs text-muted">
                {t.assignee ?? 'Sem responsável'}
                {t.dueAt && <> · <span className={!t.done && overdue(t.dueAt) ? 'overdue' : ''}>prazo {formatDate(t.dueAt)}</span></>}
                {t.done && t.doneAt && <> · concluída em {formatDate(t.doneAt)}</>}
              </span>
            </div>
            <div className="tag-row"><Badge tone="accent">{t.tag}</Badge><Badge>{t.source === 'passo' ? 'Passo do ciclo' : t.source === 'requisito' ? 'Requisito' : 'Manual'}</Badge>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEdit(t)} aria-label="Editar tarefa"><Pencil size={14} /></button>
              {/* Tarefa de requisito não se exclui: o gate a recriaria na próxima checagem. */}
              {canDeleteTask(t) && <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(t)} aria-label="Excluir tarefa"><Trash2 size={14} /></button>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
