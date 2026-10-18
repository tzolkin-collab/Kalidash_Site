import type { Role } from '../domain';
import { API_URL } from './api';
import type { Catalog } from './scopes';
import { createStore, useStore } from './store';
import { loadTeam } from './teamSync';

// Permissões por escopo e tokens de API na API (só com o login ligado, AUTH_API=1).
// O servidor decide tudo (apps/api/auth_scopes.go e auth_tokens.go); aqui só se lê e se grava.

export type ApiToken = {
  id: string;
  name: string;
  prefix: string;
  last4: string;
  scopes: string[];
  /** live | test. Chave de teste (kld_test_) marca os leads como Teste. */
  env: 'live' | 'test';
  /** Só chaves do snippet (forms:write) ficam ligadas a um projeto conectado. */
  projectId?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  expiresAt?: string;
  lastUsedAt?: string;
  lastUsedIp?: string;
  revokedAt?: string;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
};

type Load<T> = { status: 'idle' | 'loading' | 'ready' | 'error'; data?: T; error?: string };

const json = { 'Content-Type': 'application/json' };

async function errorOf(res: Response): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return body.error ?? `Erro ${res.status}`;
}

// ---- catálogo de escopos e presets ----

export const catalogStore = createStore<Load<Catalog>>({ status: 'idle' });
export const useCatalog = () => useStore(catalogStore)[0];

export async function loadCatalog(force = false): Promise<void> {
  const cur = catalogStore.get();
  if (cur.status === 'loading' || (cur.status === 'ready' && !force)) return;
  catalogStore.set({ status: 'loading', data: cur.data });
  try {
    const res = await fetch(`${API_URL}/api/access/catalog`);
    if (!res.ok) throw new Error(await errorOf(res));
    catalogStore.set({ status: 'ready', data: (await res.json()) as Catalog });
  } catch (e) {
    catalogStore.set({ status: 'error', error: e instanceof Error && e.message ? e.message : 'A API não respondeu.' });
  }
}

/** Grava perfil e escopos de uma pessoa de uma vez. Devolve a mensagem de erro, ou null. */
export async function saveMemberAccess(id: string, role: Role, extra: string[], denied: string[]): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/api/team/${encodeURIComponent(id)}`, { method: 'PUT', headers: json, body: JSON.stringify({ role, scopesExtra: extra, scopesDenied: denied }) });
    if (!res.ok) return await errorOf(res);
    await loadTeam();
    return null;
  } catch {
    return 'A API não respondeu.';
  }
}

// ---- tokens ----

export const tokensStore = createStore<Load<ApiToken[]>>({ status: 'idle' });
export const useTokens = () => useStore(tokensStore)[0];

export async function loadTokens(): Promise<void> {
  const cur = tokensStore.get();
  tokensStore.set({ status: 'loading', data: cur.data });
  try {
    const res = await fetch(`${API_URL}/api/tokens`);
    if (!res.ok) throw new Error(await errorOf(res));
    tokensStore.set({ status: 'ready', data: (await res.json()) as ApiToken[] });
  } catch (e) {
    tokensStore.set({ status: 'error', data: cur.data, error: e instanceof Error && e.message ? e.message : 'A API não respondeu.' });
  }
}

/** Cria o token. `token` é o segredo completo, devolvido só desta vez. */
export async function createToken(name: string, scopes: string[], expiresAt?: string, extra: { env?: 'live' | 'test'; projectId?: string } = {}): Promise<{ token: string; meta: ApiToken } | { error: string }> {
  try {
    const res = await fetch(`${API_URL}/api/tokens`, { method: 'POST', headers: json, body: JSON.stringify({ name, scopes, expiresAt, ...extra }) });
    if (!res.ok) return { error: await errorOf(res) };
    const out = (await res.json()) as { token: string; meta: ApiToken };
    await loadTokens();
    return out;
  } catch {
    return { error: 'A API não respondeu.' };
  }
}

export async function revokeToken(id: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/api/tokens/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) return await errorOf(res);
    await loadTokens();
    return null;
  } catch {
    return 'A API não respondeu.';
  }
}
