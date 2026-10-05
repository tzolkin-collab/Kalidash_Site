import type { Pipeline, TaskItem } from '../domain';

// Partes puras da sincronização de funis e tarefas com a API (sem rede nem stores), testadas em
// tests/workflowDiff.test.ts. A orquestração fica em workflowSync.ts.

/** Campos calculados pelo servidor: não contam para saber se o funil mudou. */
export function pipelineProjection(p: Pipeline): string {
  const { counts: _c, values: _v, ...rest } = p;
  void _c; void _v;
  return JSON.stringify({ ...rest, requirements: p.requirements.map(({ blocked: _b, overdue: _o, ...r }) => (void _b, void _o, r)) });
}

/** O servidor omite o que está vazio; as telas esperam sempre arrays e mapas. */
export function normalizePipeline(raw: Partial<Pipeline> & { id: string; name: string }): Pipeline {
  return {
    offer: '',
    stages: [],
    sources: [],
    requirements: [],
    counts: {},
    values: {},
    customFields: [],
    taskTags: [],
    qualifyRequires: [],
    steps: [],
    ...raw,
  } as Pipeline;
}

export type PipelineChange = { kind: 'create' | 'update'; pipeline: Pipeline };

/** O que precisa ir ao servidor: funis novos (sem snapshot) e alterados. */
export function diffPipelines(snapshot: Map<string, string>, current: Pipeline[]): PipelineChange[] {
  const out: PipelineChange[] = [];
  for (const p of current) {
    const before = snapshot.get(p.id);
    if (before === undefined) out.push({ kind: 'create', pipeline: p });
    else if (before !== pipelineProjection(p)) out.push({ kind: 'update', pipeline: p });
  }
  return out;
}

/** Id de oportunidade real: a API o cria como número (nanossegundos). Exemplos do protótipo não são. */
export const isRealOpportunityId = (id: string) => /^\d+$/.test(id);
export const isSyncableTask = (t: TaskItem) => t.entity === 'opportunity' && isRealOpportunityId(t.entityId);

export function taskProjection(t: TaskItem): string {
  return JSON.stringify([t.title, t.tag, t.assignee ?? null, t.dueAt ?? null, t.done]);
}

export type TaskChanges = { create: TaskItem[]; update: TaskItem[]; remove: string[] };

export function diffTasks(snapshot: Map<string, string>, current: TaskItem[]): TaskChanges {
  const mine = current.filter(isSyncableTask);
  const ids = new Set(mine.map((t) => t.id));
  return {
    create: mine.filter((t) => !snapshot.has(t.id)),
    update: mine.filter((t) => snapshot.has(t.id) && snapshot.get(t.id) !== taskProjection(t)),
    remove: [...snapshot.keys()].filter((id) => !ids.has(id)),
  };
}
