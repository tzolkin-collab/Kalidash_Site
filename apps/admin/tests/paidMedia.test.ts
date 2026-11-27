import { test } from 'node:test';
import assert from 'node:assert/strict';
import { METRICS, byLevel, creativeGroups, creativeName, csvCell, inPeriod, mergeAds, periodDays, sum } from '../src/lib/paidMedia.ts';
import { paidSample } from '../src/lib/paidSample.ts';

const NOW = new Date(2026, 10, 27, 12);
const PAID_SAMPLE = paidSample(NOW);

test('repartir por dia mantém os totais dos 30 dias', () => {
  assert.equal(sum(PAID_SAMPLE).spend, 490500);
  assert.equal(sum(PAID_SAMPLE).leads, 34);
  assert.equal(mergeAds(PAID_SAMPLE).length, 8);
  assert.equal(sum(inPeriod(PAID_SAMPLE, '30d', NOW)).spend, 490500);
});

test('período inclui hoje e não passa dele; pausada não aparece nos últimos 7 dias', () => {
  assert.deepEqual(periodDays('7d', NOW), { from: '2026-11-21', to: '2026-11-27' });
  assert.deepEqual(periodDays('yesterday', NOW), { from: '2026-11-26', to: '2026-11-26' });
  const week = inPeriod(PAID_SAMPLE, '7d', NOW);
  assert.ok(sum(week).spend > 0 && sum(week).spend < 490500);
  assert.ok(week.every((r) => r.adStatus === 'ACTIVE'));
});

test('CSV não deixa nome virar fórmula, e número negativo continua número', () => {
  assert.equal(csvCell('=SOMA(A1)'), '"\'=SOMA(A1)"');
  assert.equal(csvCell('+cmd'), '"\'+cmd"');
  assert.equal(csvCell('-12,5'), '"-12,5"');
  assert.equal(csvCell('a "b"'), '"a ""b"""');
});

const metric = (id: string, c: Parameters<(typeof METRICS)[number]['value']>[0]) => METRICS.find((m) => m.id === id)!.value(c);
const counts = (over: Partial<ReturnType<typeof sum>>) => ({ ...sum([]), ...over });

test('contas de ROAS, lucro, CPA, CPM e ROI', () => {
  const c = counts({ spend: 10000, revenue: 30000, sales: 2, impressions: 5000, clicks: 100 });
  assert.equal(metric('roas', c), 3);
  assert.equal(metric('profit', c), 20000);
  assert.equal(metric('cpa', c), 5000);
  assert.equal(metric('cpm', c), 2000);
  assert.equal(metric('roi', c), 2);
  assert.equal(metric('ctr', c), 0.02);
});

test('divisão sem base fica vazia, nunca zero ou infinito', () => {
  const c = counts({ spend: 500 });
  for (const id of ['cpa', 'cpl', 'cpc', 'ctr', 'margin', 'hook', 'connect']) assert.equal(metric(id, c), null, id);
});

test('somar por nível não perde nem duplica gasto', () => {
  const total = sum(PAID_SAMPLE).spend;
  for (const level of ['account', 'campaign', 'adset', 'ad'] as const) assert.equal(byLevel(PAID_SAMPLE, level).reduce((n, r) => n + r.spend, 0), total, level);
  assert.equal(byLevel(PAID_SAMPLE, 'account').length, 2);
});

test('o mesmo arquivo em duas contas vira um criativo só', () => {
  const g = creativeGroups(PAID_SAMPLE).find((x) => x.name === 'Vídeo de abertura')!;
  assert.equal(g.match, 'arquivo');
  assert.equal(g.accounts.length, 2);
  assert.deepEqual(g.creativeIds.sort(), ['ex_cr_101', 'ex_cr_207']);
  assert.equal(g.ads.length, 3);
});

test('arquivo reenviado só junta pelo nome e fica marcado; o resto fica pelo ID', () => {
  const groups = creativeGroups(PAID_SAMPLE);
  assert.equal(groups.find((x) => x.name === 'Carrossel de casos')!.match, 'nome');
  assert.equal(groups.find((x) => x.name === 'Imagem do diagnóstico')!.match, 'id');
  assert.equal(groups.reduce((n, x) => n + x.ads.length, 0), mergeAds(PAID_SAMPLE).length);
});

test('nome de cópia é o mesmo nome; formatos diferentes não se misturam', () => {
  assert.equal(creativeName('Vídeo de abertura - Cópia 2'), creativeName('video de abertura'));
  const base = PAID_SAMPLE[0];
  const other = { ...base, adId: 'z', creativeId: 'z', assetKey: 'image:z', format: 'image' as const };
  assert.equal(creativeGroups([base, other]).length, 2);
});
