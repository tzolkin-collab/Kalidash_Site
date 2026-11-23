import { normalizeLayout } from './dashboardLayout.ts';
import type { Layout, WidgetSpec } from './dashboardLayout.ts';

// Visões salvas da Dashboard: layouts que a própria pessoa nomeou ("Reunião de segunda", "Meu funil"). Ficam no
// navegador, por usuário, ao lado do layout atual. Puro e testado em tests/dashboardViews.test.ts.

export type SavedView = { id: string; name: string; items: Layout };

export const MAX_VIEWS = 8;
export const MAX_NAME = 30;

export type Added = { views: SavedView[]; error?: string };

let counter = 0;
const newId = () => `v-${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Guarda o layout com um nome. Nome vazio, repetido (sem diferenciar maiúsculas) ou além do limite não entra. */
export function addView(views: SavedView[], name: string, items: Layout): Added {
  const clean = name.trim().slice(0, MAX_NAME);
  if (!clean) return { views, error: 'Dê um nome à visão.' };
  if (views.some((v) => v.name.toLowerCase() === clean.toLowerCase())) return { views, error: 'Já existe uma visão com esse nome.' };
  if (views.length >= MAX_VIEWS) return { views, error: `O limite é de ${MAX_VIEWS} visões. Apague alguma antes.` };
  if (items.length === 0) return { views, error: 'A Dashboard está vazia: adicione ao menos um widget antes de salvar.' };
  return { views: [...views, { id: newId(), name: clean, items: JSON.parse(JSON.stringify(items)) as Layout }] };
}

export const removeView = (views: SavedView[], id: string): SavedView[] => views.filter((v) => v.id !== id);

/** Limpa o que veio do disco: descarta visões sem nome ou sem widgets válidos e repetidas. */
export function normalizeViews(raw: unknown, catalog: WidgetSpec[]): SavedView[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: SavedView[] = [];
  for (const v of raw) {
    const name = typeof v?.name === 'string' ? v.name.trim().slice(0, MAX_NAME) : '';
    const id = typeof v?.id === 'string' && v.id ? v.id : '';
    const items = normalizeLayout(v?.items, catalog);
    if (!name || !id || items.length === 0 || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push({ id, name, items });
    if (out.length >= MAX_VIEWS) break;
  }
  return out;
}

const KEY = 'kalidash.dashboard.views.v1';
export const viewsKey = (userId?: string) => `${KEY}.${userId || 'anon'}`;

export function loadViews(key: string, catalog: WidgetSpec[]): SavedView[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? normalizeViews(JSON.parse(raw), catalog) : [];
  } catch {
    return [];
  }
}

export function saveViews(key: string, views: SavedView[]): void {
  try { localStorage.setItem(key, JSON.stringify(views)); } catch { /* sem storage: vale só nesta sessão */ }
}
