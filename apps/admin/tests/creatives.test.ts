import { test } from 'node:test';
import assert from 'node:assert/strict';
import { belongsTo, captionWithLink, creativeLeads, placementTip } from '../src/lib/creativeRules.ts';

test('o ID do criativo fecha o utm_content, sem pegar outro parecido', () => {
  assert.ok(belongsTo('stories_cr7k2m9q', 'cr7k2m9q'));
  assert.ok(belongsTo('cr7k2m9q', 'cr7k2m9q'));
  assert.ok(!belongsTo('stories_xcr7k2m9q', 'cr7k2m9q'));
  assert.ok(!belongsTo('cr7k2m9q_stories', 'cr7k2m9q'));
});

test('leads do criativo ignoram arquivados e sem atribuição', () => {
  const lead = (utm?: string, archivedAt?: string) => ({ archivedAt, customData: utm ? { attribution: { utm_content: utm } } : undefined });
  const list = [lead('bio_cr1'), lead('bio_cr1', '2026-01-01'), lead('bio_cr2'), lead()];
  assert.equal(creativeLeads(list, 'cr1').length, 1);
});

test('texto para colar e dica por lugar', () => {
  assert.equal(captionWithLink('  Olá  ', 'https://x/l/a'), 'Olá\n\nhttps://x/l/a');
  assert.equal(captionWithLink('', 'https://x/l/a'), 'https://x/l/a');
  assert.match(placementTip('ig-stories'), /adesivo/);
  assert.equal(placementTip('li-post'), '');
});
