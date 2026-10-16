import type { EntityKind, Pipeline, Requirement, TaskItem } from '../domain';
import { pipelinesStore } from '../mocks/pipelines';
import { tasksStore } from '../mocks/tasks';
import { ensureTask } from './gate';
import { emit } from './events';
import type { EventContext } from './events';
import { currentActor, logChange } from './history';
import { eventContextFor } from './taskAlerts';

// Ações sobre uma tarefa existente, iguais na ficha do registro (RecordTabs) e na lista de Tarefas.
// Cada uma altera a store (a sincronização com a API observa a store), registra no histórico do
// registro e, quando cabe, dispara o evento para as automações.

const ref = (t: TaskItem) => ({ entity: t.entity, entityId: t.entityId, entityName: t.entityName });
const ctxOf = (t: TaskItem, ctx?: EventContext): EventContext => ctx ?? eventContextFor(t, pipelinesStore.get());

/** Conclui ou reabre. Sem responsável, quem conclui assume (nunca troca quem já foi designado). */
export function toggleTask(task: TaskItem, ctx?: EventContext) {
  const done = !task.done;
  const claims = done && !task.assignee;
  const actor = currentActor();
  tasksStore.set((prev) => prev.map((t) => (t.id === task.id ? { ...t, done, doneAt: done ? new Date().toISOString() : undefined, assignee: claims ? actor : t.assignee } : t)));
  logChange({ ...ref(task), kind: 'event', note: `${done ? 'Tarefa concluída' : 'Tarefa reaberta'}: ${task.title}${claims ? ` — sem responsável definido, ${actor} assumiu` : ''}` });
  if (done) emit('tarefa.concluida', ctxOf(task, ctx));
}

export type TaskEdit = { title: string; assignee?: string; dueAt?: string };

/** Edita título, responsável e prazo. Só registra no histórico o que de fato mudou. */
export function editTask(task: TaskItem, edit: TaskEdit) {
  const title = edit.title.trim();
  if (!title) return;
  const changes = [
    title !== task.title && 'título',
    edit.assignee !== task.assignee && 'responsável',
    (edit.dueAt?.slice(0, 10) ?? '') !== (task.dueAt?.slice(0, 10) ?? '') && 'prazo',
  ].filter(Boolean);
  if (changes.length === 0) return;
  tasksStore.set((prev) => prev.map((x) => (x.id === task.id ? { ...x, title, assignee: edit.assignee, dueAt: edit.dueAt } : x)));
  logChange({ ...ref(task), kind: 'event', note: `Tarefa editada (${changes.join(', ')}): ${title}` });
}

/** Tarefa de requisito não se exclui: o gate a recriaria na próxima checagem. */
export const canDeleteTask = (task: TaskItem) => task.source !== 'requisito';

export function deleteTask(task: TaskItem) {
  if (!canDeleteTask(task)) return;
  tasksStore.set((prev) => prev.filter((x) => x.id !== task.id));
  logChange({ ...ref(task), kind: 'event', note: `Tarefa excluída: ${task.title}` });
}

/** "2026-10-20" (campo de data) → ISO ao meio-dia local, para não virar o dia anterior por fuso. */
export const dateToDueAt = (d: string) => (d ? new Date(`${d}T12:00:00`).toISOString() : undefined);

/**
 * Concluir ou reabrir, para um registro, a tarefa nascida de um requisito de etapa (o painel "seguir registro"
 * do workflow). Passa pelo mesmo caminho da ficha: cria a tarefa se ainda não existir, registra no histórico e
 * dispara os eventos das automações. Só assim o gate vê a tarefa cumprida.
 */
export function toggleRequirementTask(req: Requirement, pipeline: Pipeline, entity: { kind: EntityKind; id: string; name: string }) {
  const task = ensureTask(req, entity);
  toggleTask(task, { entity: entity.kind, entityId: entity.id, entityName: entity.name, pipelineId: pipeline.id, stageId: req.stageId });
}
