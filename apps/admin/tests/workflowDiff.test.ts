import test from 'node:test';
import assert from 'node:assert/strict';
import { diffById, diffPipelines, diffTasks, isRealOpportunityId, isSyncableTask, normalizePipeline, pipelineProjection, taskProjection } from '../src/lib/workflowDiff.ts';

const pipe = (over: object = {}) => normalizePipeline({
  id: 'p1', name: 'Q4', offer: 'x',
  stages: [{ id: 'p1:a', name: 'A', kind: 'OPEN', color: '#000' }],
  requirements: [{ id: 'p1:r', stageId: 'p1:a', label: 'R', tag: 't', kind: 'ACTION', gate: 'ENTER', blocked: 0, overdue: 0 }],
  ...over,
} as never);

const task = (over: object = {}) => ({ id: 't1', entity: 'opportunity', entityId: '1790000000000000001', entityName: 'Acme', title: 'Ligar', tag: 'Comercial', done: false, source: 'manual', createdAt: '2026-10-05T00:00:00Z', ...over }) as never;

test('normalizePipeline completa o que o servidor omite', () => {
  const p = normalizePipeline({ id: 'x', name: 'N' } as never);
  assert.deepEqual([p.stages, p.requirements, p.counts, p.values, p.customFields, p.taskTags, p.steps, p.sources, p.qualifyRequires], [[], [], {}, {}, [], [], [], [], []]);
});

test('contagens e bloqueadas calculadas pelo servidor não contam como mudança', () => {
  const a = pipe();
  const b = pipe({ counts: { 'p1:a': 3 }, values: { 'p1:a': 99 }, requirements: [{ ...a.requirements[0], blocked: 5, overdue: 2 }] });
  assert.equal(pipelineProjection(a), pipelineProjection(b));
});

test('diffPipelines: novo vira create, alterado vira update, igual some', () => {
  const same = pipe();
  const snap = new Map([[same.id, pipelineProjection(same)]]);
  assert.deepEqual(diffPipelines(snap, [same]), []);
  const renamed = pipe({ name: 'Outro' });
  assert.deepEqual(diffPipelines(snap, [renamed]).map((c) => c.kind), ['update']);
  const gateChanged = pipe({ requirements: [{ ...same.requirements[0], gate: 'EXIT' }] });
  assert.deepEqual(diffPipelines(snap, [gateChanged]).map((c) => c.kind), ['update']);
  const fresh = pipe({ id: 'p2' });
  assert.deepEqual(diffPipelines(snap, [same, fresh]).map((c) => `${c.kind}:${c.pipeline.id}`), ['create:p2']);
});

test('só oportunidades reais (id numérico) sincronizam tarefas', () => {
  assert.ok(isRealOpportunityId('1790000000000000001'));
  assert.ok(!isRealOpportunityId('opp-lz3a'));
  assert.ok(isSyncableTask(task()));
  assert.ok(!isSyncableTask(task({ entityId: 'opp-lz3a' })), 'exemplo do protótipo');
  assert.ok(!isSyncableTask(task({ entity: 'lead', entityId: '123' })), 'lead é de exemplo');
});

test('diffTasks: criar, atualizar e remover; ignora o que não sincroniza', () => {
  const t1 = task({ id: 'a' });
  const snap = new Map([['a', taskProjection(t1)], ['gone', 'x']]);
  assert.deepEqual(diffTasks(snap, [t1]), { create: [], update: [], remove: ['gone'] });
  const done = task({ id: 'a', done: true });
  assert.equal(diffTasks(snap, [done]).update.length, 1);
  const novo = task({ id: 'b' });
  const lead = task({ id: 'c', entity: 'lead' });
  const sample = task({ id: 'd', entityId: 'opp-x' });
  const d = diffTasks(snap, [t1, novo, lead, sample]);
  assert.deepEqual(d.create.map((t: { id: string }) => t.id), ['b']);
});

test('com o CRM na API, tarefas de lead, pessoa e empresa também sincronizam; exemplos de oportunidade não', () => {
  const lead = task({ id: 'a', entity: 'lead', entityId: 'l1' });
  const pessoa = task({ id: 'b', entity: 'person', entityId: 'p1' });
  const empresa = task({ id: 'c', entity: 'company', entityId: 'c1' });
  const exemploOpp = task({ id: 'd', entityId: 'opp-x' });
  const pipeline = task({ id: 'e', entity: 'pipeline', entityId: 'q4' });
  assert.ok(!isSyncableTask(lead) && !isSyncableTask(pessoa) && !isSyncableTask(empresa), 'sem CRM na API ficam locais');
  assert.ok(isSyncableTask(lead, true) && isSyncableTask(pessoa, true) && isSyncableTask(empresa, true));
  assert.ok(!isSyncableTask(exemploOpp, true), 'oportunidade de exemplo nunca sobe');
  assert.ok(!isSyncableTask(pipeline, true));
  const d = diffTasks(new Map(), [lead, pessoa, exemploOpp], true);
  assert.deepEqual(d.create.map((x: { id: string }) => x.id), ['a', 'b']);
  assert.equal(diffTasks(new Map(), [lead], false).create.length, 0);
});

test('diffById: novos, alterados e iguais', () => {
  const proj = (x: { id: string; v: number }) => JSON.stringify(x);
  const a = { id: 'a', v: 1 };
  const b = { id: 'b', v: 1 };
  const snap = new Map([['a', proj(a)], ['b', proj(b)]]);
  assert.deepEqual(diffById(snap, [a, b], proj), { create: [], update: [] });
  const r = diffById(snap, [{ id: 'a', v: 2 }, b, { id: 'c', v: 1 }], proj);
  assert.deepEqual([r.create.map((x) => x.id), r.update.map((x) => x.id)], [['c'], ['a']]);
});
