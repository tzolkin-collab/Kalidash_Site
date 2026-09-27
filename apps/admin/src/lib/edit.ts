import type { EntityKind, Lifecycle } from '../domain';
import { companiesStore, peopleStore } from '../mocks/people';
import { emit } from './events';
import type { EventContext } from './events';
import { logChange, show } from './history';
import type { Store } from './store';

type EditMeta = {
  entity: EntityKind;
  entityName: string;
  /** Nome do campo como aparece no histórico. */
  field: string;
  from: unknown;
  to: unknown;
  /** Chave do campo, para os passos de "campo mudou" (ex.: cnpj). */
  fieldKey?: string;
  ctx?: Partial<EventContext>;
};

/** Grava a mudança de um campo, registra no histórico e emite `campo.mudou`. */
export function editRecord<T extends { id: string }>(store: Store<T[]>, id: string, patch: Partial<T>, meta: EditMeta) {
  store.set((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  logChange({ entity: meta.entity, entityId: id, entityName: meta.entityName, kind: 'edit', field: meta.field, from: show(meta.from), to: show(meta.to) });
  if (meta.fieldKey) emit('campo.mudou', { entity: meta.entity, entityId: id, entityName: meta.entityName, fieldKey: meta.fieldKey, ...meta.ctx });
}

/** Arquivar em vez de excluir: some das listas e volta com o filtro "Arquivados". */
export function setArchived<T extends { id: string; archivedAt?: string }>(store: Store<T[]>, entity: EntityKind, id: string, name: string, archived: boolean) {
  store.set((prev) => prev.map((r) => (r.id === id ? { ...r, archivedAt: archived ? new Date().toISOString() : undefined } : r)));
  logChange({ entity, entityId: id, entityName: name, kind: archived ? 'archive' : 'restore' });
}

/** Mudança manual de ciclo de vida: cliente de antes do sistema, inativar ou reativar. Sempre com motivo. */
export function manualLifecycle(kind: 'person' | 'company', id: string, to: Lifecycle, opts: { reason: string; legacy?: boolean }) {
  const rec = kind === 'person' ? peopleStore.get().find((r) => r.id === id) : companiesStore.get().find((r) => r.id === id);
  if (!rec) return;
  const patch = <T extends { id: string; lifecycle: Lifecycle; legacyClient?: boolean; inactiveReason?: string; firstWonAt?: string }>(list: T[]): T[] =>
    list.map((r) => (r.id === id ? { ...r, lifecycle: to, legacyClient: opts.legacy ? true : r.legacyClient, inactiveReason: to === 'INACTIVE' ? opts.reason : undefined, firstWonAt: to === 'CLIENT' && !r.firstWonAt ? new Date().toISOString() : r.firstWonAt } : r));
  if (kind === 'person') peopleStore.set((prev) => patch(prev));
  else companiesStore.set((prev) => patch(prev));
  logChange({ entity: kind, entityId: id, entityName: rec.name, kind: 'lifecycle', field: 'Ciclo de vida', from: rec.lifecycle, to, note: `Manual: ${opts.reason}` });
}
