import { API_URL } from './api';
import { buildSnippet } from './snippet';
import { createStore, useStore } from './store';

// Projetos conectados e formulários rastreados na API (/api/projects), só com CRM_API=1 e AUTH_API=1 e para
// quem tem keys:manage (Admin e Gerente). O servidor decide e valida tudo (apps/api/connect_projects.go).
// O snippet e as chaves: connect.js e tokens (components/Access.tsx).

export const LEAD_FIELDS = ['nome', 'email', 'telefone', 'empresa', 'cargo', 'interesse', 'mensagem'] as const;
export type LeadField = (typeof LEAD_FIELDS)[number];

export type TrackedForm = {
  id: string;
  projectId: string;
  name: string;
  selector: string;
  fields: Partial<Record<LeadField, string>>;
  consentSelector?: string;
  submissions: number;
  lastSubmissionAt?: string;
};

export type ApiProject = {
  id: string;
  name: string;
  url: string;
  origins: string[];
  stack?: string;
  description?: string;
  pipelineId: string;
  stageId: string;
  sourceName: string;
  submissions: number;
  lastSubmissionAt?: string;
  createdAt?: string;
  forms: TrackedForm[];
};

export type ProjectInput = Pick<ApiProject, 'name' | 'url' | 'origins' | 'stack' | 'description' | 'pipelineId' | 'stageId' | 'sourceName'>;
export type FormInput = Pick<TrackedForm, 'name' | 'selector' | 'fields' | 'consentSelector'>;

type Load<T> = { status: 'idle' | 'loading' | 'ready' | 'error'; data?: T; error?: string };

const json = { 'Content-Type': 'application/json' };

async function errorOf(res: Response): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return body.error ?? `Erro ${res.status}`;
}

export const projectsApiStore = createStore<Load<ApiProject[]>>({ status: 'idle' });
export const useApiProjects = () => useStore(projectsApiStore)[0];

export async function loadProjects(): Promise<void> {
  const cur = projectsApiStore.get();
  projectsApiStore.set({ status: 'loading', data: cur.data });
  try {
    const res = await fetch(`${API_URL}/api/projects`);
    if (!res.ok) throw new Error(res.status === 404 ? 'A conexão de projetos está desligada nesta API (precisa de CRM_API=1 e AUTH_API=1).' : await errorOf(res));
    projectsApiStore.set({ status: 'ready', data: (await res.json()) as ApiProject[] });
  } catch (e) {
    projectsApiStore.set({ status: 'error', data: cur.data, error: e instanceof Error && e.message ? e.message : 'A API não respondeu.' });
  }
}

async function send<T>(path: string, method: string, body?: unknown): Promise<{ data: T } | { error: string }> {
  try {
    const res = await fetch(`${API_URL}${path}`, { method, headers: json, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!res.ok) return { error: await errorOf(res) };
    const data = (await res.json()) as T;
    await loadProjects();
    return { data };
  } catch {
    return { error: 'A API não respondeu.' };
  }
}

const enc = encodeURIComponent;
export const createProject = (p: ProjectInput) => send<ApiProject>('/api/projects', 'POST', p);
export const updateProject = (id: string, p: ProjectInput) => send<ApiProject>(`/api/projects/${enc(id)}`, 'PUT', p);
export const disconnectProject = (id: string) => send<{ ok: boolean }>(`/api/projects/${enc(id)}`, 'DELETE');
export const createForm = (projectId: string, f: FormInput) => send<TrackedForm>(`/api/projects/${enc(projectId)}/forms`, 'POST', f);
export const updateForm = (projectId: string, id: string, f: FormInput) => send<TrackedForm>(`/api/projects/${enc(projectId)}/forms/${enc(id)}`, 'PUT', f);
export const deleteForm = (projectId: string, id: string) => send<{ ok: boolean }>(`/api/projects/${enc(projectId)}/forms/${enc(id)}`, 'DELETE');

/** A tag que vai na página. Só carrega a chave publicável; o endereço do script é o da própria API. */
export const snippetFor = (key: string, apiUrl: string = API_URL) => buildSnippet(apiUrl, key);
