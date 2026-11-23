import type { ChangeEntry, Lead, Pipeline, TaskItem } from '../domain.ts';
import type { Opportunity } from '../types.ts';
import { KIND_LABEL } from './commercialMetrics.ts';
import { periodStart, stageInfo, toCents } from './salesMetrics.ts';
import type { Period } from './salesMetrics.ts';
import { shortSource } from './sourceName.ts';
import { activePipelines, kanbanStages, resolveStage } from './stages.ts';
import { MEASURE_BY_ID, VISUAL_BY_ID } from './chartSpec.ts';
import type { ChartConfig, DimId, MeasureId, Unit } from './chartSpec.ts';

// Motor dos gráficos configuráveis: recebe a configuração (lib/chartSpec.ts) e os dados do CRM e devolve o
// resultado no formato que o visual pede. Puro e testado em tests/chartData.test.ts. Valores em reais (dinheiro)
// ou unidades (contagem); as somas são feitas em centavos para não acumular erro de ponto flutuante.

export type ChartCtx = { opps: Opportunity[]; pipelines: Pipeline[]; leads: Lead[]; tasks: TaskItem[]; history: ChangeEntry[]; period: Period; now?: Date };

export type SeriesPoint = { label: string; value: number; prev?: number };
export type SeriesResult = { kind: 'series'; unit: Unit; points: SeriesPoint[]; hasPrev: boolean; total: number };
export type StackedResult = { kind: 'stacked'; unit: Unit; groups: string[]; points: ({ label: string } & Record<string, number | string>)[] };
export type Row = { label: string; value: number };
export type RowsResult = { kind: 'rows'; unit: Unit; rows: Row[]; total: number };
export type StageRow = { label: string; value: number; color: string };
export type StagesResult = { kind: 'stages'; unit: Unit; rows: StageRow[] };
export type ChartResult = SeriesResult | StackedResult | RowsResult | StagesResult;

const DAY = 86_400_000;
export const OTHERS = 'Outros';

/** Um registro já traduzido: quando aconteceu (ms ou null), quanto vale (centavos ou 1) e os cortes. */
type Rec = { at: number | null; v: number; d: Partial<Record<DimId, string | null>> };

const ts = (iso: string | null | undefined) => {
  const at = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(at) ? null : at;
};
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

function oppRecs(c: ChartCtx, keep: (kind: string | undefined) => boolean, date: (o: Opportunity) => number | null, money: boolean): Rec[] {
  const out: Rec[] = [];
  for (const o of c.opps) {
    if (o.isLead) continue;
    const kind = stageInfo(o.stage, c.pipelines)?.kind;
    if (!keep(kind)) continue;
    const r = resolveStage(o, c.pipelines);
    out.push({
      at: date(o),
      v: money ? toCents(o.value) : 1,
      d: {
        owner: o.ownerName?.trim() || 'Sem responsável',
        pipeline: r.pipeline?.name ?? o.pipeline ?? 'Sem funil',
        stage: r.stage?.name ?? 'Sem etapa',
        reason: o.lostReason?.trim() || 'Sem motivo',
      },
    });
  }
  return out;
}

const STATUS_LABEL = { ACTIVE: 'Ativo', QUALIFIED: 'Qualificado', DISCARDED: 'Descartado' } as const;
const TASK_SOURCE = { manual: 'Manual', passo: 'Passo do ciclo', requisito: 'Requisito' } as const;

function records(id: MeasureId, c: ChartCtx): Rec[] {
  switch (id) {
    case 'won-value': return oppRecs(c, (k) => k === 'WON', (o) => ts(o.wonAt), true);
    case 'won-count': return oppRecs(c, (k) => k === 'WON', (o) => ts(o.wonAt), false);
    case 'opp-created': return oppRecs(c, (k) => k !== undefined && k !== 'LEAD', (o) => ts(o.created_at), false);
    case 'open-value': return oppRecs(c, (k) => k === 'OPEN', () => null, true);
    case 'lost-value': return oppRecs(c, (k) => k === 'LOST', () => null, true);
    case 'lost-count': return oppRecs(c, (k) => k === 'LOST', () => null, false);
    case 'leads-created':
      return c.leads.filter((l) => !l.archivedAt).map((l) => {
        const a = (l.customData?.attribution ?? {}) as Record<string, unknown>;
        const camp = text(a.utm_campaign) || text(a.first_utm_campaign);
        const src = text(a.utm_source) || text(a.first_utm_source);
        return {
          at: ts(l.createdAt), v: 1,
          d: {
            source: l.sourceName ? shortSource(l.sourceName) : 'Sem fonte',
            campaign: camp || (src ? `Fonte: ${src}` : 'Sem campanha'),
            status: STATUS_LABEL[l.status] ?? l.status,
            reason: l.status === 'DISCARDED' ? l.discardReason?.trim() || 'Sem motivo' : null,
          },
        };
      });
    case 'tasks-open':
    case 'tasks-done': {
      const done = id === 'tasks-done';
      return c.tasks.filter((t) => t.done === done).map((t) => ({
        at: done ? ts(t.doneAt) : null, v: 1,
        d: { assignee: t.assignee?.trim() || 'Sem responsável', tag: t.tag?.trim() || 'Sem tag', source: TASK_SOURCE[t.source] ?? t.source },
      }));
    }
    case 'actions':
      return c.history.map((h) => ({ at: ts(h.at), v: 1, d: { actor: h.actor || 'Sistema', action: KIND_LABEL[h.kind] ?? h.kind } }));
    case 'stage-count':
    case 'stage-value': return []; // as etapas têm caminho próprio (stagesResult)
  }
}

const toUnit = (n: number, unit: Unit) => (unit === 'money' ? n / 100 : n);

// ---- Baldes de tempo -------------------------------------------------------------------------------------------

/** Início de cada balde (dia ou semana de segunda), do mais antigo ao mais novo, terminando no atual. */
export function bucketStarts(now: Date, granularity: 'day' | 'week', count: number): number[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const anchor = granularity === 'day' ? today : new Date(today.getTime() - ((today.getDay() + 6) % 7) * DAY);
  const step = granularity === 'day' ? 1 : 7;
  const out: number[] = [];
  for (let i = count - 1; i >= 0; i--) out.push(new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - i * step).getTime());
  return out;
}

const bucketIndex = (starts: number[], at: number, now: number) => {
  if (at > now) return -1;
  for (let i = starts.length - 1; i >= 0; i--) if (at >= starts[i]) return i;
  return -1;
};

const label = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/** Quantos baldes cada granularidade mostra. */
export const BUCKETS = { day: 30, week: 12 } as const;

/** Junta o resto em "Outros" mantendo os `top` maiores. */
export function topWithOthers<T extends { label: string; value: number }>(rows: T[], top: number): { label: string; value: number }[] {
  const sorted = [...rows].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  if (sorted.length <= top) return sorted.map((r) => ({ label: r.label, value: r.value }));
  const rest = sorted.slice(top).reduce((n, r) => n + r.value, 0);
  return [...sorted.slice(0, top).map((r) => ({ label: r.label, value: r.value })), { label: OTHERS, value: rest }];
}

// ---- Resultado -------------------------------------------------------------------------------------------------

export function runChart(cfg: ChartConfig, c: ChartCtx): ChartResult {
  const meta = MEASURE_BY_ID.get(cfg.measure)!;
  const shape = VISUAL_BY_ID.get(cfg.visual)!.shape;
  const now = c.now ?? new Date();
  const nowMs = now.getTime();
  const unit = meta.unit;

  if (shape === 'stages') return stagesResult(cfg.measure, c, unit);

  const recs = records(cfg.measure, c);

  if (shape === 'series') {
    const n = BUCKETS[cfg.granularity];
    const starts = bucketStarts(now, cfg.granularity, n * 2);
    const sums = new Array<number>(starts.length).fill(0);
    for (const r of recs) {
      if (r.at === null) continue;
      const i = bucketIndex(starts, r.at, nowMs);
      if (i >= 0) sums[i] += r.v;
    }
    const points: SeriesPoint[] = starts.slice(n).map((s, i) => ({ label: label(s), value: toUnit(sums[n + i], unit), ...(cfg.compare ? { prev: toUnit(sums[i], unit) } : {}) }));
    return { kind: 'series', unit, points, hasPrev: cfg.compare, total: points.reduce((a, p) => a + p.value, 0) };
  }

  if (shape === 'stacked') {
    const dim = cfg.stackBy!;
    const n = BUCKETS[cfg.granularity];
    const starts = bucketStarts(now, cfg.granularity, n);
    const byGroup = new Map<string, number[]>();
    for (const r of recs) {
      const g = r.d[dim];
      if (r.at === null || g == null) continue;
      const i = bucketIndex(starts, r.at, nowMs);
      if (i < 0) continue;
      const arr = byGroup.get(g) ?? new Array<number>(n).fill(0);
      arr[i] += r.v;
      byGroup.set(g, arr);
    }
    const ranked = [...byGroup.entries()].map(([g, arr]) => ({ g, arr, total: arr.reduce((a, b) => a + b, 0) })).sort((a, b) => b.total - a.total || a.g.localeCompare(b.g));
    const keep = ranked.slice(0, cfg.topN);
    const rest = ranked.slice(cfg.topN);
    const groups = keep.map((k) => k.g);
    if (rest.length) groups.push(OTHERS);
    const points = starts.map((s, i) => {
      const p: { label: string } & Record<string, number | string> = { label: label(s) };
      for (const k of keep) p[k.g] = toUnit(k.arr[i], unit);
      if (rest.length) p[OTHERS] = toUnit(rest.reduce((a, k) => a + k.arr[i], 0), unit);
      return p;
    });
    return { kind: 'stacked', unit, groups, points };
  }

  // parts / ranking: um corte, no período da Dashboard quando a medida tem data
  const dim = cfg.dimension!;
  const from = meta.hasDate ? periodStart(c.period, now) : null;
  const sums = new Map<string, number>();
  for (const r of recs) {
    const g = r.d[dim];
    if (g == null) continue;
    if (from !== null && (r.at === null || r.at < from || r.at > nowMs)) continue;
    sums.set(g, (sums.get(g) ?? 0) + r.v);
  }
  const rows = topWithOthers([...sums.entries()].map(([label, v]) => ({ label, value: toUnit(v, unit) })), cfg.topN);
  return { kind: 'rows', unit, rows, total: rows.reduce((a, r) => a + r.value, 0) };
}

function stagesResult(id: MeasureId, c: ChartCtx, unit: Unit): StagesResult {
  const pipeline = activePipelines(c.pipelines)[0];
  const stages = kanbanStages(pipeline).filter((s) => s.kind !== 'LOST');
  const money = id === 'stage-value';
  const sums = new Map<string, number>();
  for (const o of c.opps) {
    if (o.isLead) continue;
    const r = resolveStage(o, c.pipelines);
    if (!r.stage || r.pipeline?.id !== pipeline?.id) continue;
    sums.set(r.stage.id, (sums.get(r.stage.id) ?? 0) + (money ? toCents(o.value) : 1));
  }
  return { kind: 'stages', unit, rows: stages.map((s) => ({ label: s.name, value: toUnit(sums.get(s.id) ?? 0, unit), color: s.color })) };
}

/** Resultado sem nada para mostrar (tudo zero ou vazio): o visual mostra o estado vazio em vez de um gráfico em branco. */
export function isEmptyResult(r: ChartResult): boolean {
  switch (r.kind) {
    case 'series': return r.points.every((p) => !p.value && !p.prev);
    case 'stacked': return r.groups.length === 0;
    case 'rows': return r.rows.length === 0 || r.total === 0;
    case 'stages': return r.rows.every((x) => !x.value);
  }
}
