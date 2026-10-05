import type { Blocker } from './gate';
import { createStore, newId, useStore } from './store.ts';

// Caixa de notificações (notificacoes.md §1): três categorias num sino só.
//  - erro: falha de infraestrutura/acesso. Urgente, nunca silenciável (hoje só a UI sabe gerar; o
//    backend vai gerar quando houver API de notificações).
//  - aviso: uma regra do sistema barrou a ação (ex.: gate de etapa). Toast no canto inferior
//    esquerdo + cópia na caixa. Nunca só um dos dois.
//  - notificacao: acompanhamento de negócio (tarefa atrasada, oportunidade avançou…). Só na caixa.
// O histórico fica no navegador (localStorage, últimas 100): a caixa ainda não tem API/servidor.

export type Categoria = 'erro' | 'aviso' | 'notificacao';

export type Aviso = {
  id: string;
  at: string;
  category: Categoria;
  read: boolean;
  title: string;
  detail: string;
  /** Para onde ir ao clicar. */
  entityRef?: { kind: 'lead' | 'opportunity'; id: string };
};

export const MAX_ITEMS = 100;
const KEY = 'kalidash.notificacoes.v1';
const PUSH_KEY = 'kalidash.push.v1';

const load = <T,>(key: string, fallback: T): T => {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const save = (key: string, value: unknown) => {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage cheio ou bloqueado: a caixa segue só em memória */
  }
};

/** Itens antigos (antes de category/read existirem) ganham os padrões. */
const migrate = (list: Partial<Aviso>[]): Aviso[] =>
  list.map((a) => ({ category: 'aviso', read: true, title: '', detail: '', id: newId('aviso'), at: new Date().toISOString(), ...a }) as Aviso).slice(0, MAX_ITEMS);

export const avisosStore = createStore<Aviso[]>(migrate(load<Partial<Aviso>[]>(KEY, [])));
avisosStore.subscribe(() => save(KEY, avisosStore.get()));

/** Toasts visíveis agora (subconjunto de avisosStore, some sozinho). */
export const activeToastsStore = createStore<string[]>([]);

/** Preferência do aviso do navegador (Configurações → Notificações). A caixa nunca desliga. */
export const pushPrefStore = createStore<boolean>(load<boolean>(PUSH_KEY, false));
pushPrefStore.subscribe(() => save(PUSH_KEY, pushPrefStore.get()));

const TOAST_MS = 6000;

/** Notificação do navegador: só com a preferência ligada, permissão concedida e a aba em segundo plano. */
function browserPush(a: Aviso) {
  try {
    if (!pushPrefStore.get() || typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted' || !document.hidden) return;
    new Notification(a.title, { body: a.detail, tag: a.id });
  } catch {
    /* navegador sem suporte */
  }
}

function add(category: Categoria, title: string, detail: string, entityRef: Aviso['entityRef'], toast: boolean) {
  const aviso: Aviso = { id: newId('aviso'), at: new Date().toISOString(), category, read: false, title, detail, entityRef };
  avisosStore.set((prev) => [aviso, ...prev].slice(0, MAX_ITEMS));
  if (toast) {
    activeToastsStore.set((prev) => [aviso.id, ...prev]);
    const timer = setTimeout(() => dismissToast(aviso.id), TOAST_MS);
    (timer as { unref?: () => void }).unref?.();
  }
  browserPush(aviso);
  return aviso;
}

/** Aviso: uma regra barrou a ação. Toast + cópia na caixa. */
export const pushAviso = (title: string, detail: string, entityRef?: Aviso['entityRef']) => add('aviso', title, detail, entityRef, true);
/** Erro: falha de infraestrutura ou acesso. Toast + caixa, sempre. */
export const pushErro = (title: string, detail: string) => add('erro', title, detail, undefined, true);
/** Notificação de negócio: só na caixa (e no navegador, se ligado). */
export const pushNotificacao = (title: string, detail: string, entityRef?: Aviso['entityRef']) => add('notificacao', title, detail, entityRef, false);

export function dismissToast(id: string) {
  activeToastsStore.set((prev) => prev.filter((x) => x !== id));
}

export const unreadCount = (list: Aviso[]) => list.filter((a) => !a.read).length;
export const markRead = (id: string) => avisosStore.set((prev) => prev.map((a) => (a.id === id ? { ...a, read: true } : a)));
export const markAllRead = () => avisosStore.set((prev) => prev.map((a) => (a.read ? a : { ...a, read: true })));
export const clearAll = () => avisosStore.set([]);

/** Liga/desliga o aviso do navegador; ao ligar, pede a permissão. Devolve o estado final. */
export async function setPush(on: boolean): Promise<boolean> {
  if (!on) {
    pushPrefStore.set(false);
    return false;
  }
  if (typeof Notification === 'undefined') return false;
  const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  const ok = permission === 'granted';
  pushPrefStore.set(ok);
  return ok;
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
export const usePushPref = () => useStore(pushPrefStore);
