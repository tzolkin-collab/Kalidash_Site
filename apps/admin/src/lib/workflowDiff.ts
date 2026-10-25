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

/**
 * O que fazer na abertura com o servidor respondendo: 'adopt' (já tem funis), 'seed' (vazio e VITE_SEED_DEMO=1:
 * sobe os exemplos) ou 'empty' (vazio em produção: a tela fica vazia e nada é criado no servidor, D37).
 */
export const planInitialPipelines = (serverCount: number, seedDemo: boolean): 'adopt' | 'seed' | 'empty' =>
  serverCount > 0 ? 'adopt' : seedDemo ? 'seed' : 'empty';

/** Semear pessoas, empresas e leads: só com as três coleções vazias no servidor e VITE_SEED_DEMO=1 (D37). */
export const shouldSeedCrm = (serverCounts: number[], seedDemo: boolean): boolean => seedDemo && serverCounts.every((n) => n === 0);

/** Id de oportunidade real: a API o cria como número (nanossegundos). Exemplos do protótipo não são. */
export const isRealOpportunityId = (id: string) => /^\d+$/.test(id);
/** Com o CRM na API (`crm`), tarefas de leads, pessoas e empresas também vão ao servidor: esses registros existem lá. */
export const isSyncableTask = (t: TaskItem, crm = false) =>
  (t.entity === 'opportunity' && isRealOpportunityId(t.entityId)) || (crm && (t.entity === 'lead' || t.entity === 'person' || t.entity === 'company'));

export function taskProjection(t: TaskItem): string {
  return JSON.stringify([t.title, t.tag, t.assignee ?? null, t.dueAt ?? null, t.done]);
}

export type TaskChanges = { create: TaskItem[]; update: TaskItem[]; remove: string[] };

export function diffTasks(snapshot: Map<string, string>, current: TaskItem[], crm = false): TaskChanges {
  const mine = current.filter((t) => isSyncableTask(t, crm));
  const ids = new Set(mine.map((t) => t.id));
  return {
    create: mine.filter((t) => !snapshot.has(t.id)),
    update: mine.filter((t) => snapshot.has(t.id) && snapshot.get(t.id) !== taskProjection(t)),
    remove: [...snapshot.keys()].filter((id) => !ids.has(id)),
  };
}

/** Diff genérico por id (pessoas, empresas e leads): novos e alterados, comparando a projeção de cada um. */
export function diffById<T extends { id: string }>(snapshot: Map<string, string>, current: T[], projection: (x: T) => string): { create: T[]; update: T[] } {
  const create: T[] = [];
  const update: T[] = [];
  for (const x of current) {
    const before = snapshot.get(x.id);
    if (before === undefined) create.push(x);
    else if (before !== projection(x)) update.push(x);
  }
  return { create, update };
}
