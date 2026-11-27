import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addCustom, addItem, defaultLayout, moveItem, normalizeLayout, removeItem, setSpan, updateCustom } from '../src/lib/dashboardLayout.ts';
import { normalizeChart } from '../src/lib/chartSpec.ts';
import type { WidgetSpec } from '../src/lib/dashboardLayout.ts';

const CATALOG: WidgetSpec[] = [
  { id: 'a', defaultSpan: 4, spans: [3, 4, 6], inDefault: true },
  { id: 'b', defaultSpan: 8, spans: [6, 8, 12], inDefault: true },
  { id: 'c', defaultSpan: 6, spans: [6, 12] },
];

test('layout de fábrica: só os widgets marcados, com a largura padrão', () => {
  assert.deepEqual(defaultLayout(CATALOG), [{ id: 'a', span: 4 }, { id: 'b', span: 8 }]);
});

test('normaliza: tira desconhecidos e repetidos, corrige largura inválida', () => {
  const out = normalizeLayout([{ id: 'b', span: 12 }, { id: 'zzz', span: 4 }, { id: 'b', span: 6 }, { id: 'a', span: 12 }, { id: 'c' }], CATALOG);
  assert.deepEqual(out, [{ id: 'b', span: 12 }, { id: 'a', span: 4 }, { id: 'c', span: 6 }]);
});

test('normaliza lixo vira o layout de fábrica; lista vazia continua vazia', () => {
  assert.deepEqual(normalizeLayout('x', CATALOG), defaultLayout(CATALOG));
  assert.deepEqual(normalizeLayout(null, CATALOG), defaultLayout(CATALOG));
  assert.deepEqual(normalizeLayout([], CATALOG), []);
});

test('mover troca a ordem e ignora índices inválidos', () => {
  const l = [{ id: 'a', span: 4 as const }, { id: 'b', span: 8 as const }, { id: 'c', span: 6 as const }];
  assert.deepEqual(moveItem(l, 0, 2).map((i) => i.id), ['b', 'c', 'a']);
  assert.deepEqual(moveItem(l, 2, 0).map((i) => i.id), ['c', 'a', 'b']);
  assert.equal(moveItem(l, 1, 1), l);
  assert.equal(moveItem(l, 5, 0), l);
});

test('largura só aceita as que o widget permite', () => {
  const l = defaultLayout(CATALOG);
  assert.deepEqual(setSpan(l, 'a', 6, CATALOG)[0], { id: 'a', span: 6 });
  assert.equal(setSpan(l, 'a', 12, CATALOG), l);
  assert.equal(setSpan(l, 'nada', 6, CATALOG), l);
});

test('adicionar vai para o fim, uma vez só; remover tira', () => {
  const l = defaultLayout(CATALOG);
  const added = addItem(l, 'c', CATALOG);
  assert.deepEqual(added.map((i) => i.id), ['a', 'b', 'c']);
  assert.equal(addItem(added, 'c', CATALOG), added);
  assert.equal(addItem(l, 'nada', CATALOG), l);
  assert.deepEqual(removeItem(added, 'a').map((i) => i.id), ['b', 'c']);
});

test('layout de fábrica respeita defaultOrder; sem ele vale a ordem do catálogo', () => {
  const inverted: WidgetSpec[] = [
    { id: 'a', defaultSpan: 6, spans: [6], inDefault: true, defaultOrder: 2 },
    { id: 'b', defaultSpan: 6, spans: [6], inDefault: true, defaultOrder: 1 },
    { id: 'fora', defaultSpan: 6, spans: [6], defaultOrder: 0 }, // fora do padrão: nunca entra
  ];
  assert.deepEqual(defaultLayout(inverted).map((i) => i.id), ['b', 'a']);
  const plain: WidgetSpec[] = [
    { id: 'x', defaultSpan: 6, spans: [6], inDefault: true },
    { id: 'y', defaultSpan: 6, spans: [6], inDefault: true },
  ];
  assert.deepEqual(defaultLayout(plain).map((i) => i.id), ['x', 'y']);
});

test('gráfico configurável: entra com id próprio e largura padrão pelo formato; ids não repetem', () => {
  const line = normalizeChart({ visual: 'line', measure: 'won-value' })!;
  const donut = normalizeChart({ visual: 'donut', measure: 'open-value', dimension: 'owner' })!;
  const a = addCustom([], line);
  const b = addCustom(a.layout, donut);
  assert.notEqual(a.id, b.id);
  assert.deepEqual(b.layout.map((i) => i.span), [8, 6]);
  assert.ok(b.layout.every((i) => i.id.startsWith('chart-') && i.config));
});

test('gráfico configurável: largura só entre as permitidas, editar troca a configuração, normalizar valida', () => {
  const line = normalizeChart({ visual: 'line', measure: 'won-value' })!;
  const { layout, id } = addCustom([], line);
  assert.equal(setSpan(layout, id, 12, CATALOG)[0].span, 12);
  assert.equal(setSpan(layout, id, 3, CATALOG), layout); // 1/4 não vale para gráfico
  const bars = normalizeChart({ visual: 'bars', measure: 'lost-value', dimension: 'reason' })!;
  assert.equal(updateCustom(layout, id, bars)[0].config?.visual, 'bars');
  assert.equal(updateCustom(layout, id, bars)[0].span, layout[0].span);
  const raw = JSON.parse(JSON.stringify([...layout, { id: 'chart-lixo', span: 6, config: { visual: 'nada' } }, { id: 'chart-sem-config', span: 6 }]));
  const out = normalizeLayout(raw, CATALOG);
  assert.deepEqual(out.map((i) => i.id), [id]);
  assert.equal(out[0].config?.measure, 'won-value');
});
