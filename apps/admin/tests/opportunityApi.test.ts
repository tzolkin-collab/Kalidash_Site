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

import { changeNote, mergeSaved, updateBody } from '../src/lib/opportunityApi.ts';
import type { Opportunity } from '../src/types.ts';

const base: Opportunity = { id: 'o1', title: 'Acme', value: 100, stage: 'q4:novos', priority: 'MEDIUM', tags: ['a'], contactId: 'p1', contactName: 'Ana', ownerMemberId: 'tm1', ownerName: 'Carol' };

test('o corpo do PUT leva id, título, valor e só o que mudou', () => {
  assert.deepEqual(updateBody(base, { priority: 'HIGH' }), { id: 'o1', title: 'Acme', value: 100, priority: 'HIGH' });
  assert.deepEqual(updateBody(base, { contactId: null }), { id: 'o1', title: 'Acme', value: 100, contactId: null });
  assert.equal('contactId' in updateBody(base, { title: 'Novo' }), false, 'não reenvia o vínculo que não mudou');
});

test('depois de salvar, o vínculo que o servidor omitiu fica vazio', () => {
  const saved = { id: 'o1', title: 'Acme', value: 100, priority: 'HIGH', tags: ['a', 'b'], stage: 'q4:novos' } as Opportunity;
  const m = mergeSaved(base, saved);
  assert.equal(m.contactId, undefined);
  assert.equal(m.contactName, undefined);
  assert.equal(m.ownerName, undefined);
  assert.equal(m.priority, 'HIGH');
  assert.deepEqual(m.tags, ['a', 'b']);
  assert.equal(m.stage, 'q4:novos');
  assert.equal(mergeSaved(base, null), base);
});

test('as anotações automáticas descrevem cada mudança', () => {
  const notes = changeNote({ priority: 'HIGH', tags: [], contactId: null, companyId: 'c1', ownerMemberId: 'tm2' }, { company: 'Acme', owner: 'Diego' });
  assert.deepEqual(notes, [
    'A prioridade foi alterada para Alta',
    'As tags foram alteradas para: nenhuma',
    'O contato foi removido',
    'A empresa passou a ser Acme',
    'O responsável passou a ser Diego',
  ]);
});
