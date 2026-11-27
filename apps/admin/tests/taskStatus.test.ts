import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TASK_STATUSES, TASK_STATUS_META, statusOf, withStatus } from '../src/lib/taskStatus.ts';

test('statusOf: concluída é DONE; aberta mantém o status válido; sem status é A fazer', () => {
  assert.equal(statusOf({ done: true }), 'DONE');
  assert.equal(statusOf({ done: true, status: 'DOING' }), 'DONE');
  assert.equal(statusOf({ done: false }), 'TODO');
  assert.equal(statusOf({ done: false, status: 'DOING' }), 'DOING');
  assert.equal(statusOf({ done: false, status: 'BLOCKED' }), 'BLOCKED');
  assert.equal(statusOf({ done: false, status: 'DONE' }), 'TODO'); // incoerente: reabre
});

test('withStatus: concluir marca done e data; reabrir limpa; concluir de novo não muda a data', () => {
  const now = new Date('2026-11-23T12:00:00Z');
  const done = withStatus({ done: false, doneAt: undefined }, 'DONE', now);
  assert.deepEqual(done, { status: 'DONE', done: true, doneAt: now.toISOString() });
  const again = withStatus({ done: true, doneAt: '2026-01-01T00:00:00Z' }, 'DONE', now);
  assert.equal(again.doneAt, '2026-01-01T00:00:00Z');
  assert.deepEqual(withStatus({ done: true, doneAt: '2026-01-01T00:00:00Z' }, 'BLOCKED', now), { status: 'BLOCKED', done: false, doneAt: undefined });
});

test('todo status tem rótulo e tom', () => {
  for (const s of TASK_STATUSES) assert.ok(TASK_STATUS_META[s].label && TASK_STATUS_META[s].tone, s);
  assert.equal(TASK_STATUS_META.BLOCKED.tone, 'danger');
  assert.equal(TASK_STATUS_META.DONE.tone, 'success');
});
