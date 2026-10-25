import test from 'node:test';
import assert from 'node:assert/strict';
import { pipelineStats } from '../src/lib/pipelineStats.ts';

const base = {
  counts: { a: 2, b: 1 },
  requirements: [
    { overdue: 1, blocked: 2 },
    { overdue: 0, blocked: 2 },
  ],
} as never;

test('sem stats do servidor: conta local pelos requisitos', () => {
  assert.deepEqual(pipelineStats(base), { records: 3, tasks: 2, overdue: 1, blocked: 4 });
});

test('com stats do servidor: vale o servidor (registros bloqueados, não tarefas)', () => {
  const p = { ...(base as object), stats: { records: 5, openTasks: 7, overdue: 2, blocked: 1 } } as never;
  assert.deepEqual(pipelineStats(p), { records: 5, tasks: 7, overdue: 2, blocked: 1 });
});
