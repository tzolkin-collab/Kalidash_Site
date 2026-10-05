import { useEffect } from 'react';
import type { ChangeEntry, EntityKind } from '../domain';
import { useCrmMode } from './crmMode';
import { CURRENT_USER_ID, teamStore } from '../mocks/team';
import { createStore, newId, useStore } from './store';

// Histórico de mudanças: quem, quando, em qual registro, o que mudou (antes e depois).
// Alimenta a linha do tempo da ficha e a Auditoria. Só cresce; nada é apagado.

export const historyStore = createStore<ChangeEntry[]>([]);

export const currentActor = () => teamStore.get().find((m) => m.id === CURRENT_USER_ID)?.name ?? 'Equipe';

type LogInput = Omit<ChangeEntry, 'id' | 'at' | 'actor'> & { actor?: string };

export function logChange(entry: LogInput) {
  historyStore.set((prev) => [{ ...entry, id: newId('h'), at: new Date().toISOString(), actor: entry.actor ?? currentActor() }, ...prev]);
}

/** Texto curto para mostrar um valor no histórico. */
export const show = (v: unknown): string => {
  if (v === undefined || v === null || v === '') return '(vazio)';
  if (Array.isArray(v)) return v.length ? v.join(', ') : '(vazio)';
  if (typeof v === 'boolean') return v ? 'sim' : 'não';
  return String(v);
};

/** Com o CRM na API, quem registra aqui como carregar o histórico de um registro (historySync.ts). */
let loadRecord: (entity: EntityKind, id: string) => void = () => {};
export const setHistoryLoader = (fn: (entity: EntityKind, id: string) => void) => { loadRecord = fn; };

export function useHistory(entity: EntityKind, id: string): ChangeEntry[] {
  const [all] = useStore(historyStore);
  const mode = useCrmMode();
  useEffect(() => { loadRecord(entity, id); }, [entity, id, mode]);
  return all.filter((h) => h.entity === entity && h.entityId === id);
}
