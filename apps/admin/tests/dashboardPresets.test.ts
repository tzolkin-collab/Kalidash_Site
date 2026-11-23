import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SPANS } from '../src/lib/dashboardLayout.ts';
import { PRESETS } from '../src/lib/dashboardPresets.ts';

test('modelos prontos: ids únicos, sem widget repetido e só larguras válidas', () => {
  assert.equal(new Set(PRESETS.map((p) => p.id)).size, PRESETS.length);
  for (const p of PRESETS) {
    assert.ok(p.name && p.description, p.id);
    assert.ok(p.items.length >= 5, `${p.id} muito curto`);
    assert.equal(new Set(p.items.map((i) => i.id)).size, p.items.length, `${p.id} repete widget`);
    for (const i of p.items) assert.ok(SPANS.includes(i.span), `${p.id}/${i.id} largura inválida`);
  }
});

test('modelos prontos: cada linha da grade fecha em 12 colunas (sem buraco)', () => {
  for (const p of PRESETS) {
    let col = 0;
    for (const i of p.items) {
      col += i.span;
      assert.ok(col <= 12, `${p.id}: ${i.id} estoura a linha`);
      if (col === 12) col = 0;
    }
  }
});
