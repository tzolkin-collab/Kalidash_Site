import { Compass, Flag } from 'lucide-react';
import type { ReactNode } from 'react';
import type { TaskStatus } from '../domain';
import { TASK_STATUSES, TASK_STATUS_META, statusOf } from '../lib/taskStatus';

// Selos dos CAMPOS (não são tags): cada um com forma própria, para distinguir de relance.
//   Status da tarefa → pílula tingida com um ponto, cor pelo andamento (cinza, âmbar, vermelho, verde)
//   Prioridade       → rótulo reto com barra lateral e bandeira (cor pelo nível)
//   Origem           → pílula tracejada azul com bússola
// As tags (Perfil do cliente, Evento, Geral) têm o próprio visual em TagChip.tsx; a etapa, em StageBadge (cells.tsx).

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const m = TASK_STATUS_META[status];
  return <span className="tagc" data-cat="STATUS" data-tone={m.tone}>{m.label}</span>;
}

/** O selo de status que também é o seletor: um <select> nativo (acessível e com teclado) por cima do selo. */
export function TaskStatusPicker({ task, onChange }: { task: { done: boolean; status?: TaskStatus; title: string }; onChange: (next: TaskStatus) => void }) {
  const status = statusOf(task);
  return (
    <label className="status-pick" title="Mudar o status da tarefa">
      <TaskStatusBadge status={status} />
      <span className="status-pick-caret" aria-hidden="true">▾</span>
      <select className="status-pick-select" value={status} aria-label={`Status de “${task.title}”`} onChange={(e) => onChange(e.target.value as TaskStatus)}>
        {TASK_STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_META[s].label}</option>)}
      </select>
    </label>
  );
}

const PRIORITY: Record<string, { label: string; tone: 'danger' | 'warning' | 'neutral' }> = {
  HIGH: { label: 'Alta', tone: 'danger' },
  MEDIUM: { label: 'Média', tone: 'warning' },
  LOW: { label: 'Baixa', tone: 'neutral' },
};

export function PriorityBadge({ priority }: { priority: string }) {
  const m = PRIORITY[priority] ?? { label: priority, tone: 'neutral' as const };
  return <span className="tagc" data-cat="PRIORITY" data-tone={m.tone}><Flag size={11} aria-hidden="true" className="tagc-icon" /><span className="tagc-text">{m.label}</span></span>;
}

export function SourceBadge({ children, title, icon }: { children: ReactNode; title?: string; icon?: ReactNode }) {
  return <span className="tagc" data-cat="SOURCE" title={title}>{icon ?? <Compass size={11} aria-hidden="true" className="tagc-icon" />}<span className="tagc-text">{children}</span></span>;
}
