import assert from 'node:assert/strict';
import { test } from 'node:test';
import { capabilities } from '../src/lib/roles.ts';

test('Admin pode tudo', () => {
  assert.deepEqual(capabilities('ADMIN'), { revealCpf: true, editOrigin: true, managePipelines: true, manageBlog: true, manageTeam: true });
});

test('Gerente opera o CRM e o blog, mas não a equipe', () => {
  assert.deepEqual(capabilities('MANAGER'), { revealCpf: true, editOrigin: true, managePipelines: true, manageBlog: true, manageTeam: false });
});

test('Vendedor não vê CPF inteiro, não troca origem, não mexe em funis, blog nem equipe', () => {
  assert.deepEqual(capabilities('SELLER'), { revealCpf: false, editOrigin: false, managePipelines: false, manageBlog: false, manageTeam: false });
});
