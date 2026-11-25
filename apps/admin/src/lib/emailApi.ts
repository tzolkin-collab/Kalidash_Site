import { useEffect } from 'react';
import { API_URL } from './api';
import { createStore, useStore } from './store';

// Automações de e-mail no servidor (apps/api/email_automations.go): modelos, fluxos prontos que se ligam e
// desligam (D27) e a fila de envios. 'off' quando a API não tem EMAIL_AUTOMATIONS=1 (a rota responde 404).

export type EmailMode = 'loading' | 'api' | 'off';

export type EmailTemplate = {
  id: string;
  name: string;
  tag: string;
  subject: string;
  html: string;
  design?: unknown;
  updatedAt?: string;
};

export type EmailFlow = {
  id: string;
  name: string;
  event: string;
  eventLabel: string;
  recipient: string;
  detail: string;
  defaultDelayMinutes: number;
  stopIfContacted: boolean;
  active: boolean;
  templateId: string;
  delayMinutes: number;
  updatedAt?: string;
  updatedBy?: string;
  sent: number;
  queued: number;
  failed: number;
};

export type EmailJobStatus = 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED' | 'CANCELED';

export type EmailJob = {
  id: string;
  automationId: string;
  automation: string;
  event: string;
  entityKind: string;
  entityId: string;
  entityName: string;
  to: string;
  subject: string;
  status: EmailJobStatus;
  attempts: number;
  runAt: string;
  lastError?: string;
  createdAt: string;
  sentAt?: string;
};

export type EmailState = {
  mode: EmailMode;
  flows: EmailFlow[];
  templates: EmailTemplate[];
  jobs: EmailJob[];
  configured: boolean;
  from: string;
  variables: string[];
  error?: string;
};

export const emailStore = createStore<EmailState>({ mode: 'loading', flows: [], templates: [], jobs: [], configured: false, from: '', variables: [] });
export const useEmail = () => useStore(emailStore)[0];

/** O estado dos e-mails, carregando da API na primeira tela que o usa. */
export function useEmailBoot() {
  const email = useEmail();
  useEffect(() => {
    if (email.mode === 'loading') void loadEmail();
  }, [email.mode]);
  return email;
}

async function errorOf(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (body && typeof body.error === 'string') return body.error;
  } catch { /* corpo sem JSON */ }
  if (res.status === 403) return 'Você não tem permissão para isso (gerenciar automações).';
  return `A API respondeu ${res.status}.`;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  if (!res.ok) throw new Error(await errorOf(res));
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/** Carrega fluxos, modelos e o histórico. Sem a rota (404 ou API fora do ar) a tela fica em modo 'off'. */
export async function loadEmail(): Promise<void> {
  try {
    const res = await fetch(`${API_URL}/api/email/automations`);
    if (!res.ok) {
      emailStore.set((s) => ({ ...s, mode: 'off', error: res.status === 404 ? undefined : authHint(res.status) }));
      return;
    }
    const meta = (await res.json()) as { flows: EmailFlow[]; configured: boolean; from: string; variables: string[] };
    const [templates, jobs] = await Promise.all([
      call<EmailTemplate[]>('/api/email/templates'),
      call<EmailJob[]>('/api/email/jobs?limit=200'),
    ]);
    emailStore.set({ mode: 'api', flows: meta.flows, templates, jobs, configured: meta.configured, from: meta.from, variables: meta.variables });
  } catch {
    emailStore.set((s) => ({ ...s, mode: 'off' }));
  }
}

function authHint(status: number): string {
  return status === 401 ? 'Entre com a sua conta para ver as automações de e-mail.' : `A API respondeu ${status}.`;
}

export async function refreshJobs(): Promise<void> {
  const jobs = await call<EmailJob[]>('/api/email/jobs?limit=200');
  emailStore.set((s) => ({ ...s, jobs }));
}

export async function saveFlow(id: string, change: { active: boolean; templateId: string; delayMinutes: number }): Promise<EmailFlow> {
  const flow = await call<EmailFlow>(`/api/email/automations/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(change) });
  emailStore.set((s) => ({ ...s, flows: s.flows.map((f) => (f.id === id ? flow : f)) }));
  return flow;
}

export async function saveTemplate(t: Omit<EmailTemplate, 'id'> & { id?: string }): Promise<EmailTemplate> {
  const body = JSON.stringify({ name: t.name, tag: t.tag, subject: t.subject, html: t.html, design: t.design ?? null });
  const saved = t.id
    ? await call<EmailTemplate>(`/api/email/templates/${encodeURIComponent(t.id)}`, { method: 'PUT', body })
    : await call<EmailTemplate>('/api/email/templates', { method: 'POST', body });
  emailStore.set((s) => ({ ...s, templates: s.templates.some((x) => x.id === saved.id) ? s.templates.map((x) => (x.id === saved.id ? saved : x)) : [...s.templates, saved] }));
  return saved;
}

export async function deleteTemplate(id: string): Promise<void> {
  await call<void>(`/api/email/templates/${encodeURIComponent(id)}`, { method: 'DELETE' });
  emailStore.set((s) => ({ ...s, templates: s.templates.filter((x) => x.id !== id) }));
}

export async function retryJob(id: string): Promise<void> {
  await call<{ status: string }>(`/api/email/jobs/${encodeURIComponent(id)}/retry`, { method: 'POST' });
  await refreshJobs();
}

/** "2 dias", "3 h", "45 min", "Na hora". */
export function delayText(minutes: number): string {
  if (minutes <= 0) return 'Na hora';
  if (minutes % (24 * 60) === 0) return `${minutes / (24 * 60)} ${minutes === 24 * 60 ? 'dia' : 'dias'} depois`;
  if (minutes % 60 === 0) return `${minutes / 60} h depois`;
  return `${minutes} min depois`;
}

export const JOB_STATUS: Record<EmailJobStatus, { label: string; tone: 'success' | 'danger' | 'warning' | 'info' | 'neutral' }> = {
  QUEUED: { label: 'Na fila', tone: 'info' },
  SENDING: { label: 'Enviando', tone: 'info' },
  SENT: { label: 'Enviado', tone: 'success' },
  FAILED: { label: 'Falhou', tone: 'danger' },
  CANCELED: { label: 'Cancelado', tone: 'neutral' },
};
