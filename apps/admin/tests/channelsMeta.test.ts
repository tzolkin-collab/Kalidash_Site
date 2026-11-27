import { test } from 'node:test';
import assert from 'node:assert/strict';
import { channelOf } from '../src/lib/channels.ts';

const channel = (utm_source: string, utm_medium: string) =>
  channelOf({ origin: 'INBOUND', sourceName: 'Site', customData: { attribution: { utm_source, utm_medium } } }, 'last').key;

test('UTM antiga da conta (placement + nome do conjunto) é Meta Ads', () => {
  for (const source of ['fb', 'ig', 'an', 'msg']) assert.equal(channel(source, 'advantage-videos'), 'meta_ads', source);
  assert.equal(channel('IG', '01_interesses_tecnologia'), 'meta_ads');
});

test('orgânico continua orgânico', () => {
  assert.equal(channel('instagram', 'social'), 'org_instagram');
  assert.equal(channel('ig', 'social'), 'org_instagram');
  assert.notEqual(channel('fb', 'email'), 'meta_ads');
  assert.notEqual(channel('ig', ''), 'meta_ads');
});
