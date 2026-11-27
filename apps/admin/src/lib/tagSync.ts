import { useEffect, useMemo } from 'react';
import { API_URL } from './api';
import { useCrmMode } from './crmMode';
import { createStore, newId, useStore } from './store';
import { companiesStore, peopleStore } from '../mocks/people';
import { pipelinesStore } from '../mocks/pipelines';
import { leadsStore } from '../mocks/leads';
import { asCategory, knownTags, tagKey, withAuto } from './tagCatalog';
import type { CatalogTag, TagCategory } from './tagCatalog';

// Catálogo de tags na API (/api/tags): classifica o texto das tags em categorias. Sem a API (modo exemplo) ou se a
// rota ainda não existir no servidor, o catálogo fica só em memória e a UI usa o palpite por palavras
// (lib/tagCatalog.ts). As tags continuam sendo texto nos registros.

export const tagCatalogStore = createStore<CatalogTag[]>([]);

/** Tags em uso nas oportunidades (que vêm de um carregamento próprio, fora das stores de leads e pessoas). */
export const usedTagsStore = createStore<string[]>([]);

/** Chamado por quem carrega oportunidades: junta as tags delas às conhecidas (sem repetir por acento ou caixa). */
export function registerUsedTags(tags: string[]): void {
  const next = knownTags([], [...usedTagsStore.get(), ...tags]);
  const cur = usedTagsStore.get();
  if (next.length !== cur.length || next.some((t, i) => t !== cur[i])) usedTagsStore.set(next);
}

const json = { 'Content-Type': 'application/json' };
let loaded = false;

type Wire = { id: string; name: string; category: string };
const fromWire = (w: Wire): CatalogTag => ({ id: w.id, name: w.name, category: asCategory(w.category) });

export async function loadTagCatalog(): Promise<void> {
  try {
    const res = await fetch(`${API_URL}/api/tags`);
    if (!res.ok) return;
    const list = (await res.json()) as Wire[] | null;
    tagCatalogStore.set((list ?? []).map(fromWire));
    loaded = true;
  } catch {
    // sem a rota ou sem rede: fica o que já estava (palpite por palavras)
  }
}

/** Guarda a categoria de uma tag. Devolve a mensagem de erro, ou null quando deu certo. */
export async function saveTagCategory(name: string, category: TagCategory, api: boolean): Promise<string | null> {
  const existing = tagCatalogStore.get().find((c) => tagKey(c.name) === tagKey(name)); // só a tabela Tag: o que é automático vira entrada nova
  if (!api) {
    tagCatalogStore.set((prev) => (existing ? prev.map((c) => (c.id === existing.id ? { ...c, category } : c)) : [...prev, { id: newId('tag'), name: name.trim(), category }]));
    return null;
  }
  try {
    const res = existing
      ? await fetch(`${API_URL}/api/tags/${encodeURIComponent(existing.id)}`, { method: 'PUT', headers: json, body: JSON.stringify({ category }) })
      : await fetch(`${API_URL}/api/tags`, { method: 'POST', headers: json, body: JSON.stringify({ name, category }) });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      return err.error ?? `Erro ${res.status}`;
    }
    await loadTagCatalog();
    return null;
  } catch {
    return 'A API não respondeu.';
  }
}

/** Tira a tag do catálogo (os registros que usam o texto continuam como estão). */
export async function removeCatalogTag(id: string, api: boolean): Promise<string | null> {
  if (!api) { tagCatalogStore.set((prev) => prev.filter((c) => c.id !== id)); return null; }
  try {
    const res = await fetch(`${API_URL}/api/tags/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 404) return `Erro ${res.status}`;
    await loadTagCatalog();
    return null;
  } catch {
    return 'A API não respondeu.';
  }
}

/**
 * O catálogo completo (busca na API uma vez, quando o CRM está na API): a tabela Tag mais o que já se sabe por onde a tag
 * é usada. Tag de tarefa dos funis é "Tarefa"; a função de um stakeholder é "Função do contato".
 */
export function useTagCatalog(): CatalogTag[] {
  const [catalog] = useStore(tagCatalogStore);
  const [pipelines] = useStore(pipelinesStore);
  const [companies] = useStore(companiesStore);
  const mode = useCrmMode();
  useEffect(() => { if (mode === 'api' && !loaded) void loadTagCatalog(); }, [mode]);
  return useMemo(
    () => withAuto(catalog, pipelines.flatMap((p) => p.taskTags), companies.flatMap((c) => c.stakeholders.map((s) => s.tag))),
    [catalog, pipelines, companies],
  );
}

/** Todas as tags conhecidas: as do catálogo, as usadas em leads, pessoas e oportunidades, e as `extra` que a tela já tem. */
export function useKnownTags(extra: string[] = []): string[] {
  const catalog = useTagCatalog();
  const [leads] = useStore(leadsStore);
  const [people] = useStore(peopleStore);
  const [fromOpps] = useStore(usedTagsStore);
  return knownTags(catalog, [...leads.flatMap((l) => l.tags), ...people.flatMap((p) => p.tags), ...fromOpps, ...extra]);
}
