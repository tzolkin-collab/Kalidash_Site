import test from 'node:test';
import assert from 'node:assert/strict';
import { byRecent, chunk, mergeHistory, pendingEntries } from '../src/lib/historyDiff.ts';
import { auditRowOf, describeChange } from '../src/lib/historyText.ts';

const e = (id: string, at: string, over: object = {}) => ({ id, at, actor: 'Carol', entity: 'person', entityId: 'p1', entityName: 'Ana', kind: 'edit', field: 'Cargo', from: 'A', to: 'B', ...over }) as never;

test('mergeHistory: junta sem duplicar e ordena do mais recente para o mais antigo', () => {
  const local = [e('h-2', '2026-10-05T10:00:05.000Z'), e('h-1', '2026-10-05T10:00:00.000Z')];
  const server = [e('h-1', '2026-10-05T10:00:00Z'), e('h-0', '2026-10-05T09:00:00Z'), e('h-3', '2026-10-05T10:00:09Z')];
  const merged = mergeHistory(local, server);
  assert.deepEqual(merged.map((x: { id: string }) => x.id), ['h-3', 'h-2', 'h-1', 'h-0']);
});

test('mergeHistory devolve o mesmo array quando nada entra (não força re-render)', () => {
  const local = [e('h-1', '2026-10-05T10:00:00Z')];
  assert.equal(mergeHistory(local, [e('h-1', '2026-10-05T10:00:00Z')]), local);
  assert.equal(mergeHistory(local, []), local);
});

test('mesma data com e sem milissegundos ordena pelo tempo real, não pelo texto', () => {
  const a = e('a', '2026-10-05T10:00:00.900Z');
  const b = e('b', '2026-10-05T10:00:01Z');
  assert.ok(byRecent(a, b) > 0, 'b (10:00:01) é mais recente que a (10:00:00.900)');
  const tie1 = e('x1', '2026-10-05T10:00:00Z');
  const tie2 = e('x2', '2026-10-05T10:00:00Z');
  assert.ok(byRecent(tie1, tie2) > 0, 'empate: o id maior vem primeiro');
});

test('pendingEntries: só o que o servidor ainda não tem, na ordem em que aconteceu', () => {
  const entries = [e('h-3', '2026-10-05T10:00:03Z'), e('h-2', '2026-10-05T10:00:02Z'), e('h-1', '2026-10-05T10:00:01Z')];
  const pend = pendingEntries(entries, new Set(['h-2']));
  assert.deepEqual(pend.map((x: { id: string }) => x.id), ['h-1', 'h-3']);
  assert.deepEqual(pendingEntries(entries, new Set(['h-1', 'h-2', 'h-3'])), []);
});

test('chunk divide em lotes', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 100), []);
  assert.equal(chunk(Array.from({ length: 250 }, (_, i) => i), 100).length, 3);
});

test('describeChange e auditRowOf: texto da ficha e da Auditoria', () => {
  assert.deepEqual(describeChange(e('1', '2026-10-05T10:00:00Z')), { title: 'Cargo alterado', detail: 'A → B' });
  assert.equal(describeChange(e('2', '2026-10-05T10:00:00Z', { kind: 'reveal', field: 'CPF', note: 'CPF exibido inteiro' })).title, 'CPF revelado');
  assert.equal(describeChange(e('3', '2026-10-05T10:00:00Z', { kind: 'event' })).title, 'Evento');
  const row = auditRowOf(e('4', '2026-10-05T10:00:00Z', { entity: 'company', entityName: 'Acme' }));
  assert.equal(row.target, 'Empresa: Acme');
  assert.equal(row.action, 'Cargo alterado: A → B');
  assert.equal(row.actor, 'Carol');
  assert.equal(auditRowOf(e('5', '2026-10-05T10:00:00Z', { kind: 'archive', note: undefined })).action, 'Arquivado');
});
