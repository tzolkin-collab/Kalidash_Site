import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activityByDay, activityByPerson, activityKinds, cpfReveals, discardReasons, firstContact, leadCampaigns, lostCents, lostReasons,
  deltaPct, leadsBetween, openByPipeline, openTasksByAssignee, periodWindows, salesCycle, topRows, weeklyTrend, winRate, wonBetween, wonByOwner,
} from '../src/lib/commercialMetrics.ts';

const pipelines = [{
  id: 'p', name: 'Vendas', stages: [
    { id: 'p:q', name: 'Qualificação', kind: 'OPEN', color: '' },
    { id: 'p:g', name: 'Ganho', kind: 'WON', color: '' },
    { id: 'p:l', name: 'Perdido', kind: 'LOST', color: '' },
  ],
}] as never;

const now = new Date('2026-10-15T12:00:00'); // quinta-feira
const opp = (stage: string, value: number, extra: object = {}) => ({ id: Math.random().toString(), title: 't', value, stage, priority: '', tags: [], ...extra }) as never;
const lead = (extra: object = {}) => ({ id: Math.random().toString(), name: 'l', email: 'a@b.c', status: 'ACTIVE', createdAt: '2026-10-10T10:00:00', tags: [], ...extra }) as never;
const change = (actor: string, kind: string, at: string) => ({ id: Math.random().toString(), at, actor, entity: 'lead', entityId: '1', entityName: 'x', kind }) as never;

test('ganho por responsável: soma por pessoa, só no período, maior primeiro', () => {
  const rows = wonByOwner([
    opp('p:g', 1000, { ownerName: 'Ana', wonAt: '2026-10-05T10:00:00' }),
    opp('p:g', 500, { ownerName: 'Ana', wonAt: '2026-10-06T10:00:00' }),
    opp('p:g', 3000, { ownerName: 'Bia', wonAt: '2026-09-20T10:00:00' }), // fora do mês
    opp('p:g', 200, { wonAt: '2026-10-07T10:00:00' }),
    opp('p:q', 900, { ownerName: 'Ana' }), // aberta não conta
  ], pipelines, 'month', now);
  assert.deepEqual(rows.map((r) => [r.label, r.count, r.cents]), [['Ana', 2, 150000], ['Sem responsável', 1, 20000]]);
});

test('motivos de perda: ranking com valor perdido; sem motivo vira "Sem motivo"', () => {
  const opps = [opp('p:l', 100, { lostReason: 'Timing' }), opp('p:l', 50, { lostReason: 'Timing' }), opp('p:l', 10), opp('p:g', 999)];
  assert.deepEqual(lostReasons(opps, pipelines).map((r) => [r.label, r.count, r.cents]), [['Timing', 2, 15000], ['Sem motivo', 1, 1000]]);
  assert.equal(lostCents(opps, pipelines), 16000);
});

test('ciclo de venda: dias entre criação e ganho (média e mediana), ignora datas ruins', () => {
  const c = salesCycle([
    opp('p:g', 1, { created_at: '2026-10-01T00:00:00', wonAt: '2026-10-03T00:00:00' }), // 2 dias
    opp('p:g', 1, { created_at: '2026-10-01T00:00:00', wonAt: '2026-10-11T00:00:00' }), // 10 dias
    opp('p:g', 1, { created_at: '2026-10-01T00:00:00', wonAt: '2026-10-04T00:00:00' }), // 3 dias
    opp('p:g', 1, { created_at: '2026-10-09T00:00:00', wonAt: '2026-10-05T00:00:00' }), // ganho antes de criar: ignora
    opp('p:g', 1, {}), // sem datas: ignora
  ], pipelines, 'all', now);
  assert.equal(c.count, 3);
  assert.equal(c.medianDays, 3);
  assert.equal(c.avgDays, 5);
});

test('taxa de vitória = ganhas / (ganhas + perdidas); sem nenhuma é 0', () => {
  assert.equal(winRate([opp('p:g', 1), opp('p:g', 1), opp('p:g', 1), opp('p:l', 1), opp('p:q', 1)], pipelines).rate, 0.75);
  assert.deepEqual(winRate([opp('p:q', 1)], pipelines), { won: 0, lost: 0, rate: 0 });
});

test('tendência semanal: 8 semanas, semana de segunda, criadas e ganhas no lugar certo', () => {
  const t = weeklyTrend([
    opp('p:q', 1, { created_at: '2026-10-13T09:00:00' }), // semana de 12/10
    opp('p:q', 1, { created_at: '2026-10-05T09:00:00' }), // semana de 05/10
    opp('p:g', 1, { created_at: '2026-10-05T09:00:00', wonAt: '2026-10-14T09:00:00' }),
    opp('p:q', 1, { created_at: '2020-01-01T00:00:00' }), // antes da janela
  ], pipelines, 8, now);
  assert.equal(t.length, 8);
  assert.equal(t[7].label, '12/10');
  assert.deepEqual([t[7].created, t[7].won], [1, 1]);
  assert.deepEqual([t[6].label, t[6].created], ['05/10', 2]);
});

test('em aberto por funil soma só abertas', () => {
  assert.deepEqual(openByPipeline([opp('p:q', 10), opp('p:q', 5), opp('p:g', 99)], pipelines).map((r) => [r.label, r.cents]), [['Vendas', 1500]]);
});

test('primeiro contato: mediana em horas e % em até 24h', () => {
  const f = firstContact([
    lead({ createdAt: '2026-10-10T10:00:00', firstContactAt: '2026-10-10T12:00:00' }), // 2h
    lead({ createdAt: '2026-10-10T10:00:00', firstContactAt: '2026-10-10T20:00:00' }), // 10h
    lead({ createdAt: '2026-10-10T10:00:00', firstContactAt: '2026-10-13T10:00:00' }), // 72h
    lead({}), // sem contato: fora
  ], 'all', now);
  assert.equal(f.count, 3);
  assert.equal(f.medianHours, 10);
  assert.ok(Math.abs(f.within24h - 2 / 3) < 1e-9);
});

test('descartes e campanhas dos leads', () => {
  assert.deepEqual(discardReasons([lead({ status: 'DISCARDED', discardReason: 'Sem fit' }), lead({ status: 'DISCARDED' }), lead()]).map((r) => r.label), ['Sem fit', 'Sem motivo']);
  const rows = leadCampaigns([
    lead({ customData: { attribution: { utm_campaign: 'black-friday' } } }),
    lead({ customData: { attribution: { utm_campaign: 'black-friday' } } }),
    lead({ customData: { attribution: { utm_source: 'google' } } }),
    lead({}),
  ], 'all', now);
  assert.deepEqual(rows.map((r) => [r.label, r.count]), [['black-friday', 2], ['Fonte: google', 1], ['Sem campanha', 1]]);
});

test('atividade: por pessoa, por tipo, por dia e revelações de CPF', () => {
  const h = [
    change('Ana', 'edit', '2026-10-15T09:00:00'), change('Ana', 'create', '2026-10-15T08:00:00'), change('Bia', 'reveal', '2026-10-14T08:00:00'),
    change('Bia', 'reveal', '2026-09-01T08:00:00'), // fora do mês
  ];
  assert.deepEqual(activityByPerson(h, 'month', now).map((r) => [r.label, r.count]), [['Ana', 2], ['Bia', 1]]);
  assert.deepEqual(activityKinds(h, 'month', now).map((r) => r.label).sort(), ['CPF revelado', 'Criações', 'Edições']);
  const days = activityByDay(h, 3, now);
  assert.deepEqual(days.map((d) => [d.label, d.count]), [['13/10', 0], ['14/10', 1], ['15/10', 2]]);
  const r = cpfReveals(h, 'month', now);
  assert.equal(r.total, 1);
  assert.equal(r.recent[0].actor, 'Bia');
});

test('tarefas abertas por responsável e "Outros" no top', () => {
  const t = (assignee: string | undefined, done = false) => ({ id: Math.random().toString(), assignee, done }) as never;
  assert.deepEqual(openTasksByAssignee([t('Ana'), t('Ana'), t(undefined), t('Bia', true)]).map((r) => [r.label, r.count]), [['Ana', 2], ['Sem responsável', 1]]);
  const rows = topRows(['a', 'b', 'c', 'd'].map((label, i) => ({ label, count: 10 - i })), 2);
  assert.deepEqual(rows.map((r) => [r.label, r.count]), [['a', 10], ['b', 9], ['Outros', 15]]);
});

test('janelas: mês até hoje contra o mesmo trecho do mês passado; 30d contra os 30d de antes; Tudo não tem anterior', () => {
  const m = periodWindows('month', now)!;
  assert.equal(new Date(m.from).getDate(), 1);
  assert.equal(new Date(m.prevFrom).getMonth(), 8); // setembro
  assert.equal(m.prevTo - m.prevFrom, m.to - m.from);
  const d = periodWindows('30d', now)!;
  assert.equal(d.prevTo, d.from);
  assert.equal(d.to - d.from, 30 * 86_400_000);
  assert.equal(periodWindows('all', now), null);
  assert.equal(new Date(periodWindows('year', now)!.prevFrom).getFullYear(), 2025);
});

test('ganho e leads entre duas datas, e variação percentual', () => {
  const opps = [opp('p:g', 100, { wonAt: '2026-10-05T10:00:00' }), opp('p:g', 50, { wonAt: '2026-09-05T10:00:00' }), opp('p:q', 9, {})];
  const w = periodWindows('month', now)!;
  assert.deepEqual(wonBetween(opps, pipelines, w.from, w.to), { cents: 10000, count: 1 });
  assert.deepEqual(wonBetween(opps, pipelines, w.prevFrom, w.prevTo), { cents: 5000, count: 1 });
  assert.equal(leadsBetween([lead({ createdAt: '2026-10-02T10:00:00' }), lead({ createdAt: '2026-09-02T10:00:00' }), lead({ archivedAt: 'x', createdAt: '2026-10-02T10:00:00' })], w.from, w.to), 1);
  assert.equal(deltaPct(150, 100), 0.5);
  assert.equal(deltaPct(50, 100), -0.5);
  assert.equal(deltaPct(10, 0), null);
});
