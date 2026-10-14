import type { EntityKind, Pipeline, Requirement, TaskItem } from '../domain';
import { newId } from './store';
import { tasksStore } from '../mocks/tasks';
import { logChange } from './history';

// Trava real de etapa (D10): um requisito com gate ENTER/EXIT só libera quando a(s) tarefa(s)
// dele estiverem concluídas para aquele registro. Duas ou mais tarefas podem travar a mesma
// fronteira ao mesmo tempo (confirmado em 27/09/2026): todas precisam fechar, não só a primeira.

type EntityRef = { kind: EntityKind; id: string; name: string };

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

/** Garante que exista uma tarefa (aberta ou não) para este requisito e este registro; cria se faltar. */
function ensureTask(req: Requirement, entity: EntityRef): TaskItem {
  const existing = tasksStore.get().find((t) => t.requirementId === req.id && t.entity === entity.kind && t.entityId === entity.id);
  if (existing) return existing;
  const task: TaskItem = {
    id: newId('task'), entity: entity.kind, entityId: entity.id, entityName: entity.name, title: req.label, tag: req.tag,
    assignee: req.assignee, dueAt: req.dueDays !== undefined ? inDays(req.dueDays) : undefined, done: false,
    source: 'requisito', requirementId: req.id, createdAt: new Date().toISOString(),
  };
  tasksStore.set((prev) => [task, ...prev]);
  logChange({ entity: entity.kind, entityId: entity.id, entityName: entity.name, kind: 'event', note: `Tarefa criada pelo requisito de etapa: ${req.label}` });
  return task;
}

export type Blocker = { requirement: Requirement; task: TaskItem };

/**
 * O que impede o registro de entrar em `toStageId` ou sair de `fromStageId`. Vazio = pode mover.
 * As tarefas que faltam para entrar já nascem aqui (lazy), para aparecerem na ficha assim que alguém tentar.
 */
export function gateBlockers(pipeline: Pipeline, entity: EntityRef, fromStageId: string | undefined, toStageId: string): Blocker[] {
  const blockers: Blocker[] = [];
  for (const req of pipeline.requirements) {
    const appliesEnter = req.gate === 'ENTER' && req.stageId === toStageId;
    const appliesExit = req.gate === 'EXIT' && req.stageId === fromStageId;
    if (!appliesEnter && !appliesExit) continue;
    const task = ensureTask(req, entity);
    if (!task.done) blockers.push({ requirement: req, task });
  }
  return blockers;
}
