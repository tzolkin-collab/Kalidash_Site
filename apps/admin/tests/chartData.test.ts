import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUCKETS, OTHERS, bucketStarts, isEmptyResult, quantile, runChart, topWithOthers } from '../src/lib/chartData.ts';
import type { BoxResult, ChartCtx, GoalResult, MatrixResult, PointsResult, RowsResult, SeriesResult, StackedResult, StagesResult, TreeResult } from '../src/lib/chartData.ts';
import { MEASURES, VISUALS, normalizeChart } from '../src/lib/chartSpec.ts';

const pipelines = [{
  id: 'p', name: 'Vendas', stages: [
    { id: 'p:q', name: 'Qualificação', kind: 'OPEN', color: '#f90' },
    { id: 'p:n', name: 'Negociação', kind: 'OPEN', color: '#90f' },
    { id: 'p:g', name: 'Ganho', kind: 'WON', color: '#0a0' },
    { id: 'p:l', name: 'Perdido', kind: 'LOST', color: '#a00' },
  ],
}] as never;

const now = new Date('2026-10-15T12:00:00'); // quinta
const opp = (stage: string, value: number, extra: object = {}) => ({ id: Math.random().toString(), title: 't', value, stage, priority: '', tags: [], ...extra }) as never;
const lead = (extra: object = {}) => ({ id: Math.random().toString(), name: 'l', email: 'a@b.c', status: 'ACTIVE', sourceName: 'Site — site-pagina-diagnostico', createdAt: '2026-10-14T10:00:00', tags: [], ...extra }) as never;
const ctx = (over: Partial<ChartCtx> = {}): ChartCtx => ({ opps: [], pipelines, leads: [], tasks: [], history: [], period: 'all', now, ...over });
const cfg = (raw: object) => normalizeChart(raw)!;

test('baldes de tempo: 30 dias terminam hoje; semanas começam na segunda', () => {
  const days = bucketStarts(now, 'day', 3);
  assert.deepEqual(days.map((d) => new Date(d).getDate()), [13, 14, 15]);
  const weeks = bucketStarts(now, 'week', 2);
  assert.deepEqual(weeks.map((d) => new Date(d).getDate()), [5, 12]); // segundas
});

test('série: soma por semana e compara com o período anterior alinhado', () => {
  const opps = [
    opp('p:g', 100, { wonAt: '2026-10-13T09:00:00' }), // semana atual (12/10)
    opp('p:g', 50, { wonAt: '2026-10-14T09:00:00' }),  // semana atual
    opp('p:g', 30, { wonAt: '2026-10-06T09:00:00' }),  // semana anterior (05/10)
    opp('p:g', 999, {}),                               // sem data: fora
    opp('p:q', 7, { wonAt: '2026-10-13T09:00:00' }),   // aberta: fora
  ];
  const r = runChart(cfg({ visual: 'line', measure: 'won-value', granularity: 'week', compare: true }), ctx({ opps })) as SeriesResult;
  assert.equal(r.kind, 'series');
  assert.equal(r.points.length, BUCKETS.week);
  const last = r.points[r.points.length - 1];
  assert.equal(last.label, '12/10');
  assert.equal(last.value, 150);
  assert.equal(r.points[r.points.length - 2].value, 30);
  assert.equal(last.prev, 0); // 12 semanas antes não tem nada
  assert.equal(r.hasPrev, true);
  const semComparar = runChart(cfg({ visual: 'line', measure: 'won-value' }), ctx({ opps })) as SeriesResult;
  assert.equal('prev' in semComparar.points[0], false);
});

test('série de contagem por dia e dinheiro em reais sem erro de ponto flutuante', () => {
  const opps = [opp('p:g', 0.1, { wonAt: '2026-10-15T08:00:00' }), opp('p:g', 0.2, { wonAt: '2026-10-15T09:00:00' })];
  const r = runChart(cfg({ visual: 'columns', measure: 'won-value', granularity: 'day' }), ctx({ opps })) as SeriesResult;
  assert.equal(r.points[r.points.length - 1].value, 0.3);
  const c = runChart(cfg({ visual: 'columns', measure: 'won-count', granularity: 'day' }), ctx({ opps })) as SeriesResult;
  assert.equal(c.points[c.points.length - 1].value, 2);
});

test('barras: ranking por responsável com "Outros" no corte', () => {
  const o = (owner: string, v: number) => opp('p:g', v, { ownerName: owner, wonAt: '2026-10-10T10:00:00' });
  const opps = [o('Ana', 500), o('Bia', 400), o('Caio', 300), o('Davi', 200), o('Eva', 100)];
  const r = runChart(cfg({ visual: 'bars', measure: 'won-value', dimension: 'owner', topN: 3 }), ctx({ opps })) as RowsResult;
  assert.deepEqual(r.rows.map((x) => [x.label, x.value]), [['Ana', 500], ['Bia', 400], ['Caio', 300], [OTHERS, 300]]);
  assert.equal(r.total, 1500);
});

test('rosca de medida com data respeita o período da Dashboard; sem data, não', () => {
  const opps = [
    opp('p:g', 10, { ownerName: 'Ana', wonAt: '2026-10-05T10:00:00' }),
    opp('p:g', 90, { ownerName: 'Ana', wonAt: '2026-08-05T10:00:00' }),
    opp('p:q', 40, { ownerName: 'Bia' }),
  ];
  const ganho = runChart(cfg({ visual: 'donut', measure: 'won-value', dimension: 'owner' }), ctx({ opps, period: 'month' })) as RowsResult;
  assert.deepEqual(ganho.rows, [{ label: 'Ana', value: 10 }]);
  const aberto = runChart(cfg({ visual: 'donut', measure: 'open-value', dimension: 'owner' }), ctx({ opps, period: 'month' })) as RowsResult;
  assert.deepEqual(aberto.rows, [{ label: 'Bia', value: 40 }]);
});

test('cortes: motivo de perda; descarte só conta leads descartados; origem usa o nome curto', () => {
  const opps = [opp('p:l', 100, { lostReason: 'Timing' }), opp('p:l', 50, { lostReason: 'Timing' }), opp('p:l', 5)];
  const lost = runChart(cfg({ visual: 'bars', measure: 'lost-value', dimension: 'reason' }), ctx({ opps })) as RowsResult;
  assert.deepEqual(lost.rows.map((r) => [r.label, r.value]), [['Timing', 150], ['Sem motivo', 5]]);
  const leads = [lead({ status: 'DISCARDED', discardReason: 'Sem fit' }), lead(), lead({ archivedAt: 'x' })];
  const disc = runChart(cfg({ visual: 'bars', measure: 'leads-created', dimension: 'reason' }), ctx({ leads })) as RowsResult;
  assert.deepEqual(disc.rows, [{ label: 'Sem fit', value: 1 }]);
  const src = runChart(cfg({ visual: 'donut', measure: 'leads-created', dimension: 'source' }), ctx({ leads })) as RowsResult;
  assert.equal(src.rows[0].label, 'Site — diagnostico');
  assert.equal(src.rows[0].value, 2);
});

test('colunas empilhadas: grupos por total, "Outros" no resto', () => {
  const h = (actor: string, at: string) => ({ id: Math.random().toString(), at, actor, entity: 'lead', entityId: '1', entityName: 'x', kind: 'edit' }) as never;
  const history = [h('Ana', '2026-10-15T09:00:00'), h('Ana', '2026-10-15T10:00:00'), h('Bia', '2026-10-15T11:00:00'), h('Caio', '2026-10-14T11:00:00')];
  const r = runChart(cfg({ visual: 'stacked', measure: 'actions', stackBy: 'actor', granularity: 'day', topN: 3 }), ctx({ history })) as StackedResult;
  assert.deepEqual(r.groups, ['Ana', 'Bia', 'Caio']);
  const today = r.points[r.points.length - 1];
  assert.equal(today.Ana, 2);
  assert.equal(today.Bia, 1);
  const r2 = runChart({ ...cfg({ visual: 'stacked', measure: 'actions', stackBy: 'actor', granularity: 'day' }), topN: 3 }, ctx({ history: [...history, h('Davi', '2026-10-15T12:00:00')] })) as StackedResult;
  assert.equal(r2.groups[r2.groups.length - 1], OTHERS);
});

test('funil: etapas do primeiro funil ativo na ordem, sem perdidas; valor e contagem', () => {
  const opps = [opp('p:q', 100), opp('p:q', 50), opp('p:n', 70), opp('p:g', 10), opp('p:l', 999)];
  const n = runChart(cfg({ visual: 'funnel', measure: 'stage-count' }), ctx({ opps })) as StagesResult;
  assert.deepEqual(n.rows.map((r) => [r.label, r.value]), [['Qualificação', 2], ['Negociação', 1], ['Ganho', 1]]);
  const v = runChart(cfg({ visual: 'funnel', measure: 'stage-value' }), ctx({ opps })) as StagesResult;
  assert.deepEqual(v.rows.map((r) => r.value), [150, 70, 10]);
});

test('"Outros" some quando cabe tudo; ordem estável em empate', () => {
  assert.deepEqual(topWithOthers([{ label: 'b', value: 1 }, { label: 'a', value: 1 }], 3).map((r) => r.label), ['a', 'b']);
});

test('toda combinação visual × medida compatível roda sem erro e devolve o formato certo', () => {
  const shapeKind = { series: 'series', stacked: 'stacked', parts: 'rows', ranking: 'rows', stages: 'stages', hierarchy: 'tree', matrix: 'matrix', points: 'points', distribution: 'box', goal: 'goal' } as const;
  for (const v of VISUALS) {
    for (const m of MEASURES) {
      const c = normalizeChart({ visual: v.id, measure: m.id });
      if (!c || c.measure !== m.id) continue; // incompatível: a normalização troca a medida
      assert.equal(runChart(c, ctx()).kind, shapeKind[v.shape], `${v.id} × ${m.id}`);
    }
  }
});

test('resultado vazio: tudo zero ou sem grupos', () => {
  assert.equal(isEmptyResult(runChart(cfg({ visual: 'line', measure: 'won-value' }), ctx())), true);
  assert.equal(isEmptyResult(runChart(cfg({ visual: 'bars', measure: 'won-value', dimension: 'owner' }), ctx())), true);
  assert.equal(isEmptyResult(runChart(cfg({ visual: 'funnel', measure: 'stage-count' }), ctx())), true);
  assert.equal(isEmptyResult(runChart(cfg({ visual: 'funnel', measure: 'stage-count' }), ctx({ opps: [opp('p:q', 1)] }))), false);
});

test('quantil por interpolação linear', () => {
  assert.equal(quantile([1, 2, 3, 4], 0.5), 2.5);
  assert.equal(quantile([10], 0.25), 10);
  assert.equal(quantile([], 0.5), 0);
  assert.equal(quantile([0, 10], 0.25), 2.5);
});

test('treemap e sunburst: dois níveis, primeiro nível com "Outros", filhos por total', () => {
  const leads = [
    lead({ customData: { attribution: { utm_campaign: 'a' } } }), lead({ customData: { attribution: { utm_campaign: 'a' } } }),
    lead({ customData: { attribution: { utm_campaign: 'b' } } }), lead({ sourceName: 'Cadastro manual' }),
  ];
  const r = runChart(cfg({ visual: 'treemap', measure: 'leads-created', dimension: 'source', dimension2: 'campaign', topN: 3 }), ctx({ leads })) as TreeResult;
  assert.equal(r.kind, 'tree');
  assert.equal(r.total, 4);
  const site = r.nodes.find((n) => n.name === 'Site — diagnostico')!;
  assert.equal(site.value, 3);
  assert.deepEqual(site.children.map((k) => [k.name, k.value]), [['a', 2], ['b', 1]]);
});

test('mapa de calor: dia da semana (segunda = 0) × hora; respeita o período', () => {
  const history = [
    { id: '1', at: '2026-10-15T09:10:00', actor: 'A', entity: 'lead', entityId: '1', entityName: 'x', kind: 'edit' },
    { id: '2', at: '2026-10-15T09:50:00', actor: 'A', entity: 'lead', entityId: '1', entityName: 'x', kind: 'edit' },
    { id: '3', at: '2026-10-11T22:00:00', actor: 'A', entity: 'lead', entityId: '1', entityName: 'x', kind: 'edit' }, // domingo
    { id: '4', at: '2026-08-01T10:00:00', actor: 'A', entity: 'lead', entityId: '1', entityName: 'x', kind: 'edit' }, // fora do mês
  ] as never;
  const r = runChart(cfg({ visual: 'heatmap', measure: 'actions' }), ctx({ history, period: 'month' })) as MatrixResult;
  assert.equal(r.cells.length, 7);
  assert.equal(r.cells[3][9], 2); // quinta 09h
  assert.equal(r.cells[6][22], 1); // domingo 22h
  assert.equal(r.total, 3);
  assert.equal(r.max, 2);
});

test('radial: valor do período contra a meta', () => {
  const opps = [opp('p:g', 3000, { wonAt: '2026-10-05T10:00:00' }), opp('p:g', 2000, { wonAt: '2026-10-06T10:00:00' }), opp('p:g', 9000, { wonAt: '2026-08-06T10:00:00' })];
  const r = runChart(cfg({ visual: 'radial', measure: 'won-value', goal: 10000 }), ctx({ opps, period: 'month' })) as GoalResult;
  assert.deepEqual([r.value, r.goal, r.rate], [5000, 10000, 0.5]);
  assert.equal(isEmptyResult(runChart(cfg({ visual: 'radial', measure: 'won-value', goal: 10 }), ctx())), false);
});

test('dispersão e box plot: só ganhas com as duas datas; quartis por responsável', () => {
  const won = (owner: string, days: number, value: number) => opp('p:g', value, { ownerName: owner, title: `${owner}${days}`, created_at: '2026-09-01T00:00:00', wonAt: new Date(Date.parse('2026-09-01T00:00:00') + days * 86_400_000).toISOString() });
  const opps = [won('Ana', 2, 100), won('Ana', 4, 200), won('Ana', 10, 300), won('Bia', 5, 50), opp('p:g', 1, {}), opp('p:q', 1, { created_at: '2026-09-01T00:00:00' })];
  const pts = runChart(cfg({ visual: 'scatter', measure: 'deal-scatter' }), ctx({ opps })) as PointsResult;
  assert.equal(pts.points.length, 4);
  assert.deepEqual(pts.points.find((p) => p.label === 'Ana4'), { x: 4, y: 200, label: 'Ana4' });
  const box = runChart(cfg({ visual: 'boxplot', measure: 'close-days', dimension: 'owner' }), ctx({ opps })) as BoxResult;
  assert.equal(box.unit, 'days');
  const ana = box.rows.find((r) => r.label === 'Ana')!;
  assert.deepEqual([ana.n, ana.min, ana.median, ana.max], [3, 2, 4, 10]);
  assert.equal(ana.q1, 3);
  assert.equal(ana.q3, 7);
  assert.equal(box.rows[0].label, 'Ana'); // mais registros primeiro
});
