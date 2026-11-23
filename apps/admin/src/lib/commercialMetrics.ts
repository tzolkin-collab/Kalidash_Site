import type { ChangeEntry, Lead, Pipeline, TaskItem } from '../domain.ts';
import type { Opportunity } from '../types.ts';
import { periodStart, stageInfo, toCents } from './salesMetrics.ts';
import type { Period } from './salesMetrics.ts';

// Métricas comerciais e de atividade da Dashboard. Puras, sem React nem relógio próprio: testadas em
// tests/commercialMetrics.test.ts. Contas de valor em centavos (como lib/salesMetrics.ts).
// Onde a API não guarda a data (motivo de perda, quando foi descartado), a conta é "em todo o histórico" e o
// widget diz isso; nada é inventado.

export type Row = { label: string; count: number; cents?: number };

const DAY = 86_400_000;
const inWindow = (iso: string | null | undefined, from: number | null, now: number) => {
  if (from === null) return true;
  const at = iso ? Date.parse(iso) : NaN;
  return !Number.isNaN(at) && at >= from && at <= now;
};
const byCountThenLabel = (a: Row, b: Row) => b.count - a.count || a.label.localeCompare(b.label);

/** Maior N linhas; o resto vira "Outros" (some se não sobrar nada). */
export function topRows(rows: Row[], top: number): Row[] {
  const sorted = [...rows].sort(byCountThenLabel);
  if (sorted.length <= top) return sorted;
  const rest = sorted.slice(top);
  const cents = rest.some((r) => r.cents !== undefined) ? rest.reduce((n, r) => n + (r.cents ?? 0), 0) : undefined;
  return [...sorted.slice(0, top), { label: 'Outros', count: rest.reduce((n, r) => n + r.count, 0), cents }];
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const count = (map: Map<string, Row>, label: string, cents?: number) => {
  const row = map.get(label) ?? { label, count: 0, cents: cents === undefined ? undefined : 0 };
  row.count++;
  if (cents !== undefined) row.cents = (row.cents ?? 0) + cents;
  map.set(label, row);
};

// ---- Oportunidades ---------------------------------------------------------------------------------------------

/** Ganho por responsável no período: valor e contratos. `cents` é o valor ganho. */
export function wonByOwner(opps: Opportunity[], pipelines: Pipeline[], period: Period, now = new Date()): Row[] {
  const from = periodStart(period, now);
  const map = new Map<string, Row>();
  for (const o of opps) {
    if (o.isLead || stageInfo(o.stage, pipelines)?.kind !== 'WON') continue;
    if (!inWindow(o.wonAt, from, now.getTime())) continue;
    count(map, o.ownerName?.trim() || 'Sem responsável', toCents(o.value));
  }
  return [...map.values()].sort((a, b) => (b.cents ?? 0) - (a.cents ?? 0) || a.label.localeCompare(b.label));
}

/** Motivos das oportunidades perdidas, em todo o histórico (a API não guarda a data da perda). */
export function lostReasons(opps: Opportunity[], pipelines: Pipeline[]): Row[] {
  const map = new Map<string, Row>();
  for (const o of opps) {
    if (o.isLead || stageInfo(o.stage, pipelines)?.kind !== 'LOST') continue;
    count(map, o.lostReason?.trim() || 'Sem motivo', toCents(o.value));
  }
  return [...map.values()].sort(byCountThenLabel);
}

export type Cycle = { count: number; avgDays: number; medianDays: number };

/** Ciclo de venda: dias da criação até o ganho, das ganhas no período. */
export function salesCycle(opps: Opportunity[], pipelines: Pipeline[], period: Period, now = new Date()): Cycle {
  const from = periodStart(period, now);
  const days: number[] = [];
  for (const o of opps) {
    if (o.isLead || stageInfo(o.stage, pipelines)?.kind !== 'WON') continue;
    const won = o.wonAt ? Date.parse(o.wonAt) : NaN;
    const born = o.created_at ? Date.parse(o.created_at) : NaN;
    if (Number.isNaN(won) || Number.isNaN(born) || won < born || !inWindow(o.wonAt, from, now.getTime())) continue;
    days.push((won - born) / DAY);
  }
  return { count: days.length, avgDays: days.length ? days.reduce((a, b) => a + b, 0) / days.length : 0, medianDays: median(days) };
}

export type WinRate = { won: number; lost: number; rate: number };

/** Taxa de vitória: ganhas sobre (ganhas + perdidas), em todo o histórico. */
export function winRate(opps: Opportunity[], pipelines: Pipeline[]): WinRate {
  let won = 0;
  let lost = 0;
  for (const o of opps) {
    if (o.isLead) continue;
    const kind = stageInfo(o.stage, pipelines)?.kind;
    if (kind === 'WON') won++;
    else if (kind === 'LOST') lost++;
  }
  return { won, lost, rate: won + lost ? won / (won + lost) : 0 };
}

export const lostCents = (opps: Opportunity[], pipelines: Pipeline[]): number =>
  opps.reduce((n, o) => (!o.isLead && stageInfo(o.stage, pipelines)?.kind === 'LOST' ? n + toCents(o.value) : n), 0);

export type WeekPoint = { label: string; start: number; created: number; won: number };

/** Criadas e ganhas por semana, as últimas `weeks` semanas (semana começa na segunda), da mais antiga para a mais nova. */
export function weeklyTrend(opps: Opportunity[], pipelines: Pipeline[], weeks = 8, now = new Date()): WeekPoint[] {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monday = new Date(d.getTime() - ((d.getDay() + 6) % 7) * DAY);
  const points: WeekPoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - i * 7);
    points.push({ label: `${String(start.getDate()).padStart(2, '0')}/${String(start.getMonth() + 1).padStart(2, '0')}`, start: start.getTime(), created: 0, won: 0 });
  }
  const slot = (iso: string | null | undefined) => {
    const at = iso ? Date.parse(iso) : NaN;
    if (Number.isNaN(at) || at > now.getTime()) return undefined;
    for (let i = points.length - 1; i >= 0; i--) if (at >= points[i].start) return points[i];
    return undefined;
  };
  for (const o of opps) {
    if (o.isLead) continue;
    const c = slot(o.created_at);
    if (c) c.created++;
    if (stageInfo(o.stage, pipelines)?.kind === 'WON') {
      const w = slot(o.wonAt);
      if (w) w.won++;
    }
  }
  return points;
}

/** Valor em aberto por funil (centavos). */
export function openByPipeline(opps: Opportunity[], pipelines: Pipeline[]): Row[] {
  const map = new Map<string, Row>();
  for (const o of opps) {
    if (o.isLead || stageInfo(o.stage, pipelines)?.kind !== 'OPEN') continue;
    const name = pipelines.find((p) => p.stages.some((s) => s.id === o.stage))?.name ?? o.pipeline ?? 'Sem funil';
    count(map, name, toCents(o.value));
  }
  return [...map.values()].sort((a, b) => (b.cents ?? 0) - (a.cents ?? 0) || a.label.localeCompare(b.label));
}

// ---- Leads -----------------------------------------------------------------------------------------------------

export type FirstContact = { count: number; medianHours: number; within24h: number };

/** Tempo até o primeiro contato dos leads que entraram no período e já foram contatados. */
export function firstContact(leads: Lead[], period: Period, now = new Date()): FirstContact {
  const from = periodStart(period, now);
  const hours: number[] = [];
  for (const l of leads) {
    if (l.archivedAt || !l.firstContactAt || !inWindow(l.createdAt, from, now.getTime())) continue;
    const h = (Date.parse(l.firstContactAt) - Date.parse(l.createdAt)) / 3_600_000;
    if (!Number.isNaN(h) && h >= 0) hours.push(h);
  }
  return { count: hours.length, medianHours: median(hours), within24h: hours.length ? hours.filter((h) => h <= 24).length / hours.length : 0 };
}

/** Motivos de descarte dos leads descartados, em todo o histórico. */
export function discardReasons(leads: Lead[]): Row[] {
  const map = new Map<string, Row>();
  for (const l of leads) {
    if (l.archivedAt || l.status !== 'DISCARDED') continue;
    count(map, l.discardReason?.trim() || 'Sem motivo');
  }
  return [...map.values()].sort(byCountThenLabel);
}

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Leads do período por campanha (utm_campaign) ou, sem ela, pela fonte da UTM; senão "Sem campanha". */
export function leadCampaigns(leads: Lead[], period: Period, now = new Date()): Row[] {
  const from = periodStart(period, now);
  const map = new Map<string, Row>();
  for (const l of leads) {
    if (l.archivedAt || !inWindow(l.createdAt, from, now.getTime())) continue;
    const a = (l.customData?.attribution ?? {}) as Record<string, unknown>;
    const campaign = text(a.utm_campaign) || text(a.first_utm_campaign);
    const source = text(a.utm_source) || text(a.first_utm_source);
    count(map, campaign || (source ? `Fonte: ${source}` : 'Sem campanha'));
  }
  return [...map.values()].sort(byCountThenLabel);
}

// ---- Atividade e tarefas ---------------------------------------------------------------------------------------

/** Ações da equipe no período, por pessoa. */
export function activityByPerson(history: ChangeEntry[], period: Period, now = new Date()): Row[] {
  const from = periodStart(period, now);
  const map = new Map<string, Row>();
  for (const h of history) if (inWindow(h.at, from, now.getTime())) count(map, h.actor || 'Sistema');
  return [...map.values()].sort(byCountThenLabel);
}

export const KIND_LABEL: Record<ChangeEntry['kind'], string> = {
  create: 'Criações', edit: 'Edições', archive: 'Arquivamentos', restore: 'Restaurações', reveal: 'CPF revelado',
  lifecycle: 'Ciclo de vida', event: 'Eventos', qualify: 'Qualificações', discard: 'Descartes',
};

/** Ações do período por tipo. */
export function activityKinds(history: ChangeEntry[], period: Period, now = new Date()): Row[] {
  const from = periodStart(period, now);
  const map = new Map<string, Row>();
  for (const h of history) if (inWindow(h.at, from, now.getTime())) count(map, KIND_LABEL[h.kind] ?? h.kind);
  return [...map.values()].sort(byCountThenLabel);
}

export type DayPoint = { label: string; start: number; count: number };

/** Ações por dia, os últimos `days` dias (hoje por último). */
export function activityByDay(history: ChangeEntry[], days = 14, now = new Date()): DayPoint[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const points: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    points.push({ label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`, start: d.getTime(), count: 0 });
  }
  for (const h of history) {
    const at = Date.parse(h.at);
    if (Number.isNaN(at) || at > now.getTime()) continue;
    for (let i = points.length - 1; i >= 0; i--) if (at >= points[i].start) { points[i].count++; break; }
  }
  return points;
}

/** Quem revelou CPF no período (auditoria da LGPD), do mais recente para o mais antigo. */
export function cpfReveals(history: ChangeEntry[], period: Period, now = new Date(), limit = 5): { total: number; recent: ChangeEntry[] } {
  const from = periodStart(period, now);
  const all = history.filter((h) => h.kind === 'reveal' && inWindow(h.at, from, now.getTime())).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return { total: all.length, recent: all.slice(0, limit) };
}

/** Tarefas abertas por responsável (sem responsável = "Sem responsável"). */
export function openTasksByAssignee(tasks: TaskItem[]): Row[] {
  const map = new Map<string, Row>();
  for (const t of tasks) if (!t.done) count(map, t.assignee?.trim() || 'Sem responsável');
  return [...map.values()].sort(byCountThenLabel);
}

// ---- Comparação com o período anterior --------------------------------------------------------------------------

export type Windows = { from: number; to: number; prevFrom: number; prevTo: number };

/**
 * Período escolhido e o anterior, do mesmo tamanho: o mês até hoje contra o mesmo trecho do mês passado, 30/90 dias
 * contra os 30/90 dias de antes, o ano até hoje contra o mesmo trecho do ano passado. "Tudo" não tem anterior (null).
 */
export function periodWindows(period: Period, now = new Date()): Windows | null {
  const from = periodStart(period, now);
  if (from === null) return null;
  const to = now.getTime();
  const start = new Date(from);
  let prevFrom: number;
  if (period === 'month') prevFrom = new Date(start.getFullYear(), start.getMonth() - 1, 1).getTime();
  else if (period === 'year') prevFrom = new Date(start.getFullYear() - 1, 0, 1).getTime();
  else prevFrom = from - (to - from);
  return { from, to, prevFrom, prevTo: prevFrom + (to - from) };
}

/** Valor e quantidade de oportunidades ganhas com `wonAt` entre `from` e `to`. */
export function wonBetween(opps: Opportunity[], pipelines: Pipeline[], from: number, to: number): { cents: number; count: number } {
  let cents = 0;
  let n = 0;
  for (const o of opps) {
    if (o.isLead || stageInfo(o.stage, pipelines)?.kind !== 'WON') continue;
    const at = o.wonAt ? Date.parse(o.wonAt) : NaN;
    if (Number.isNaN(at) || at < from || at > to) continue;
    cents += toCents(o.value);
    n++;
  }
  return { cents, count: n };
}

/** Leads (não arquivados) criados entre `from` e `to`. */
export const leadsBetween = (leads: Lead[], from: number, to: number): number =>
  leads.filter((l) => !l.archivedAt && inWindow(l.createdAt, from, to)).length;

/** Variação em relação ao anterior: 0,25 = +25%. `null` quando não há base (anterior zerado). */
export const deltaPct = (cur: number, prev: number): number | null => (prev > 0 ? (cur - prev) / prev : null);
