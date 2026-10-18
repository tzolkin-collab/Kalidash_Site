import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ago, effective, expiryFor, groupScopes, joinPt, overridesFor, summarize, type Catalog } from '../src/lib/scopes.ts';

const catalog: Catalog = {
  groups: ['CRM', 'Conteúdo', 'Administração'],
  scopes: [
    { id: 'leads:read', group: 'CRM', label: 'Ver leads', description: '' },
    { id: 'leads:write', group: 'CRM', label: 'Editar leads', description: '' },
    { id: 'blog:write', group: 'Conteúdo', label: 'Escrever no blog', description: '' },
    { id: 'team:manage', group: 'Administração', label: 'Gerenciar equipe', description: '', humanOnly: true },
  ],
  presets: { ADMIN: [], MANAGER: [], SELLER: ['leads:read'] },
};

test('efetivos = (preset + extras) - removidos', () => {
  assert.deepEqual(effective(['a', 'b'], ['c'], ['a']), ['b', 'c']);
  assert.deepEqual(effective([], [], ['x']), []);
});

test('overridesFor devolve só a diferença para o preset', () => {
  assert.deepEqual(overridesFor(['a', 'b'], ['b', 'c']), { extra: ['c'], denied: ['a'] });
  assert.deepEqual(overridesFor(['a', 'b'], ['a', 'b']), { extra: [], denied: [] });
  const o = overridesFor(['a', 'b'], ['b', 'c', 'd']);
  assert.deepEqual(effective(['a', 'b'], o.extra, o.denied), ['b', 'c', 'd']);
});

test('groupScopes esconde escopos só de pessoas quando pedido', () => {
  assert.deepEqual(groupScopes(catalog).map((g) => g.group), ['CRM', 'Conteúdo', 'Administração']);
  assert.deepEqual(groupScopes(catalog, { forTokens: true }).map((g) => g.group), ['CRM', 'Conteúdo']);
});

test('summarize escreve em português e marca as áreas sem acesso', () => {
  const s = summarize(catalog, ['leads:read', 'leads:write']);
  assert.equal(s[0].can, 'Ver leads e oportunidades e criar e editar leads');
  assert.equal(s[0].count, 2);
  assert.equal(s[1].can, null);
  assert.equal(s[2].total, 1);
});

test('joinPt', () => {
  assert.equal(joinPt([]), '');
  assert.equal(joinPt(['a']), 'a');
  assert.equal(joinPt(['a', 'b', 'c']), 'a, b e c');
});

test('validade: nunca expira por padrão', () => {
  assert.equal(expiryFor('never', ''), undefined);
  const now = new Date('2026-10-18T12:00:00Z');
  assert.equal(expiryFor('30', '', now), '2026-11-17T12:00:00.000Z');
  assert.equal(expiryFor('date', 'lixo'), undefined);
  assert.ok(expiryFor('date', '2027-01-01'));
});

test('ago', () => {
  const now = new Date('2026-10-18T12:00:00Z');
  assert.equal(ago(undefined, now), 'Nunca');
  assert.equal(ago('2026-10-18T11:59:30Z', now), 'agora há pouco');
  assert.equal(ago('2026-10-18T10:00:00Z', now), 'há 2 h');
  assert.equal(ago('2026-10-15T12:00:00Z', now), 'há 3 d');
});
