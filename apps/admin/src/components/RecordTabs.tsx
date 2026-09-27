import { useMemo, useState } from 'react';
import { Check, Circle } from 'lucide-react';
import type { ChangeEntry, EntityKind } from '../domain';
import { emit } from '../lib/events';
import type { EventContext } from '../lib/events';
import { formatDate } from '../lib/format';
import { currentActor, logChange, useHistory } from '../lib/history';
import { useStore } from '../lib/store';
import { pipelinesStore } from '../mocks/pipelines';
import { addTask, tasksStore } from '../mocks/tasks';
import { teamStore } from '../mocks/team';
import { Badge, EmptyState } from './ui';
import { CustomSelect } from '../components/ui';

const when = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

function describe(h: ChangeEntry): { title: string; detail?: string } {
  switch (h.kind) {
    case 'create': return { title: 'Cadastro criado', detail: h.note };
    case 'edit': return { title: `${h.field} alterado`, detail: `${h.from} → ${h.to}` };
    case 'lifecycle': return { title: 'Ciclo de vida mudou', detail: `${h.from} → ${h.to}${h.note ? ` · ${h.note}` : ''}` };
    case 'archive': return { title: 'Arquivado', detail: h.note };
    case 'restore': return { title: 'Restaurado', detail: h.note };
    case 'reveal': return { title: `${h.field ?? 'Dado sensível'} revelado`, detail: h.note };
    case 'qualify': return { title: 'Qualificado', detail: h.note };
    case 'discard': return { title: 'Descartado', detail: h.note };
    default: return { title: 'Evento', detail: h.note };
  }
}

/** Linha do tempo de tudo o que mudou no registro: quem, quando, antes e depois. */
export function HistoryTab({ entity, id, createdAt }: { entity: EntityKind; id: string; createdAt: string }) {
  const entries = useHistory(entity, id);
  return (
    <div className="peek-tl">
      {entries.map((h) => {
        const d = describe(h);
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
  const [all, setAll] = useStore(tasksStore);
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
    addTask({ entity, entityId: id, entityName: name, title: title.trim(), tag, assignee: assignee || undefined, dueAt: due ? new Date(`${due}T12:00:00`).toISOString() : undefined, source: 'manual' });
    logChange({ entity, entityId: id, entityName: name, kind: 'event', note: `Tarefa criada: ${title.trim()}` });
    emit('tarefa.criada', ctx);
    setTitle('');
    setDue('');
  };

  const toggle = (taskId: string) => {
    const task = all.find((t) => t.id === taskId);
    if (!task) return;
    const done = !task.done;
    // Sem responsável definido, quem concluir assume a tarefa (nunca troca quem já foi designado).
    const claims = done && !task.assignee;
    const actor = currentActor();
    setAll((prev) => prev.map((t) => (t.id === taskId ? { ...t, done, doneAt: done ? new Date().toISOString() : undefined, assignee: claims ? actor : t.assignee } : t)));
    logChange({ entity, entityId: id, entityName: name, kind: 'event', note: `${done ? 'Tarefa concluída' : 'Tarefa reaberta'}: ${task.title}${claims ? ` — sem responsável definido, ${actor} assumiu` : ''}` });
    if (done) emit('tarefa.concluida', ctx);
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
        {[...open, ...closed].map((t) => (
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
            <div className="tag-row"><Badge tone="accent">{t.tag}</Badge><Badge>{t.source === 'passo' ? 'Passo do ciclo' : t.source === 'requisito' ? 'Requisito' : 'Manual'}</Badge></div>
          </li>
        ))}
      </ul>
    </div>
  );
}
