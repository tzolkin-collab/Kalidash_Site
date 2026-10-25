import type { Company, Lead, Person } from '../domain';
import { leadsStore } from '../mocks/leads.ts';
import { companiesStore, peopleStore } from '../mocks/people.ts';
import { API_URL } from './api.ts';
import { crmModeStore } from './crmMode.ts';
import { formatCnpj } from './documents.ts';
import { startHistorySync } from './historySync.ts';
import { pushAviso, pushErro, pushNotificacao } from './notify.ts';
import type { Store } from './store.ts';
import { diffById } from './workflowDiff.ts';
import { reloadTasks } from './workflowSync.ts';

// Liga pessoas, empresas e leads à API (docs/api-crm.md), no mesmo molde de workflowSync.ts: as telas
// seguem lendo e escrevendo as stores em memória; esta camada carrega do servidor na abertura e grava
// as mudanças depois de um instante. Sem CRM_API na API (rotas dão 404) ou com ela fora do ar, o modo
// é "local" e tudo segue com os dados de exemplo.
//
// CPF: o servidor guarda cifrado e devolve mascarado ("•••.•••.•••-35"). A store mostra o mascarado;
// "revelar" busca o completo (revealPersonDocument). Reenviar o mascarado não muda nada no servidor.

type Spec<T extends { id: string }> = {
  key: string;
  label: string;
  path: string;
  store: Store<T[]>;
  name: (x: T) => string;
  /** Ajusta o que veio do servidor para o formato que as telas esperam. */
  fromServer: (x: T) => T;
  /** Depois de gravar: traz do servidor o que ele decide (ex.: CPF mascarado), sem apagar edições novas. */
  merge: (current: T, sent: T, saved: T) => T;
};

const FLUSH_MS = 600;
const snap = { people: new Map<string, string>(), companies: new Map<string, string>(), leads: new Map<string, string>() } as Record<string, Map<string, string>>;
let started = false;
let silent = false;
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let flushing: Promise<void> = Promise.resolve();

const projection = (x: unknown) => JSON.stringify(x);
const withSilence = (fn: () => void) => { silent = true; try { fn(); } finally { silent = false; } };

const people: Spec<Person> = {
  key: 'people', label: 'a pessoa', path: '/api/crm/people', store: peopleStore, name: (p) => p.name,
  fromServer: (p) => p,
  merge: (current, sent, saved) => (current.document === sent.document ? { ...current, document: saved.document } : current),
};
const companies: Spec<Company> = {
  key: 'companies', label: 'a empresa', path: '/api/crm/companies', store: companiesStore, name: (c) => c.name,
  // o servidor guarda o CNPJ só com letras e números; as telas o mostram formatado
  fromServer: (c) => (c.document ? { ...c, document: formatCnpj(c.document) } : c),
  merge: (current) => current,
};
const leads: Spec<Lead> = {
  key: 'leads', label: 'o lead', path: '/api/crm/leads', store: leadsStore, name: (l) => l.name,
  fromServer: (l) => l,
  // quem só enxerga os próprios leads cria sempre em nome próprio: o servidor devolve o responsável que valeu
  merge: (current, sent, saved) => (current.ownerId === sent.ownerId && saved.ownerId !== current.ownerId ? { ...current, ownerId: saved.ownerId } : current),
};
const specs = [people, companies, leads] as unknown as Spec<{ id: string }>[];

async function api(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_URL}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
}
const serverError = async (res: Response) => {
  try { return ((await res.json()) as { error?: string }).error ?? `erro ${res.status}`; } catch { return `erro ${res.status}`; }
};

/** Baixa tudo (inclusive arquivados) em páginas de 500. */
async function fetchAll<T>(path: string): Promise<T[] | null> {
  const out: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const res = await api(`${path}?archived=1&limit=500&offset=${offset}`);
    if (!res.ok) return null;
    const page = (await res.json()) as T[];
    out.push(...page);
    const total = Number(res.headers.get('X-Total-Count') ?? out.length);
    if (page.length === 0 || out.length >= total) return out;
  }
}

async function hydrate(spec: Spec<{ id: string }>): Promise<boolean> {
  const list = await fetchAll<{ id: string }>(spec.path);
  if (!list) return false;
  const items = list.map(spec.fromServer);
  snap[spec.key].clear();
  items.forEach((x) => snap[spec.key].set(x.id, projection(x)));
  withSilence(() => spec.store.set(items));
  return true;
}

async function flushSpec(spec: Spec<{ id: string }>) {
  const { create, update } = diffById(snap[spec.key], spec.store.get(), projection);
  const jobs = [...create.map((x) => ({ x, post: true })), ...update.map((x) => ({ x, post: false }))];
  for (const { x, post } of jobs) {
    const res = post
      ? await api(spec.path, { method: 'POST', body: JSON.stringify(x) })
      : await api(`${spec.path}/${encodeURIComponent(x.id)}`, { method: 'PUT', body: JSON.stringify(x) });
    if (res.ok) {
      const saved = spec.fromServer((await res.json()) as { id: string });
      snap[spec.key].set(x.id, projection(x));
      withSilence(() => spec.store.set((prev) => prev.map((c) => {
        if (c.id !== x.id) return c;
        const merged = spec.merge(c, x, saved);
        if (merged !== c && projection(merged) !== projection(c) && projection(c) === projection(x)) snap[spec.key].set(x.id, projection(merged)); // nada novo do usuário: o snapshot acompanha
        return merged;
      })));
    } else if (res.status === 409 || res.status === 422) {
      pushAviso(`Não consegui salvar ${spec.label} "${spec.name(x)}"`, await serverError(res));
      await hydrate(spec); // volta ao que o servidor tem
      return;
    } else {
      pushErro(`Não consegui salvar ${spec.label} "${spec.name(x)}"`, await serverError(res));
      return; // mantém local; a próxima mudança tenta de novo
    }
  }
}

function schedule() {
  if (silent || crmModeStore.get() !== 'api') return;
  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushing = flushing.then(async () => {
      try { for (const s of specs) await flushSpec(s); } catch (err) { pushErro('Sem conexão com a API', 'As últimas alterações de pessoas, empresas e leads ainda não foram salvas.'); console.error(err); }
    });
  }, FLUSH_MS);
}

/** Estado interno, para diagnóstico (console e testes). */
export const crmSyncState = () => ({ started, silent, pending: flushTimer !== undefined, snapshots: { people: snap.people.size, companies: snap.companies.size, leads: snap.leads.size } });

/** Revela o CPF completo de uma pessoa. A store passa a ter o completo (sem contar como edição). */
export async function revealPersonDocument(id: string): Promise<string | null> {
  if (crmModeStore.get() !== 'api') return null;
  const res = await api(`/api/crm/people/${encodeURIComponent(id)}/document`);
  if (!res.ok) { pushErro('Não consegui revelar o CPF', await serverError(res)); return null; }
  const { document } = (await res.json()) as { document: string };
  withSilence(() => peopleStore.set((prev) => prev.map((p) => {
    if (p.id !== id) return p;
    const next = { ...p, document: document || undefined };
    snap.people.set(id, projection(next));
    return next;
  })));
  return document;
}

/** Semeia o servidor vazio com os exemplos que a tela já mostra. Devolve se algum CPF ficou de fora. */
async function seed(): Promise<{ failed: boolean; withoutKey: boolean }> {
  let withoutKey = false;
  for (const s of specs) {
    for (const x of s.store.get()) {
      let res = await api(s.path, { method: 'POST', body: JSON.stringify(x) });
      if (res.status === 422 && s.key === 'people') {
        const msg = await serverError(res);
        if (msg.includes('DATA_KEY')) {
          withoutKey = true;
          res = await api(s.path, { method: 'POST', body: JSON.stringify({ ...x, document: undefined }) });
        } else {
          pushErro(`Exemplo recusado pelo servidor (${s.name(x)})`, msg);
          continue;
        }
      }
      if (!res.ok) { pushErro(`Não consegui criar o exemplo "${s.name(x)}"`, await serverError(res)); return { failed: true, withoutKey }; }
    }
  }
  return { failed: false, withoutKey };
}

/** Chamada uma vez na abertura do admin, depois do initWorkflowSync. */
export async function initCrmSync(): Promise<void> {
  if (started) return;
  started = true;
  try {
    const probe = await api('/api/crm/people?limit=1');
    if (!probe.ok) { crmModeStore.set('local'); return; } // 404: CRM_API desligado
    // Servidor vazio (contando arquivados) nas três coleções: semeia com os exemplos, uma única vez.
    const counts = await Promise.all(specs.map((s) => api(`${s.path}?archived=1&limit=1`).then((r) => Number(r.headers.get('X-Total-Count') ?? '1'))));
    if (counts.every((n) => n === 0)) {
      const { failed, withoutKey } = await seed();
      if (!failed) pushNotificacao('Pessoas, empresas e leads de exemplo criados no servidor', 'A partir de agora são salvos na API.');
      if (withoutKey) pushAviso('CPFs de exemplo não foram salvos', 'O servidor não tem DATA_KEY configurada. Defina-a na API para guardar CPFs.');
    }
    for (const s of specs) if (!(await hydrate(s))) throw new Error('falha ao carregar ' + s.key);
  } catch {
    crmModeStore.set('local');
    return;
  }
  crmModeStore.set('api');
  void reloadTasks(); // agora que o CRM está na API, as tarefas de leads, pessoas e empresas também
  void startHistorySync(); // e o histórico de mudanças
  for (const s of specs) s.store.subscribe(schedule);
}

// Em desenvolvimento, recarregar este módulo a quente criaria uma segunda sincronização sobre as mesmas
// stores, que brigaria com a primeira (uma cria o que a outra apaga, sem parar). Recarrega a página.
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload());
