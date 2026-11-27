import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountDomain, providerOfChannel, providerOfSource } from '../src/lib/brandLogos.ts';

test('cada canal com dono tem o provedor certo', () => {
  assert.equal(providerOfChannel('google_ads'), 'google_ads');
  assert.equal(providerOfChannel('meta_ads'), 'meta');
  assert.equal(providerOfChannel('org_linkedin'), 'linkedin');
  assert.equal(providerOfChannel('org_instagram'), 'instagram');
  assert.equal(providerOfChannel('pago_tiktok'), 'tiktok');
  assert.equal(providerOfSource('IG'), 'instagram');
});

test('canal sem dono não finge ter logo', () => {
  for (const k of ['direto', 'outbound', 'busca', 'indicacao', 'email', 'outro_parceiro']) assert.equal(providerOfChannel(k), undefined);
});

test('conta: site da empresa vale mais que o e-mail', () => {
  assert.equal(accountDomain('www.Acme.com.br/sobre', 'a@outra.com'), 'acme.com.br');
  assert.equal(accountDomain(undefined, 'ana@acme.com.br'), 'acme.com.br');
});

test('conta: e-mail pessoal, domínio de teste e texto solto ficam sem favicon', () => {
  assert.equal(accountDomain(undefined, 'ana@gmail.com'), undefined);
  assert.equal(accountDomain(undefined, 'lead1@exemplo.test'), undefined);
  assert.equal(accountDomain(undefined, 'sem-arroba'), undefined);
  assert.equal(accountDomain('não é um site', ''), undefined);
});
