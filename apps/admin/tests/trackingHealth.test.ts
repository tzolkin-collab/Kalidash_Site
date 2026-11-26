import test from 'node:test';
import assert from 'node:assert/strict';
import { deliveryLayers } from '../src/lib/trackingHealth.ts';

const c = (name: string, layer: 'meta' | 'ga4', status: string, count: number) => ({ name, layer, status, count });

test('status sai das entregas, não da credencial da API que responde', () => {
  const [meta, ga4, offline] = deliveryLayers([c('Lead', 'meta', 'sent', 2), c('Lead', 'meta', 'skipped', 1), c('Lead', 'ga4', 'sent', 2), c('Lead', 'ga4', 'skipped', 1)]);
  assert.equal(meta.status, 'Entregando');
  assert.equal(meta.detail, '2 entregues (Lead: 2). 1 evento não foi enviado porque o servidor que o recebeu estava sem credencial.');
  assert.equal(ga4.state, 'ok');
  assert.equal(offline.status, 'Sem envios');
});

test('falha, só sem credencial, nada e offline contado uma vez', () => {
  const rows = deliveryLayers([c('Lead', 'meta', 'failed', 1), c('Lead', 'ga4', 'skipped', 3), c('Purchase', 'meta', 'sent', 1), c('Purchase', 'ga4', 'sent', 1)]);
  assert.deepEqual(rows.map((r) => r.status), ['Com falhas', 'Entregando', 'Entregando']);
  assert.match(rows[2].detail, /\(Venda: 1\)/);
  assert.deepEqual(deliveryLayers([c('Lead', 'meta', 'skipped', 3)]).map((r) => r.status), ['Sem credencial', 'Sem envios', 'Sem envios']);
});
