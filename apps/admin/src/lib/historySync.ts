import type { ChangeEntry, EntityKind } from '../domain';
import { API_URL } from './api.ts';
import { crmModeStore } from './crmMode.ts';
import { historyStore, setHistoryLoader } from './history.ts';
import { chunk, mergeHistory, pendingEntries } from './historyDiff.ts';
import { pushErro } from './notify.ts';

// Liga o histórico de mudanças à API (docs/api-crm.md, "Histórico"). O histórico é só-acréscimo:
// o front nunca edita nem apaga entradas, só cria; esta camada manda as novas ao servidor e traz as
// que já existem. Cada entrada tem id gerado aqui, então reenviar (retry) não duplica.
//
// Só funciona com o CRM na API (crmMode 'api'); sem ele o histórico continua só na memória.

const FLUSH_MS = 800;
const RETRY_MS = 15_000;
const BATCH = 100;
const known = new Set<string>(); // ids que o servidor já tem
const loadedRecords = new Set<string>();
let timer: ReturnType<typeof setTimeout> | undefined;
let flushing: Promise<void> = Promise.resolve();
let warned = false;
let started = false;

const get = (path: string) => fetch(`${API_URL}${path}`);

function adopt(entries: ChangeEntry[]) {
  entries.forEach((e) => known.add(e.id));
  historyStore.set((prev) => mergeHistory(prev, entries));
}

async function flush() {
  for (const part of chunk(pendingEntries(historyStore.get(), known), BATCH)) {
    const res = await fetch(`${API_URL}/api/crm/history`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(part) });
    if (res.ok) {
      part.forEach((e) => known.add(e.id));
      warned = false;
    } else if (res.status === 400 || res.status === 413 || res.status === 422) {
      // O servidor recusou o lote: reenviar não resolve. Marca como visto para não travar as próximas e avisa.
      part.forEach((e) => known.add(e.id));
      const msg = await res.json().then((j: { error?: string }) => j.error).catch(() => undefined);
      pushErro('Não consegui salvar parte do histórico', msg ?? `A API respondeu ${res.status}.`);
    } else {
      throw new Error(String(res.status));
    }
  }
}

function schedule(delay = FLUSH_MS) {
  if (crmModeStore.get() !== 'api') return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    flushing = flushing.then(async () => {
      try {
        await flush();
      } catch {
        if (!warned) pushErro('Sem conexão com a API', 'O histórico de mudanças será salvo assim que ela voltar.');
        warned = true;
        schedule(RETRY_MS); // tenta de novo sozinho
      }
    });
  }, delay);
}

async function load(query: string): Promise<boolean> {
  try {
    const res = await get(`/api/crm/history?${query}`);
    if (!res.ok) return false;
    adopt((await res.json()) as ChangeEntry[]);
    return true;
  } catch {
    return false;
  }
}

/** Baixa as entradas de um registro (uma vez por registro) quando a ficha dele abre. */
export function loadHistoryFor(entity: EntityKind, id: string) {
  if (crmModeStore.get() !== 'api') return;
  const key = `${entity}:${id}`;
  if (loadedRecords.has(key)) return;
  loadedRecords.add(key);
  void load(`entity=${entity}&entityId=${encodeURIComponent(id)}&limit=500`).then((ok) => { if (!ok) loadedRecords.delete(key); });
}

/** As 500 mais recentes de todos os registros (Auditoria). */
export const loadRecentHistory = () => load('limit=500');

// Registrado já no import: o gancho useHistory chama isto quando a ficha abre ou o modo vira 'api'.
setHistoryLoader(loadHistoryFor);

/** Chamada quando o CRM entra no modo API. */
export async function startHistorySync() {
  if (started) return;
  started = true;
  await loadRecentHistory();
  historyStore.subscribe(() => schedule());
  schedule(0); // manda o que foi registrado antes de a sincronização começar
}

/** Estado interno, para diagnóstico (console e testes). */
export const historySyncState = () => ({ started, known: known.size, pending: pendingEntries(historyStore.get(), known).length, records: loadedRecords.size });

// Em desenvolvimento, recarregar este módulo a quente criaria uma segunda sincronização sobre as mesmas
// stores, que brigaria com a primeira (uma cria o que a outra apaga, sem parar). Recarrega a página.
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload());
