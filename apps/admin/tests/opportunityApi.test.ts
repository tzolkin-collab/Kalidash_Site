import test from 'node:test';
import assert from 'node:assert/strict';
import { asCreatedOpportunity } from '../src/lib/opportunityApi.ts';

test('aceita uma oportunidade com id e título', () => {
  const o = { id: '1', title: 'Nova', value: 10, stage: 'INBOUND', priority: 'MEDIUM', tags: [] };
  assert.equal(asCreatedOpportunity(o), o);
});

test('recusa corpo de erro, nulo, lista e texto', () => {
  for (const bad of [{ error: 'gate' }, { id: 5, title: 'x' }, { id: '', title: 'x' }, { id: '1' }, null, undefined, [], 'erro', 42]) {
    assert.equal(asCreatedOpportunity(bad), null, JSON.stringify(bad));
  }
});
