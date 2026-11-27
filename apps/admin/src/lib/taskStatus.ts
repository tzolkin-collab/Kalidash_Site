import type { TaskItem, TaskStatus } from '../domain.ts';

// Status da tarefa: A fazer, Em andamento, Bloqueada ou Concluída. Concluída anda junto com `done` (o bloqueio de
// etapa e as métricas leem `done`); os outros três valem enquanto a tarefa está aberta. Mesma regra do servidor
// (apps/api/workflow_tasks.go: normalizeTaskStatus e applyTaskStatus). Puro: testado em tests/taskStatus.test.ts.

export const TASK_STATUSES: TaskStatus[] = ['TODO', 'DOING', 'BLOCKED', 'DONE'];

export type StatusTone = 'neutral' | 'warning' | 'danger' | 'success';

export const TASK_STATUS_META: Record<TaskStatus, { label: string; tone: StatusTone }> = {
  TODO: { label: 'A fazer', tone: 'neutral' },
  DOING: { label: 'Em andamento', tone: 'warning' },
  BLOCKED: { label: 'Bloqueada', tone: 'danger' },
  DONE: { label: 'Concluída', tone: 'success' },
};

/** O status de uma tarefa: concluída é sempre DONE; aberta mantém o válido, senão A fazer (cobre tarefas sem status). */
export function statusOf(t: Pick<TaskItem, 'done' | 'status'>): TaskStatus {
  if (t.done) return 'DONE';
  return t.status && t.status !== 'DONE' && TASK_STATUSES.includes(t.status) ? t.status : 'TODO';
}

/** Os campos que mudam ao pôr a tarefa em outro status, mantendo done e doneAt coerentes. */
export function withStatus(t: Pick<TaskItem, 'done' | 'doneAt'>, status: TaskStatus, now = new Date()): Pick<TaskItem, 'status' | 'done' | 'doneAt'> {
  if (status === 'DONE') return { status, done: true, doneAt: t.done && t.doneAt ? t.doneAt : now.toISOString() };
  return { status, done: false, doneAt: undefined };
}
