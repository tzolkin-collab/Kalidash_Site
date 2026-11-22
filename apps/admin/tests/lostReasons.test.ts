import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_LOST_REASONS, lostReasonLabel, lostReasonProblem, lostReasonsFor } from '../src/lib/lostReasons.ts';

test('funil sem lista própria usa a padrão (a mesma da API)', () => {
  assert.deepEqual(lostReasonsFor(undefined), DEFAULT_LOST_REASONS);
  assert.deepEqual(lostReasonsFor({ lostReasons: [] }), DEFAULT_LOST_REASONS);
  assert.deepEqual(lostReasonsFor({ lostReasons: ['  ', ''] }), DEFAULT_LOST_REASONS);
  assert.deepEqual(DEFAULT_LOST_REASONS, ['Sem orçamento', 'Escolheu concorrente', 'Sem resposta', 'Sem fit', 'Timing', 'Outro']);
});

test('funil com lista própria usa a dele', () => {
  assert.deepEqual(lostReasonsFor({ lostReasons: ['Preço', ' Outro '] }), ['Preço', 'Outro']);
});

test('regras do motivo: obrigatório, da lista, e "Outro" pede a nota', () => {
  const list = ['Preço', 'Outro'];
  assert.equal(lostReasonProblem(list, '', ''), 'Escolha o motivo.');
  assert.equal(lostReasonProblem(list, 'Sem orçamento', ''), 'Este motivo não está na lista do funil.');
  assert.match(lostReasonProblem(list, 'Outro', '  ') ?? '', /Outro/);
  assert.equal(lostReasonProblem(list, 'Outro', 'mudou de ideia'), null);
  assert.equal(lostReasonProblem(list, 'Preço', ''), null);
});

test('rótulo junta motivo e nota', () => {
  assert.equal(lostReasonLabel('Preço', ''), 'Preço');
  assert.equal(lostReasonLabel('Outro', ' caro '), 'Outro · caro');
  assert.equal(lostReasonLabel(undefined, 'x'), '');
});
