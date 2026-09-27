import { createStore, newId } from '../lib/store';
import type { EntityKind, TaskItem } from '../domain';

// Tarefas de exemplo. Nascem de passos do ciclo de vida, de requisitos de etapa (ver lib/gate.ts,
// que as cria sozinho na hora de checar se algo trava) ou à mão. Começa vazia de propósito: uma
// tarefa fixa aqui sem `requirementId` duplicaria a que o gate cria ao checar pela primeira vez.

export const tasksStore = createStore<TaskItem[]>([]);

type NewTask = { entity: EntityKind; entityId: string; entityName: string; title: string; tag: string; assignee?: string; dueAt?: string; source: TaskItem['source'] };

export function addTask(t: NewTask): TaskItem {
  const task: TaskItem = { ...t, id: newId('task'), done: false, createdAt: new Date().toISOString() };
  tasksStore.set((prev) => [task, ...prev]);
  return task;
}
