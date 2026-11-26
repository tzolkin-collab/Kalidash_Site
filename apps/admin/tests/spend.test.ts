import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignKey, channelSpend, costPer, mergeCampaigns, roas, spendSentence, totalSpend } from '../src/lib/spend.ts';
import type { SpendReport } from '../src/lib/spend.ts';

const row = (label: string, extra: object = {}) => ({ key: label, label, group: 'pago' as const, leads: 2, qualified: 1, opps: 1, pipelineCents: 500000, won: 0, wonCents: 0, lost: 0, ...extra });
const report: SpendReport = {
  from: '2026-10-01', to: '2026-10-31', configured: { meta: true, google: true }, errors: {},
  campaigns: [
    { platform: 'meta', id: '1', name: 'Diagnóstico Out/26', spendCents: 200000, impressions: 0, clicks: 0 },
    { platform: 'google', id: '2', name: 'marca', spendCents: 50000, impressions: 0, clicks: 0 },
    { platform: 'meta', id: '3', name: 'remarketing_blog', spendCents: 30000, impressions: 0, clicks: 0 },
  ],
};

test('campanha casa pelo nome normalizado; gasto sem lead entra com zero leads', () => {
  assert.equal(campaignKey('Diagnóstico Out/26'), 'diagnostico_out26');
  const rows = mergeCampaigns([row('diagnostico_out26', { wonCents: 600000 }), row('guia_ia', { pipelineCents: 0 })], report);
  assert.deepEqual(rows.map((r) => [r.label, r.leads, r.spendCents ?? null]), [
    ['diagnostico_out26', 2, 200000], ['marca', 0, 50000], ['remarketing_blog', 0, 30000], ['guia_ia', 2, null],
  ]);
  assert.equal(roas(rows[0].wonCents, rows[0].spendCents), 3);
  assert.equal(costPer(rows[0].spendCents, rows[0].qualified), 200000);
  assert.equal(costPer(undefined, 3), null);
});

test('gasto por canal e total do recorte', () => {
  assert.equal(channelSpend(report, 'meta_ads'), 230000);
  assert.equal(channelSpend(report, 'google_ads'), 50000);
  assert.equal(channelSpend(report, 'org_instagram'), undefined);
  assert.equal(totalSpend(report), 280000);
  assert.equal(totalSpend(report, 'org_instagram'), 0);
  assert.equal(totalSpend({ ...report, configured: {} }), undefined);
  assert.equal(channelSpend({ ...report, configured: { meta: true } }, 'google_ads'), undefined);
});

test('frase do investimento', () => {
  const fmt = (c: number) => `R$ ${c / 100}`;
  const rows = mergeCampaigns([row('diagnostico_out26')], report);
  assert.equal(spendSentence(report, 4, rows, fmt), 'Investimento de R$ 2800 em mídia: R$ 700 por lead qualificado. 2 campanhas gastaram R$ 800 sem trazer lead.');
  assert.equal(spendSentence({ ...report, configured: {} }, 4, rows, fmt), '');
});

test('canal pago com gasto e sem lead aparece na tabela de canais', async () => {
  const { withSpendChannels } = await import('../src/lib/spend.ts');
  const rows = withSpendChannels([row('Direto / sem origem', { key: 'direto', group: 'direto' })], report);
  assert.deepEqual(rows.map((r) => [r.key, r.leads]), [['direto', 2], ['meta_ads', 0], ['google_ads', 0]]);
  assert.equal(withSpendChannels([], { ...report, configured: {} }).length, 0);
});
