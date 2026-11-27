import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_NAME, MAX_VIEWS, addView, normalizeViews, removeView } from '../src/lib/dashboardViews.ts';
import type { WidgetSpec } from '../src/lib/dashboardLayout.ts';

const CATALOG: WidgetSpec[] = [
  { id: 'a', defaultSpan: 6, spans: [6, 12], inDefault: true },
  { id: 'b', defaultSpan: 6, spans: [6, 12] },
];
const items = [{ id: 'a', span: 6 as const }, { id: 'b', span: 12 as const }];

test('salvar visão: nome limpo e cortado, cópia do layout (não compartilha referência)', () => {
  const r = addView([], '  Reunião de segunda  ', items);
  assert.equal(r.error, undefined);
  assert.equal(r.views[0].name, 'Reunião de segunda');
  assert.notEqual(r.views[0].items, items);
  assert.deepEqual(r.views[0].items, items);
  assert.equal(addView([], 'x'.repeat(100), items).views[0].name.length, MAX_NAME);
});

test('salvar visão: recusa nome vazio, repetido, layout vazio e passar do limite', () => {
  const um = addView([], 'Vendas', items).views;
  assert.ok(addView(um, '   ', items).error);
  assert.ok(addView(um, 'vendas', items).error); // repetido sem diferenciar maiúsculas
  assert.ok(addView(um, 'Outra', []).error);
  let many = um;
  for (let i = 1; i < MAX_VIEWS; i++) many = addView(many, `Visão ${i}`, items).views;
  assert.equal(many.length, MAX_VIEWS);
  assert.ok(addView(many, 'Mais uma', items).error);
  assert.equal(addView(many, 'Mais uma', items).views, many);
});

test('apagar visão', () => {
  const v = addView([], 'A', items).views;
  assert.deepEqual(removeView(v, v[0].id), []);
  assert.equal(removeView(v, 'nada').length, 1);
});

test('normalizar: tira visões inválidas, repetidas e widgets que não existem mais', () => {
  const out = normalizeViews([
    { id: '1', name: 'Boa', items: [{ id: 'a', span: 6 }, { id: 'fantasma', span: 6 }] },
    { id: '2', name: 'boa', items: items }, // repetida
    { id: '3', name: '', items: items }, // sem nome
    { id: '4', name: 'Vazia', items: [{ id: 'fantasma', span: 6 }] }, // só widget inexistente
    { name: 'Sem id', items: items },
  ], CATALOG);
  assert.deepEqual(out.map((v) => [v.id, v.name, v.items.length]), [['1', 'Boa', 1]]);
  assert.deepEqual(normalizeViews('lixo', CATALOG), []);
});
