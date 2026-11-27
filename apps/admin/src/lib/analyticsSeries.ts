import type { Pipeline } from '../domain.ts';
import type { Opportunity } from '../types.ts';
import type { Outcome, Window } from './acquisitionMetrics.ts';

// Séries no tempo, funil por etapa e tempo real da área Analytics. Sem React (testado em tests/analyticsSeries.test.ts).

const DAY = 86_400_000;

export type MetricId = 'pipeline' | 'revenue' | 'leads' | 'qualified';

export const METRICS: { id: MetricId; label: string; money: boolean }[] = [
  { id: 'pipeline', label: 'Pipeline gerado', money: true },
  { id: 'revenue', label: 'Receita ganha', money: true },
  { id: 'leads', label: 'Leads', money: false },
  { id: 'qualified', label: 'Qualificados', money: false },
];

/** Quanto um lead soma na métrica (dinheiro em centavos). */
export const metricValue = (o: Outcome, m: MetricId): number =>
  m === 'pipeline' ? o.pipelineCents : m === 'revenue' ? o.wonCents : m === 'qualified' ? (o.qualified ? 1 : 0) : 1;

export type Unit = 'day' | 'week' | 'month';
const SIZE: Record<Unit, number> = { day: DAY, week: 7 * DAY, month: 30 * DAY };
export const unitFor = (span: number): Unit => (span <= 35 * DAY ? 'day' : span <= 200 * DAY ? 'week' : 'month');

export type Point = { start: number; end: number; current: number; previous: number | null };

/**
 * Soma a métrica por dia, semana ou mês, pela data de ENTRADA do lead (mesma coorte do resto do Analytics). Os blocos
 * são contados a partir do fim da janela, para o último ponto ser sempre um período cheio; o primeiro pode ser parcial.
 * O período anterior é alinhado bloco a bloco (mesma distância do fim da janela dele).
 */
export function series(rows: Outcome[], prevRows: Outcome[] | null, win: Window, prevWin: Window, metric: MetricId, now = Date.now()): { unit: Unit; points: Point[] } {
  const to = win ? Math.min(win.to, now) : now;
  const from = win ? win.from : rows.reduce((m, o) => Math.min(m, Date.parse(o.lead.createdAt) || m), to);
  const span = Math.max(to - from, DAY);
  const unit = unitFor(span);
  const size = SIZE[unit];
  // Em "Tudo" a janela começa exatamente no lead mais antigo: um bloco a mais, para ele não ficar de fora.
  const n = win ? Math.max(1, Math.ceil(span / size)) : Math.floor(span / size) + 1;
  const sum = (list: Outcome[], end: number) => {
    const out = Array<number>(n).fill(0);
    for (const o of list) {
      const back = Math.floor((end - Date.parse(o.lead.createdAt)) / size);
      if (back >= 0 && back < n) out[n - 1 - back] += metricValue(o, metric);
    }
    return out;
  };
  const cur = sum(rows, to);
  const prev = prevRows && prevWin ? sum(prevRows, prevWin.to) : null;
  const points = cur.map((current, i) => {
    const end = to - (n - 1 - i) * size;
    return { start: Math.max(from, end - size), end, current, previous: prev ? prev[i] : null };
  });
  return { unit, points };
}

export type FunnelStep = { id: string; name: string; reached: number; here: number; cents: number };
export type Funnel = { steps: FunnelStep[]; total: number; lost: number };

/**
 * Funil de um pipeline para a coorte. O CRM guarda a etapa ATUAL, não o caminho: "chegou até" = está nesta etapa ou
 * depois. Quem se perdeu (oportunidade perdida) conta só até a primeira etapa de oportunidade; lead descartado conta
 * até a etapa de lead em que parou.
 */
export function funnel(rows: Outcome[], opps: Opportunity[], pipeline: Pipeline): Funnel {
  const stages = pipeline.stages.filter((s) => s.kind !== 'LOST');
  const index = new Map(stages.map((s, i) => [s.id, i]));
  const firstOpen = Math.max(0, stages.findIndex((s) => s.kind !== 'LEAD'));
  const byId = new Map(opps.map((o) => [o.id, o]));
  const byLead = new Map(opps.filter((o) => o.leadId).map((o) => [o.leadId as string, o]));
  const steps = stages.map((s) => ({ id: s.id, name: s.name, reached: 0, here: 0, cents: 0 }));
  let total = 0;
  let lost = 0;
  for (const o of rows) {
    const lead = o.lead;
    if (lead.pipelineId !== pipeline.id || !steps.length) continue;
    total++;
    const opp = (lead.convertedOpportunityId && byId.get(lead.convertedOpportunityId)) || byLead.get(lead.id);
    let pos: number;
    if (o.won) pos = steps.length - 1;
    else if (o.hasOpp && opp) pos = index.get(opp.stage) ?? firstOpen;
    else if (o.qualified) pos = firstOpen;
    else pos = index.get(lead.stageId) ?? 0;
    const dropped = o.lost || lead.status === 'DISCARDED';
    if (dropped) lost++;
    else steps[pos].here++;
    for (let i = 0; i <= pos; i++) { steps[i].reached++; steps[i].cents += o.pipelineCents; }
  }
  return { steps, total, lost };
}

/** Contagem por faixa de tempo terminando agora (a última faixa é a mais recente). */
export function recentBuckets(dates: string[], count: number, size: number, now = Date.now()): number[] {
  const out = Array<number>(count).fill(0);
  for (const iso of dates) {
    const back = Math.floor((now - Date.parse(iso)) / size);
    if (back >= 0 && back < count) out[count - 1 - back]++;
  }
  return out;
}

export function ago(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86_400) return `há ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86_400);
  return d === 1 ? 'há 1 dia' : `há ${d} dias`;
}
