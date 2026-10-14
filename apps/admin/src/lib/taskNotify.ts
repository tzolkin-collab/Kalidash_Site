import { pipelinesStore } from '../mocks/pipelines.ts';
import { tasksStore } from '../mocks/tasks.ts';
import { emit } from './events.ts';
import { pushNotificacao } from './notify.ts';
import { createdAlert, emitsCreated, eventContextFor, notifyOnCreate, overdueAlerts } from './taskAlerts.ts';

// Liga as tarefas à caixa de notificações (docs/notificacoes.md §3). Observa a store de tarefas, então
// cobre todas as origens (manual, passo do ciclo, requisito, vindas do servidor) sem espalhar chamadas.
//
// "Já visto" é o que evita avisar de novo: o que existia na abertura, o que o servidor devolveu e o
// que só trocou de id (tarefa local que ganhou o id do servidor) não é "nova". As atrasadas já avisadas
// ficam guardadas no navegador, então recarregar a página não repete o aviso.

const KEY = 'kalidash.tarefas-alertadas.v1';
const CHECK_MS = 60_000;

const loadNotified = (): Set<string> => {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
};
const saveNotified = (s: Set<string>) => {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify([...s].slice(-500)));
  } catch {
    /* storage cheio ou bloqueado: avisa de novo na próxima abertura */
  }
};

let seen = new Set<string>();
const notifiedOverdue = loadNotified();
let started = false;

/** Marca ids como já vistos (hidratação do servidor, troca de id local → servidor): não geram "nova tarefa". */
export function markTasksSeen(ids: string[]) {
  ids.forEach((id) => seen.add(id));
}

let running = false;
let again = false;

function check() {
  // Uma automação pode criar tarefa e mexer na store no meio da verificação: não reentra, repete no fim.
  if (running) { again = true; return; }
  running = true;
  try {
    do {
      again = false;
      run();
    } while (again);
  } finally {
    running = false;
  }
}

function run() {
  const tasks = tasksStore.get();
  const pipelines = pipelinesStore.get();
  for (const t of tasks) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    if (notifyOnCreate(t, pipelines)) {
      const a = createdAlert(t);
      pushNotificacao(a.title, a.detail, a.entityRef);
    }
    if (emitsCreated(t)) emit('tarefa.criada', eventContextFor(t, pipelines));
  }
  const { alerts, ids } = overdueAlerts(tasks, notifiedOverdue, Date.now());
  if (ids.length === 0) return;
  // Marca ANTES de avisar e emitir: o que as automações fizerem não pode reavisar as mesmas tarefas.
  ids.forEach((id) => notifiedOverdue.add(id));
  saveNotified(notifiedOverdue);
  alerts.forEach((a) => pushNotificacao(a.title, a.detail, a.entityRef));
  const byId = new Map(tasks.map((t) => [t.id, t]));
  for (const id of ids) {
    const t = byId.get(id);
    if (t) emit('tarefa.atrasada', eventContextFor(t, pipelines));
  }
}

/** Chamada uma vez, depois que as sincronizações iniciais terminaram (o que já existe não é "novo"). */
export function startTaskNotifications() {
  if (started) return;
  started = true;
  seen = new Set(tasksStore.get().map((t) => t.id));
  tasksStore.subscribe(check);
  setInterval(check, CHECK_MS);
  check(); // atrasadas que já existem na abertura
}

/** Estado interno, para diagnóstico (console e testes). */
export const taskNotifyState = () => ({ started, vistas: seen.size, atrasadasAvisadas: notifiedOverdue.size });

// Em desenvolvimento, recarregar este módulo a quente criaria uma segunda sincronização sobre as mesmas
// stores, que brigaria com a primeira (uma cria o que a outra apaga, sem parar). Recarrega a página.
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload());
