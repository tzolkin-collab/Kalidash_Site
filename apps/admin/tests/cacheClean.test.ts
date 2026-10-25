import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clearUserCaches } from '../src/lib/cacheClean.ts';

test('clearUserCaches apaga tudo, menos o precache do app shell', async () => {
  const left = new Set(['workbox-precache-v2-https://admin.kalidash.com/', 'api-data', 'runtime-x']);
  (globalThis as unknown as { caches: unknown }).caches = {
    keys: async () => [...left],
    delete: async (k: string) => left.delete(k),
  };
  await clearUserCaches();
  assert.deepEqual([...left], ['workbox-precache-v2-https://admin.kalidash.com/']);
});

test('clearUserCaches não quebra sem Cache Storage', async () => {
  delete (globalThis as unknown as { caches?: unknown }).caches;
  await clearUserCaches();
});
