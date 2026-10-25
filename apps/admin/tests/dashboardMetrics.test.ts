import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Lead, TaskItem } from '../src/domain.ts';
import { leadMetrics, leadOrigins, overdueTasks, taskMetrics } from '../src/lib/dashboardMetrics.ts';

const NOW = new Date('2026-10-18T12:00:00Z');
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

const lead = (id: string, over: Partial<Lead> = {}): Lead => ({
  id, name: id, email: `${id}@x.com`, pipelineId: 'p', stageId: 'p:novos', origin: 'INBOUND', sourceName: 'Site', tags: [], status: 'ACTIVE', wasSeen: false, createdAt: day(-1), ...over,
});
const task = (id: string, over: Partial<TaskItem> = {}): TaskItem => ({
  id, entity: 'lead', entityId: 'l', entityName: 'Lead', title: id, tag: '', done: false, source: 'manual', createdAt: day(-10), ...over,
});

test('leads: ativos, novos no período, sem contato, qualificados e taxa', () => {
  const leads = [
    lead('a'),
    lead('b', { wasSeen: true, firstContactAt: day(-1) }),
    lead('c', { createdAt: day(-60) }), // fora do mês
    lead('d', { status: 'QUALIFIED' }),
    lead('e', { status: 'DISCARDED' }),
    lead('f', { archivedAt: day(-2) }), // arquivado não conta
  ];
  const m = leadMetrics(leads, 'month', NOW);
  assert.equal(m.active, 3);
  assert.equal(m.newInPeriod, 4); // a, b, d, e (c é de 60 dias atrás)
  assert.equal(m.waitingContact, 2); // a e c
  assert.equal(m.unseen, 2); // a e c
  assert.equal(m.qualified, 1);
  assert.equal(m.discarded, 1);
  assert.equal(m.qualifiedRate, 1 / 5);
  assert.equal(leadMetrics(leads, 'all', NOW).newInPeriod, 5);
  assert.equal(leadMetrics([], 'month', NOW).qualifiedRate, 0);
});

test('origem: inbound por fonte, outbound por quem trouxe, maior primeiro, resto em "Outras"', () => {
  const leads = [
    lead('1', { sourceName: 'Instagram' }), lead('2', { sourceName: 'Instagram' }), lead('3', { sourceName: 'Site' }),
    lead('4', { origin: 'OUTBOUND', sourceName: 'Carol' }),
    lead('5', { sourceName: 'Antigo', createdAt: day(-90) }), // fora do mês
    lead('6', { sourceName: 'Arquivado', archivedAt: day(-1) }),
  ];
  const rows = leadOrigins(leads, 'month', NOW);
  assert.deepEqual(rows.map((r) => [r.label, r.count]), [['Instagram', 2], ['Outbound · Carol', 1], ['Site', 1]]);
  assert.equal(leadOrigins(leads, 'all', NOW).some((r) => r.label === 'Antigo'), true);

  const many = Array.from({ length: 9 }, (_, i) => lead(`m${i}`, { sourceName: `Fonte ${i}` }));
  const cut = leadOrigins(many, 'month', NOW, 3);
  assert.equal(cut.length, 4);
  assert.deepEqual(cut[3], { label: 'Outras', origin: 'INBOUND', count: 6 });
});

test('tarefas: abertas, atrasadas, a vencer em 7 dias, sem prazo e concluídas no período', () => {
  const tasks = [
    task('atrasada', { dueAt: day(-3) }),
    task('hoje-mais-tarde', { dueAt: day(0.5) }),
    task('semana', { dueAt: day(6) }),
    task('longe', { dueAt: day(20) }),
    task('sem-prazo'),
    task('feita', { done: true, doneAt: day(-2), dueAt: day(-5) }),
    task('feita-antiga', { done: true, doneAt: day(-90) }),
  ];
  const m = taskMetrics(tasks, 'month', NOW);
  assert.deepEqual(m, { open: 5, overdue: 1, dueSoon: 2, noDue: 1, doneInPeriod: 1 });
  assert.equal(taskMetrics(tasks, 'all', NOW).doneInPeriod, 2);
});

test('atrasadas: mais antigas primeiro, limite e nunca uma concluída', () => {
  const tasks = [task('b', { dueAt: day(-1) }), task('a', { dueAt: day(-9) }), task('c', { dueAt: day(-5) }), task('d', { done: true, dueAt: day(-30) })];
  assert.deepEqual(overdueTasks(tasks, NOW, 2).map((t) => t.id), ['a', 'c']);
  assert.equal(overdueTasks(tasks, NOW).length, 3);
});
