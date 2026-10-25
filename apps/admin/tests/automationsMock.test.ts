import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// D34 / B-16: a tela Automações não pode mostrar números nem logs inventados. O módulo importa a store do app
// (sem extensão, que o Node não resolve), então a guarda lê o texto-fonte.
const src = readFileSync(new URL('../src/mocks/automations.ts', import.meta.url), 'utf8');
const page = readFileSync(new URL('../src/pages/Automations.tsx', import.meta.url), 'utf8');

test('as automações de exemplo não trazem contagem nem data de execução inventadas', () => {
  assert.equal(/runs:\s*[1-9]/.test(src), false);
  assert.equal(/lastRun:/.test(src), false);
});

test('o registro de execuções começa vazio (sem logs fabricados)', () => {
  assert.match(src, /runsStore = createStore<RunEntry\[\]>\(\[\]\)/);
  assert.equal(/renata\.moura/.test(src), false);
});

test('toda linha da lista leva o selo "Exemplo, não roda no servidor" e o nome do funil', () => {
  assert.match(page, /NOT_ON_SERVER = 'Exemplo, não roda no servidor'/);
  assert.match(page, /\{NOT_ON_SERVER\}/);
  assert.match(page, /a\.pipeline === 'Todas' \? 'Todos os funis' : a\.pipeline/);
});
