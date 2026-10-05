import test from 'node:test';
import assert from 'node:assert/strict';
import { periodStart, salesMetrics, stageInfo, toCents } from '../src/lib/salesMetrics.ts';

// Pipeline mínima com as etapas do template padrão.
const pipelines = [{
  id: 'p', name: 'P', stages: [
    { id: 'p:q', name: 'Qualificação', kind: 'OPEN', color: '', probability: 20 },
    { id: 'p:n', name: 'Negociação', kind: 'OPEN', color: '', probability: 60 },
    { id: 'p:x', name: 'Sem prob', kind: 'OPEN', color: '' },
    { id: 'p:g', name: 'Ganho', kind: 'WON', color: '' },
    { id: 'p:l', name: 'Perdido', kind: 'LOST', color: '' },
  ],
}] as never;

const opp = (stage: string, value: number, extra: object = {}) => ({ id: Math.random().toString(), title: 't', value, stage, priority: '', tags: [], ...extra }) as never;
const now = new Date('2026-10-15T12:00:00');

test('previsão ponderada = valor × probabilidade da etapa, em centavos exatos', () => {
  const m = salesMetrics([opp('p:q', 1000), opp('p:n', 333.33), opp('p:x', 500)], pipelines, 'all', now);
  assert.equal(m.openCount, 3);
  assert.equal(m.openCents, 183333);
  assert.equal(m.forecastCents, 20000 + 20000); // 1000×20% + 333,33×60% = 200 + 199,998 → 20000 centavos
  assert.equal(m.openWithoutProbability, 1);
});

test('soma não acumula erro de ponto flutuante (0,1 + 0,2)', () => {
  const m = salesMetrics([opp('p:g', 0.1), opp('p:g', 0.2)], pipelines, 'all', now);
  assert.equal(m.wonCents, 30);
});

test('valor ganho e ticket médio respeitam o período, pela data de ganho', () => {
  const list = [
    opp('p:g', 4000, { wonAt: '2026-10-02T10:00:00' }),
    opp('p:g', 2000, { wonAt: '2026-10-10T10:00:00' }),
    opp('p:g', 9000, { wonAt: '2026-08-01T10:00:00' }),
  ];
  const mes = salesMetrics(list, pipelines, 'month', now);
  assert.equal(mes.wonCount, 2);
  assert.equal(mes.wonCents, 600000);
  assert.equal(mes.averageCents, 300000);
  assert.equal(salesMetrics(list, pipelines, '90d', now).wonCount, 3);
  assert.equal(salesMetrics(list, pipelines, '30d', now).wonCount, 2);
  assert.equal(salesMetrics(list, pipelines, 'year', now).wonCents, 1500000);
});

test('ganha sem data só entra em "Tudo" e é contada à parte', () => {
  const list = [opp('p:g', 1000)];
  assert.equal(salesMetrics(list, pipelines, 'month', now).wonCount, 0);
  assert.equal(salesMetrics(list, pipelines, 'month', now).wonWithoutDate, 1);
  assert.equal(salesMetrics(list, pipelines, 'all', now).wonCount, 1);
});

test('leads e etapas desconhecidas ficam fora; perdidas só contam', () => {
  const m = salesMetrics([opp('p:q', 100, { isLead: true }), opp('zzz', 100), opp('p:l', 100)], pipelines, 'all', now);
  assert.equal(m.openCount, 0);
  assert.equal(m.lostCount, 1);
});

test('valores legados (INBOUND/QUALIFICATION/WON) ainda são entendidos', () => {
  assert.equal(stageInfo('WON', pipelines)?.kind, 'WON');
  assert.equal(stageInfo('QUALIFICATION', pipelines)?.probability, 20);
  assert.equal(stageInfo('nada', pipelines), undefined);
});

test('toCents e início do período', () => {
  assert.equal(toCents(19.9), 1990);
  assert.equal(toCents(null), 0);
  assert.equal(periodStart('all', now), null);
  assert.equal(periodStart('month', now), new Date('2026-10-01T00:00:00').getTime());
});
