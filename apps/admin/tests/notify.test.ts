import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_ITEMS, avisosStore, activeToastsStore, clearAll, markAllRead, markRead, pushAviso, pushErro, pushNotificacao, unreadCount } from '../src/lib/notify.ts';

test.beforeEach(() => { clearAll(); activeToastsStore.set([]); });

test('aviso e erro geram toast + cópia na caixa; notificação só a caixa', () => {
  const a = pushAviso('Não pode avançar', 'Pendente: CNPJ.');
  const e = pushErro('Google desconectado', 'Reconecte.');
  const n = pushNotificacao('Avançou', 'Para Negociação.');
  assert.deepEqual(avisosStore.get().map((x) => x.category), ['notificacao', 'erro', 'aviso']);
  assert.deepEqual(activeToastsStore.get(), [e.id, a.id]);
  assert.ok(!activeToastsStore.get().includes(n.id));
});

test('contador de não lidas e marcar como lida', () => {
  const a = pushAviso('a', '');
  pushNotificacao('b', '');
  assert.equal(unreadCount(avisosStore.get()), 2);
  markRead(a.id);
  assert.equal(unreadCount(avisosStore.get()), 1);
  markAllRead();
  assert.equal(unreadCount(avisosStore.get()), 0);
});

test('a caixa guarda só as últimas MAX_ITEMS, mais recente primeiro', () => {
  for (let i = 0; i < MAX_ITEMS + 5; i++) pushNotificacao(`n${i}`, '');
  const list = avisosStore.get();
  assert.equal(list.length, MAX_ITEMS);
  assert.equal(list[0].title, `n${MAX_ITEMS + 4}`);
});

test('repetição idêntica seguida não vira outra notificação (laço de erro não afoga a caixa)', () => {
  for (let i = 0; i < 1000; i++) pushAviso('Esta tarefa não pode ser apagada', 'erro 409');
  assert.equal(avisosStore.get().length, 1);
  assert.equal(activeToastsStore.get().length, 1);
  pushAviso('Esta tarefa não pode ser apagada', 'outro detalhe');
  assert.equal(avisosStore.get().length, 2, 'detalhe diferente é outra notificação');
});
