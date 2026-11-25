import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CATEGORIES, MEASURES, VISUALS, chartTitle, compatibleMeasures, measureSupports, normalizeChart, withVisual } from '../src/lib/chartSpec.ts';
import type { ChartConfig } from '../src/lib/chartSpec.ts';

test('todo visual tem categoria existente, id único e ao menos uma medida compatível', () => {
  assert.equal(new Set(VISUALS.map((v) => v.id)).size, VISUALS.length);
  for (const v of VISUALS) {
    assert.ok(CATEGORIES.some((c) => c.id === v.category), v.id);
    assert.ok(compatibleMeasures(v.id).length > 0, `${v.id} sem medida compatível`);
  }
});

test('toda medida serve a pelo menos um formato', () => {
  for (const m of MEASURES) {
    const ok = (['series', 'stacked', 'parts', 'ranking', 'stages', 'hierarchy', 'matrix', 'points', 'distribution', 'goal'] as const).some((s) => measureSupports(m, s));
    assert.ok(ok, `${m.id} não serve a nenhum visual`);
  }
});

test('compatibilidade: série pede data; rosca pede corte; funil só lê etapas', () => {
  const ids = (v: Parameters<typeof compatibleMeasures>[0]) => compatibleMeasures(v).map((m) => m.id);
  assert.ok(ids('line').includes('won-value') && !ids('line').includes('open-value') && !ids('line').includes('stage-count'));
  assert.ok(ids('donut').includes('open-value') && !ids('donut').includes('stage-value'));
  assert.deepEqual(ids('funnel'), ['stage-count', 'stage-value']);
});

test('normalizar: troca o que ficou incompatível e zera o que o visual não usa', () => {
  const c = normalizeChart({ visual: 'line', measure: 'open-value', dimension: 'owner', stackBy: 'owner', compare: true, granularity: 'day' })!;
  assert.notEqual(c.measure, 'open-value'); // linha não lê medida sem data
  assert.equal(c.dimension, undefined);
  assert.equal(c.stackBy, undefined);
  assert.equal(c.compare, true);
  assert.equal(c.granularity, 'day');
  const d = normalizeChart({ visual: 'donut', measure: 'tasks-open', dimension: 'inexistente', compare: true, topN: 99 })!;
  assert.equal(d.dimension, 'assignee'); // primeiro corte válido da medida
  assert.equal(d.compare, false);
  assert.equal(d.topN, 6);
});

test('normalizar: lixo vira null; título é limpo e cortado', () => {
  assert.equal(normalizeChart(null), null);
  assert.equal(normalizeChart({ visual: 'nada' }), null);
  assert.equal(normalizeChart({ visual: 'bars', measure: 'won-value', title: '   ' })!.title, undefined);
  assert.equal(normalizeChart({ visual: 'bars', measure: 'won-value', title: 'x'.repeat(100) })!.title!.length, 60);
});

test('trocar o visual mantém a medida quando ela serve e troca quando não serve', () => {
  const bars = normalizeChart({ visual: 'bars', measure: 'lost-value', dimension: 'reason' }) as ChartConfig;
  assert.equal(withVisual(bars, 'donut').measure, 'lost-value');
  assert.equal(withVisual(bars, 'donut').dimension, 'reason');
  assert.notEqual(withVisual(bars, 'line').measure, 'lost-value'); // sem data
  assert.equal(withVisual(bars, 'funnel').measure, 'stage-count');
});

test('título automático descreve medida e corte', () => {
  assert.equal(chartTitle(normalizeChart({ visual: 'bars', measure: 'won-value', dimension: 'owner' })!), 'Valor ganho por responsável');
  assert.equal(chartTitle(normalizeChart({ visual: 'line', measure: 'leads-created', granularity: 'day' })!), 'Leads novos por dia');
  assert.equal(chartTitle(normalizeChart({ visual: 'funnel', measure: 'stage-value' })!), 'Funil · Valor por etapa');
  assert.equal(chartTitle(normalizeChart({ visual: 'bars', measure: 'won-value', title: 'Meu gráfico' })!), 'Meu gráfico');
});

test('novos formatos: dispersão e box plot só leem as próprias medidas; treemap pede 2 cortes; heatmap e radial pedem data', () => {
  const ids = (v: Parameters<typeof compatibleMeasures>[0]) => compatibleMeasures(v).map((m) => m.id);
  assert.deepEqual(ids('scatter'), ['deal-scatter']);
  assert.deepEqual(ids('boxplot'), ['close-days']);
  assert.ok(!ids('donut').includes('close-days') && !ids('line').includes('deal-scatter'));
  assert.ok(ids('treemap').includes('leads-created') && ids('treemap').includes('won-value')); // 2 ou mais cortes
  assert.ok(!ids('treemap').includes('stage-count') && !ids('treemap').includes('close-days'));
  assert.ok(ids('heatmap').every((m) => compatibleMeasures('line').some((x) => x.id === m))); // as duas pedem data
});

test('treemap: segundo nível diferente do primeiro; radial ganha meta padrão por unidade', () => {
  const t = normalizeChart({ visual: 'treemap', measure: 'leads-created', dimension: 'source', dimension2: 'source' })!;
  assert.equal(t.dimension, 'source');
  assert.notEqual(t.dimension2, 'source');
  assert.ok(t.dimension2);
  assert.equal(normalizeChart({ visual: 'radial', measure: 'won-value' })!.goal, 10000);
  assert.equal(normalizeChart({ visual: 'radial', measure: 'leads-created', goal: 40 })!.goal, 40);
  assert.equal(normalizeChart({ visual: 'radial', measure: 'leads-created', goal: -5 })!.goal, 10);
  assert.equal(normalizeChart({ visual: 'bars', measure: 'won-value' })!.goal, undefined);
});
