import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_UPLOAD_BYTES, checkUploadFile } from '../src/lib/uploadCheck.ts';

test('aceita JPEG, PNG, GIF e WebP até 8 MB', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/gif', 'image/webp']) assert.equal(checkUploadFile({ type, size: 1000 }), null, type);
  assert.equal(checkUploadFile({ type: 'image/png', size: MAX_UPLOAD_BYTES }), null, 'exatamente 8 MB passa');
});

test('recusa SVG, outros tipos e tipo vazio com a mensagem de formato', () => {
  for (const type of ['image/svg+xml', 'application/pdf', 'text/html', '']) {
    assert.match(String(checkUploadFile({ type, size: 10 })), /Formato não aceito/, type || '(vazio)');
  }
});

test('recusa mais de 8 MB com a mensagem de tamanho', () => {
  assert.match(String(checkUploadFile({ type: 'image/jpeg', size: MAX_UPLOAD_BYTES + 1 })), /8 MB/);
});
