import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildChanges, fieldKindOf, finalAction, groupPlan, planMigration } from '../src/lib/tagMigration.ts';
import type { Target } from '../src/lib/tagMigration.ts';

const opp = (id: string, tags: string[], priority?: string): Target => ({ entity: 'opportunity', id, name: `Opp ${id}`, tags, priority });
const lead = (id: string, tags: string[], origin: Target['origin'], sourceName = 'Site — diagnostico'): Target => ({ entity: 'lead', id, name: `Lead ${id}`, tags, origin, sourceName });
const person = (id: string, tags: string[]): Target => ({ entity: 'person', id, name: `Pessoa ${id}`, tags });

test('o que parece campo e o que é tag de verdade', () => {
  assert.equal(fieldKindOf('Urgente'), 'PRIORITY');
  assert.equal(fieldKindOf('média'), 'PRIORITY');
  assert.equal(fieldKindOf('Inbound'), 'SOURCE');
  assert.equal(fieldKindOf('Indicação'), 'SOURCE');
  assert.equal(fieldKindOf('Novo'), 'STATUS');
  assert.equal(fieldKindOf('Fechado'), 'STATUS');
  for (const tag of ['B2B', 'Enterprise', 'Feira Agrishow', 'Reunião marcada']) assert.equal(fieldKindOf(tag), null, tag);
});

test('prioridade em oportunidade: sem campo → MOVE; igual → REMOVE; diferente → KEEP; outros registros → KEEP', () => {
  const plan = planMigration([opp('1', ['Urgente']), opp('2', ['Urgente'], 'HIGH'), opp('3', ['Urgente'], 'LOW'), lead('4', ['Urgente'], 'INBOUND'), person('5', ['Alta'])]);
  assert.deepEqual(plan.map((p) => [p.id, p.action]), [['1', 'MOVE'], ['2', 'REMOVE'], ['3', 'KEEP'], ['4', 'KEEP'], ['5', 'KEEP']]);
  assert.deepEqual(plan[0].set, { priority: 'HIGH' });
  assert.match(plan[2].note, /Revise à mão/);
});

test('origem em lead: Inbound/Outbound repetido → REMOVE; diferente → KEEP; fonte já contida → REMOVE', () => {
  const plan = planMigration([
    lead('1', ['Inbound'], 'INBOUND'), lead('2', ['Inbound'], 'OUTBOUND'), lead('3', ['Site'], 'INBOUND'), lead('4', ['Indicação'], 'INBOUND'),
    opp('5', ['Inbound']), person('6', ['Inbound']),
  ]);
  assert.deepEqual(plan.map((p) => [p.id, p.action]), [['1', 'REMOVE'], ['2', 'KEEP'], ['3', 'REMOVE'], ['4', 'KEEP'], ['5', 'KEEP'], ['6', 'KEEP']]);
});

test('status: oportunidade e lead → REMOVE (a etapa já diz); pessoa → KEEP', () => {
  const plan = planMigration([opp('1', ['Novo']), lead('2', ['Fechado'], 'INBOUND'), person('3', ['Ativo'])]);
  assert.deepEqual(plan.map((p) => [p.id, p.action]), [['1', 'REMOVE'], ['2', 'REMOVE'], ['3', 'KEEP']]);
});

test('tag de verdade nunca entra no plano; tag repetida no mesmo registro vale uma vez', () => {
  const plan = planMigration([opp('1', ['B2B', 'Enterprise', 'Novo', 'novo', 'NOVO'])]);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].tag, 'Novo');
});

test('grupos: mesma tag, registro, ação e motivo andam juntos; ordem MOVE, REMOVE, KEEP e, dentro, por tipo de campo', () => {
  const plan = planMigration([opp('1', ['Novo']), opp('2', ['Novo']), opp('3', ['Urgente']), opp('4', ['Urgente'], 'HIGH'), person('5', ['Novo'])]);
  const g = groupPlan(plan);
  assert.deepEqual(g.map((x) => [x.tag, x.entity, x.action, x.items.length]), [
    ['Urgente', 'opportunity', 'MOVE', 1],
    ['Urgente', 'opportunity', 'REMOVE', 1], // dentro de cada ação: por tipo de campo (prioridade, origem, status)
    ['Novo', 'opportunity', 'REMOVE', 2],
    ['Novo', 'person', 'KEEP', 1],
  ]);
});

test('escolha do grupo: seguir a sugestão, só remover ou manter', () => {
  const [move] = planMigration([opp('1', ['Urgente'])]);
  const [keep] = planMigration([person('2', ['Novo'])]);
  assert.equal(finalAction(move, 'SUGGESTED'), 'MOVE');
  assert.equal(finalAction(move, 'REMOVE'), 'REMOVE');
  assert.equal(finalAction(move, 'KEEP'), 'KEEP');
  assert.equal(finalAction(keep, 'SUGGESTED'), 'KEEP');
  assert.equal(finalAction(keep, 'REMOVE'), 'REMOVE'); // a pessoa pode escolher remover mesmo sem campo equivalente
});

test('montar as mudanças: tira as tags certas, grava a prioridade no MOVE, ignora o que fica', () => {
  const targets = [opp('1', ['B2B', 'Urgente', 'Novo']), opp('2', ['Urgente'], 'LOW'), person('3', ['Novo', 'B2B'])];
  const items = planMigration(targets);
  const changes = buildChanges(targets, items, (i) => finalAction(i, 'SUGGESTED'));
  assert.equal(changes.length, 1); // 2 é conflito (KEEP) e 3 é pessoa (KEEP)
  assert.deepEqual(changes[0].tags, ['B2B']);
  assert.deepEqual(changes[0].patch, { priority: 'HIGH' });
  assert.deepEqual(changes[0].removed.sort(), ['Novo', 'Urgente']);
  // remover também o que a sugestão manteria
  const all = buildChanges(targets, items, (i) => finalAction(i, 'REMOVE'));
  assert.deepEqual(all.map((c) => c.id), ['1', '2', '3']);
  assert.deepEqual(all[2].tags, ['B2B']);
  assert.deepEqual(all[1].patch, {}); // REMOVE nunca grava campo
  // manter tudo não muda nada
  assert.deepEqual(buildChanges(targets, items, () => 'KEEP'), []);
});
