import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAssetUrl, SITE_URL } from '../src/lib/site.ts';

test('resolveAssetUrl converte caminhos relativos em absolutos com SITE_URL', () => {
  assert.equal(resolveAssetUrl('/kalidash-hero-sculpture.png'), `${SITE_URL}/kalidash-hero-sculpture.png`);
  assert.equal(resolveAssetUrl('/images/capa.jpg'), `${SITE_URL}/images/capa.jpg`);
  assert.equal(resolveAssetUrl('  /foto.webp  '), `${SITE_URL}/foto.webp`);
});

test('resolveAssetUrl preserva URLs absolutas ou protocolo-relativo', () => {
  assert.equal(resolveAssetUrl('https://r2.kalidash.com.br/foto.webp'), 'https://r2.kalidash.com.br/foto.webp');
  assert.equal(resolveAssetUrl('http://outro.site/img.png'), 'http://outro.site/img.png');
  assert.equal(resolveAssetUrl('//cdn.example.com/lib.js'), '//cdn.example.com/lib.js');
});

test('resolveAssetUrl lida com strings vazias, nulos ou indefinidos', () => {
  assert.equal(resolveAssetUrl(''), '');
  assert.equal(resolveAssetUrl(null), '');
  assert.equal(resolveAssetUrl(undefined), '');
  assert.equal(resolveAssetUrl('   '), '');
});
