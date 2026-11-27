import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ago, funnel, recentBuckets, series, unitFor } from '../src/lib/analyticsSeries.ts';
import type { Outcome } from '../src/lib/acquisitionMetrics.ts';

const DAY = 86_400_000;
const NOW = Date.parse('2026-11-27T12:00:00Z');
const iso = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();

const row = (id: string, daysAgo: number, extra: Partial<Outcome> = {}, lead: Record<string, unknown> = {}): Outcome => ({
  lead: { id, createdAt: iso(daysAgo), pipelineId: 'p', stageId: 'novos', status: 'ACTIVE', ...lead } as unknown as Outcome['lead'],
  channel: { key: 'x', label: 'X', group: 'direto' } as Outcome['channel'],
  qualified: false, hasOpp: false, pipelineCents: 0, won: false, wonCents: 0, lost: false, ...extra,
});

test('unidade do gráfico acompanha o tamanho do período', () => {
  assert.equal(unitFor(30 * DAY), 'day');
  assert.equal(unitFor(90 * DAY), 'week');
  assert.equal(unitFor(365 * DAY), 'month');
});

test('série soma por semana, o último ponto é o mais recente e o anterior alinha pela mesma distância', () => {
  const win = { from: NOW - 90 * DAY, to: NOW };
  const prevWin = { from: NOW - 180 * DAY, to: NOW - 90 * DAY };
  const { unit, points } = series([row('a', 1), row('b', 2), row('c', 80)], [row('d', 91)], win, prevWin, 'leads', NOW);
  assert.equal(unit, 'week');
  assert.equal(points.length, 13);
  assert.equal(points.at(-1)!.current, 2);
  assert.equal(points.at(-1)!.previous, 1);
  assert.equal(points.reduce((s, p) => s + p.current, 0), 3);
  assert.equal(points[0].start, win.from);
});

test('série em "Tudo" começa no lead mais antigo e não inventa período anterior', () => {
  const { points } = series([row('a', 20, { pipelineCents: 500 })], null, null, null, 'pipeline', NOW);
  assert.equal(points.reduce((s, p) => s + p.current, 0), 500);
  assert.ok(points.every((p) => p.previous === null));
});

test('funil conta quem chegou até a etapa, com perdidos só até a qualificação', () => {
  const pipeline = {
    id: 'p', name: 'P',
    stages: [
      { id: 'novos', name: 'Novos', kind: 'LEAD' }, { id: 'qual', name: 'Qualificação', kind: 'OPEN' },
      { id: 'prop', name: 'Proposta', kind: 'OPEN' }, { id: 'ganho', name: 'Ganho', kind: 'WON' }, { id: 'perdido', name: 'Perdido', kind: 'LOST' },
    ],
  } as unknown as Parameters<typeof funnel>[2];
  const opps = [
    { id: 'o2', stage: 'prop' }, { id: 'o3', stage: 'ganho' }, { id: 'o4', stage: 'perdido' },
  ] as unknown as Parameters<typeof funnel>[1];
  const rows = [
    row('a', 1),
    row('b', 1, { qualified: true, hasOpp: true }, { convertedOpportunityId: 'o2' }),
    row('c', 1, { qualified: true, hasOpp: true, won: true }, { convertedOpportunityId: 'o3' }),
    row('d', 1, { qualified: true, hasOpp: true, lost: true }, { convertedOpportunityId: 'o4' }),
    row('e', 1, {}, { pipelineId: 'outro' }),
  ];
  const f = funnel(rows, opps, pipeline);
  assert.equal(f.total, 4);
  assert.equal(f.lost, 1);
  assert.deepEqual(f.steps.map((s) => s.reached), [4, 3, 2, 1]);
  assert.deepEqual(f.steps.map((s) => s.here), [1, 0, 1, 1]);
});

test('faixas recentes ignoram o que ficou fora e o futuro', () => {
  const at = (min: number) => new Date(NOW - min * 60_000).toISOString();
  assert.deepEqual(recentBuckets([at(0.5), at(1.5), at(40), at(-5)], 3, 60_000, NOW), [0, 1, 1]);
});

test('tempo relativo em português', () => {
  assert.equal(ago(iso(0), NOW), 'agora');
  assert.equal(ago(new Date(NOW - 5 * 60_000).toISOString(), NOW), 'há 5 min');
  assert.equal(ago(iso(3), NOW), 'há 3 dias');
});
