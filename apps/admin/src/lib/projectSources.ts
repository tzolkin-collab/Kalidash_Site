import { pipelinesStore } from '../mocks/pipelines.ts';
import { crmModeStore } from './crmMode.ts';
import { loadProjects, projectsApiStore } from './connectSync.ts';
import { withProjectSources } from './sourceLink.ts';
import { syncModeStore, useSyncMode } from './workflowSync.ts';
import { useStore } from './store.ts';

// Liga as fontes dos funis aos projetos conectados da API (B-05; partes puras em sourceLink.ts). Com a API
// ligada, `pipeline.sources` de formulário é DERIVADO de GET /api/projects: esta camada recarrega os
// projetos e refaz as fontes dos funis sempre que os projetos ou os funis mudam.

let started = false;

function derive() {
  const { status, data } = projectsApiStore.get();
  if (status !== 'ready' || !data) return;
  const cur = pipelinesStore.get();
  const next = withProjectSources(cur, data);
  if (next !== cur) pipelinesStore.set(next); // a gravação ignora fontes de formulário (pipelineProjection): não vai ao servidor
}

/** Chamada uma vez na abertura, depois do initCrmSync. Só liga com funis e CRM na API. */
export async function startProjectSources(): Promise<void> {
  if (started || syncModeStore.get() !== 'api' || crmModeStore.get() !== 'api') return;
  started = true;
  projectsApiStore.subscribe(derive);
  pipelinesStore.subscribe(derive);
  await loadProjects();
  derive();
}

/** Há API de funis ligada: a lista de fontes vem dos projetos reais, sem mock. */
export const useLiveSources = () => useSyncMode() === 'api';

/** Estado da carga dos projetos reais (idle fora do modo API). */
export const useProjectsLoad = () => useStore(projectsApiStore)[0];

/** As fontes de formulário só são conhecidas depois que os projetos carregaram (quem não tem keys:manage nunca as vê). */
export const sourcesKnown = (live: boolean, status: string) => !live || status === 'ready';
