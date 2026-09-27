import type { Blocker } from './gate';
import { createStore, newId, useStore } from './store';

// Categoria "Aviso" (notificacoes.md §1 e §4): nasce de uma ação bloqueada, sempre como toast
// temporário no canto inferior esquerdo + uma cópia na caixa de notificações (o sino ainda não
// tem UI própria; a cópia já fica guardada aqui, pronta pra quando ele existir).

export type Aviso = {
  id: string;
  at: string;
  title: string;
  detail: string;
  /** Para onde ir ao clicar no aviso. */
  entityRef?: { kind: 'lead' | 'opportunity'; id: string };
};

export const avisosStore = createStore<Aviso[]>([]);
/** Toasts visíveis agora (subconjunto de avisosStore, some sozinho). */
export const activeToastsStore = createStore<string[]>([]);

const TOAST_MS = 6000;

export function pushAviso(title: string, detail: string, entityRef?: Aviso['entityRef']) {
  const aviso: Aviso = { id: newId('aviso'), at: new Date().toISOString(), title, detail, entityRef };
  avisosStore.set((prev) => [aviso, ...prev]);
  activeToastsStore.set((prev) => [aviso.id, ...prev]);
  setTimeout(() => dismissToast(aviso.id), TOAST_MS);
  return aviso;
}

export function dismissToast(id: string) {
  activeToastsStore.set((prev) => prev.filter((x) => x !== id));
}

/** Mensagem pronta pra um gate barrado: junta os nomes das tarefas que ainda travam. */
export function avisoForBlockers(entityName: string, blockers: Blocker[]): { title: string; detail: string } {
  const names = blockers.map((b) => b.requirement.label);
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
  return {
    title: `${entityName} não pode avançar`,
    detail: blockers.length === 1 ? `Pendente: ${list}.` : `${blockers.length} tarefas pendentes: ${list}.`,
  };
}

export const useAvisos = () => useStore(avisosStore);
export const useActiveToasts = () => useStore(activeToastsStore);
