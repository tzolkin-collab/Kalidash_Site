import type { Lead, TaskItem } from '../domain.ts';
import { periodStart } from './salesMetrics.ts';
import type { Period } from './salesMetrics.ts';

// Métricas de leads, origem e tarefas do Dashboard (WP3b). Puras, sem React nem relógio próprio: testadas em
// tests/dashboardMetrics.test.ts. Quem chama só passa dado REAL (CRM e workflow na API); com os exemplos o
// Dashboard nem mostra estas seções.

const inPeriod = (iso: string | undefined, from: number | null, now: number) => {
  if (from === null) return true;
  const at = iso ? Date.parse(iso) : NaN;
  return !Number.isNaN(at) && at >= from && at <= now;
};

export type LeadMetrics = {
  /** Leads em aberto (ativos, não arquivados). */
  active: number;
  /** Entraram no período. */
  newInPeriod: number;
  /** Ativos que ninguém contatou ainda (sem primeiro contato). */
  waitingContact: number;
  /** Ativos que ninguém abriu ainda. */
  unseen: number;
  qualified: number;
  discarded: number;
  /** Qualificados sobre todos os leads não arquivados (0 a 1). */
  qualifiedRate: number;
};

export function leadMetrics(leads: Lead[], period: Period, now = new Date()): LeadMetrics {
  const from = periodStart(period, now);
  const live = leads.filter((l) => !l.archivedAt);
  const active = live.filter((l) => l.status === 'ACTIVE');
  const qualified = live.filter((l) => l.status === 'QUALIFIED').length;
  return {
    active: active.length,
    newInPeriod: live.filter((l) => inPeriod(l.createdAt, from, now.getTime())).length,
    waitingContact: active.filter((l) => !l.firstContactAt).length,
    unseen: active.filter((l) => !l.wasSeen).length,
    qualified,
    discarded: live.filter((l) => l.status === 'DISCARDED').length,
    qualifiedRate: live.length ? qualified / live.length : 0,
  };
}

export type OriginRow = { label: string; origin: 'INBOUND' | 'OUTBOUND'; count: number };

/** Leads do período por origem: inbound por fonte; outbound por quem da equipe trouxe. Do maior para o menor; o resto vira "Outras". */
export function leadOrigins(leads: Lead[], period: Period, now = new Date(), top = 6): OriginRow[] {
  const from = periodStart(period, now);
  const count = new Map<string, OriginRow>();
  for (const l of leads) {
    if (l.archivedAt || !inPeriod(l.createdAt, from, now.getTime())) continue;
    const label = l.origin === 'INBOUND' ? (l.sourceName || 'Sem fonte') : `Outbound · ${l.sourceName || 'sem nome'}`;
    const key = `${l.origin}|${label}`;
    const row = count.get(key) ?? { label, origin: l.origin, count: 0 };
    row.count++;
    count.set(key, row);
  }
  const rows = [...count.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  if (rows.length <= top) return rows;
  const rest = rows.slice(top).reduce((n, r) => n + r.count, 0);
  return [...rows.slice(0, top), { label: 'Outras', origin: 'INBOUND', count: rest }];
}

export type TaskMetrics = {
  open: number;
  overdue: number;
  /** Abertas com prazo nos próximos 7 dias (e ainda não vencidas). */
  dueSoon: number;
  /** Abertas sem prazo. */
  noDue: number;
  /** Concluídas no período. */
  doneInPeriod: number;
};

export const isTaskOverdue = (t: TaskItem, now: number) => !t.done && Boolean(t.dueAt) && Date.parse(t.dueAt as string) < now;

export function taskMetrics(tasks: TaskItem[], period: Period, now = new Date()): TaskMetrics {
  const from = periodStart(period, now);
  const t0 = now.getTime();
  const open = tasks.filter((t) => !t.done);
  return {
    open: open.length,
    overdue: open.filter((t) => isTaskOverdue(t, t0)).length,
    dueSoon: open.filter((t) => {
      const due = t.dueAt ? Date.parse(t.dueAt) : NaN;
      return !Number.isNaN(due) && due >= t0 && due <= t0 + 7 * 86_400_000;
    }).length,
    noDue: open.filter((t) => !t.dueAt).length,
    doneInPeriod: tasks.filter((t) => t.done && inPeriod(t.doneAt, from, t0)).length,
  };
}

/** As tarefas atrasadas mais antigas primeiro (para a lista "o que está parado"). */
export function overdueTasks(tasks: TaskItem[], now = new Date(), limit = 5): TaskItem[] {
  const t0 = now.getTime();
  return tasks
    .filter((t) => isTaskOverdue(t, t0))
    .sort((a, b) => Date.parse(a.dueAt as string) - Date.parse(b.dueAt as string) || a.id.localeCompare(b.id))
    .slice(0, limit);
}
