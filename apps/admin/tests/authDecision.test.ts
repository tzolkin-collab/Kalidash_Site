import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyMe, decideAuth } from '../src/lib/authDecision.ts';

test('classifyMe', () => {
  assert.equal(classifyMe(200), 'ok');
  assert.equal(classifyMe(401), 'unauthorized');
  assert.equal(classifyMe(404), 'missing');
  assert.equal(classifyMe(502), 'failed');
  assert.equal(classifyMe(null), 'failed');
});

test('login ligado + servidor inalcançável: tela de sem conexão, nunca modo de exemplo', () => {
  assert.equal(decideAuth('failed', true), 'unreachable');
});

test('API nunca configurada (desenvolvimento): segue em modo de exemplo', () => {
  assert.equal(decideAuth('failed', false), 'off');
  assert.equal(decideAuth('missing', false), 'off');
});

test('rota inexistente é API sem login, mesmo com indicador antigo', () => {
  assert.equal(decideAuth('missing', true), 'off');
});

test('build de produção nunca abre sem login', () => {
  assert.equal(decideAuth('failed', false, false), 'unreachable');
  assert.equal(decideAuth('failed', true, false), 'unreachable');
  assert.equal(decideAuth('missing', false, false), 'nologin');
  assert.equal(decideAuth('missing', true, false), 'nologin');
  assert.equal(decideAuth('ok', false, false), 'in');
  assert.equal(decideAuth('unauthorized', false, false), 'anon');
});

test('respostas normais', () => {
  assert.equal(decideAuth('ok', false), 'in');
  assert.equal(decideAuth('unauthorized', false), 'anon');
});
