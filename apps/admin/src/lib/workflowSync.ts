import type { Pipeline, TaskItem } from '../domain';
import { pipelinesStore } from '../mocks/pipelines.ts';
import { tasksStore } from '../mocks/tasks.ts';
import { API_URL } from './api.ts';
import { diffPipelines, diffTasks, isSyncableTask, normalizePipeline, pipelineProjection, taskProjection } from './workflowDiff.ts';
import { pushAviso, pushErro, pushNotificacao } from './notify.ts';
import { createStore, useStore } from './store.ts';

// Liga as telas de funis e tarefas à API (docs/api-workflow.md).
//
// As telas continuam lendo e escrevendo as mesmas stores em memória (pipelinesStore e tasksStore).
// Esta camada faz o resto: carrega do servidor na abertura e grava as mudanças depois de um instante.
// Se a API não tem os funis ligados (WORKFLOW_API desligado: as rotas dão 404) ou está fora do ar, o
// modo é "local" e tudo segue como antes, com os dados de exemplo.
//
// Só vão para o servidor as tarefas de oportunidades reais (id numérico, como a API as cria):
// leads, pessoas e empresas ainda são dados de exemplo e não devem poluir o banco.

export type SyncMode = 'loading' | 'api' | 'local';
export const syncModeStore = createStore<SyncMode>('loading');
export const useSyncMode = () => useStore(syncModeStore)[0];

// ---- rede ----

const FLUSH_MS = 600;
let started = false;
const pipeSnap = new Map<string, string>();
const taskSnap = new Map<string, string>();
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let flushing: Promise<void> = Promise.resolve();
let silent = false; // mudanças que a própria sincronização faz nas stores não geram nova gravação

const withSilence = (fn: () => void) => { silent = true; try { fn(); } finally { silent = false; } };

async function api(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_URL}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
}

const serverError = async (res: Response) => {
  try { return ((await res.json()) as { error?: string }).error ?? `erro ${res.status}`; } catch { return `erro ${res.status}`; }
};

function adoptPipelines(list: Pipeline[]) {
  pipeSnap.clear();
  list.forEach((p) => pipeSnap.set(p.id, pipelineProjection(p)));
  withSilence(() => pipelinesStore.set(list));
}

export async function reloadPipelines(): Promise<boolean> {
  const res = await api('/api/pipelines?archived=1');
  if (!res.ok) return false;
  const raw = (await res.json()) as Pipeline[];
  adoptPipelines(raw.map(normalizePipeline));
  return true;
}

/** Recarrega as tarefas de oportunidades do servidor (ex.: depois de o gate criar as dele). */
export async function reloadTasks(): Promise<boolean> {
  if (syncModeStore.get() !== 'api') return false;
  const res = await api('/api/tasks?entity=opportunity');
  if (!res.ok) return false;
  const server = (await res.json()) as TaskItem[];
  taskSnap.clear();
  server.forEach((t) => taskSnap.set(t.id, taskProjection(t)));
  withSilence(() => tasksStore.set((prev) => [...server, ...prev.filter((t) => !isSyncableTask(t))]));
  return true;
}

/** Traz do servidor só o que ele calcula (contagens, valores, bloqueadas e atrasadas). */
function mergeComputed(local: Pipeline, saved: Pipeline): Pipeline {
  const byId = new Map(saved.requirements.map((r) => [r.id, r]));
  return {
    ...local,
    counts: saved.counts,
    values: saved.values,
    requirements: local.requirements.map((r) => {
      const s = byId.get(r.id);
      return s ? { ...r, blocked: s.blocked, overdue: s.overdue } : r;
    }),
  };
}

async function flushPipelines() {
  for (const { kind, pipeline } of diffPipelines(pipeSnap, pipelinesStore.get())) {
    const res = kind === 'create'
      ? await api('/api/pipelines', { method: 'POST', body: JSON.stringify(pipeline) })
      : await api(`/api/pipelines/${encodeURIComponent(pipeline.id)}`, { method: 'PUT', body: JSON.stringify(pipeline) });
    if (res.ok) {
      const saved = normalizePipeline((await res.json()) as Pipeline);
      pipeSnap.set(pipeline.id, pipelineProjection(pipeline)); // o que foi enviado, não o que voltou
      // o servidor devolve contagens e prazos calculados: entram sem gerar nova gravação
      withSilence(() => pipelinesStore.set((prev) => prev.map((p) => (p.id === saved.id ? mergeComputed(p, saved) : p))));
    } else if (res.status === 409 || res.status === 422) {
      pushAviso(`Não consegui salvar o funil "${pipeline.name}"`, await serverError(res));
      await reloadPipelines(); // volta ao que o servidor tem
      return;
    } else {
      pushErro(`Não consegui salvar o funil "${pipeline.name}"`, await serverError(res));
      return; // mantém local; a próxima mudança tenta de novo
    }
  }
}

async function flushTasks() {
  const { create, update, remove } = diffTasks(taskSnap, tasksStore.get());
  for (const t of create) {
    const res = await api('/api/tasks', { method: 'POST', body: JSON.stringify({ title: t.title, tag: t.tag, entity: t.entity, entityId: t.entityId, entityName: t.entityName, assignee: t.assignee, dueAt: t.dueAt, source: t.source === 'requisito' ? 'manual' : t.source }) });
    if (!res.ok) { pushErro('Não consegui salvar a tarefa', await serverError(res)); continue; }
    const saved = (await res.json()) as TaskItem;
    taskSnap.set(saved.id, taskProjection(t));
    withSilence(() => tasksStore.set((prev) => prev.map((x) => (x.id === t.id ? { ...x, id: saved.id } : x))));
    if (t.done) update.push({ ...t, id: saved.id });
  }
  for (const t of update) {
    const res = await api(`/api/tasks/${encodeURIComponent(t.id)}`, { method: 'PUT', body: JSON.stringify({ title: t.title, tag: t.tag, assignee: t.assignee, dueAt: t.dueAt, done: t.done }) });
    if (res.ok) taskSnap.set(t.id, taskProjection(t));
    else pushErro('Não consegui atualizar a tarefa', await serverError(res));
  }
  for (const id of remove) {
    const res = await api(`/api/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res.ok) taskSnap.delete(id);
    else { pushAviso('Esta tarefa não pode ser apagada', await serverError(res)); await reloadTasks(); }
  }
}

function schedule() {
  if (silent || syncModeStore.get() !== 'api') return;
  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushing = flushing.then(async () => {
      try { await flushPipelines(); await flushTasks(); } catch (err) { pushErro('Sem conexão com a API', 'As últimas alterações de funis e tarefas ainda não foram salvas.'); console.error(err); }
    });
  }, FLUSH_MS);
}

/** Chamada uma vez na abertura do admin. Decide o modo e liga a gravação automática. */
export async function initWorkflowSync(): Promise<SyncMode> {
  if (started) return syncModeStore.get();
  started = true;
  try {
    const res = await api('/api/pipelines?archived=1');
    if (!res.ok) { syncModeStore.set('local'); return 'local'; } // 404: WORKFLOW_API desligado
    const list = ((await res.json()) as Pipeline[]).map(normalizePipeline);
    syncModeStore.set('api');
    if (list.length === 0) {
      // Servidor vazio: sobe os funis de exemplo que a tela já mostra, uma única vez.
      const seed = pipelinesStore.get();
      for (const p of seed) {
        const r = await api('/api/pipelines', { method: 'POST', body: JSON.stringify(p) });
        if (!r.ok) { pushErro('Não consegui criar os funis de exemplo', await serverError(r)); break; }
      }
      await reloadPipelines();
      pushNotificacao('Funis de exemplo criados no servidor', 'A partir de agora os funis e as tarefas de oportunidades são salvos na API.');
    } else {
      adoptPipelines(list);
    }
    await reloadTasks();
  } catch {
    syncModeStore.set('local'); // API fora do ar: segue com os dados de exemplo
    return 'local';
  }
  pipelinesStore.subscribe(schedule);
  tasksStore.subscribe(schedule);
  return 'api';
}
