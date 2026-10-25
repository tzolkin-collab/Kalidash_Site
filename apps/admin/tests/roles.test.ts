import assert from 'node:assert/strict';
import { test } from 'node:test';
import { capabilities, hasScope } from '../src/lib/roles.ts';

test('Admin pode tudo', () => {
  assert.deepEqual(capabilities('ADMIN'), { revealCpf: true, editOrigin: true, managePipelines: true, manageBlog: true, manageTeam: true });
});

test('Gerente opera o CRM e o blog, mas não a equipe', () => {
  assert.deepEqual(capabilities('MANAGER'), { revealCpf: true, editOrigin: true, managePipelines: true, manageBlog: true, manageTeam: false });
});

test('Vendedor não vê CPF inteiro, não troca origem, não mexe em funis, blog nem equipe', () => {
  assert.deepEqual(capabilities('SELLER'), { revealCpf: false, editOrigin: false, managePipelines: false, manageBlog: false, manageTeam: false });
});

test('com escopos do servidor, valem os escopos e não o perfil', () => {
  const scopes = ['leads:read', 'people:document'];
  assert.equal(capabilities('SELLER', scopes).revealCpf, true);
  assert.equal(capabilities('SELLER', scopes).manageBlog, false);
  assert.equal(hasScope('SELLER', scopes, 'emails:send'), false);
  assert.equal(capabilities('MANAGER', ['blog:write']).managePipelines, false);
  assert.equal(capabilities('MANAGER', ['blog:write']).manageBlog, true);
  // sem escopos (API antiga ou sem login) vale o perfil
  assert.equal(hasScope('MANAGER', undefined, 'team:manage'), false);
  assert.equal(hasScope('ADMIN', undefined, 'team:manage'), true);
});

test('WP3b: o Vendedor vê só o que é dele (escopos own); o Gerente continua vendo tudo', () => {
  assert.equal(hasScope('SELLER', undefined, 'leads:own'), true);
  assert.equal(hasScope('SELLER', undefined, 'opportunities:own'), true);
  assert.equal(hasScope('SELLER', undefined, 'leads:read'), false);
  assert.equal(hasScope('SELLER', undefined, 'leads:write'), false);
  assert.equal(hasScope('MANAGER', undefined, 'leads:read'), true);
  assert.equal(hasScope('MANAGER', undefined, 'leads:write'), true);
  assert.equal(hasScope('ADMIN', undefined, 'leads:read'), true);
});
