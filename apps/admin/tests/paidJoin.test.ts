import { test } from 'node:test';
import assert from 'node:assert/strict';
import { joinCrm } from '../src/lib/paidJoin.ts';
import type { MetaRow } from '../src/lib/paidJoin.ts';
import type { Outcome } from '../src/lib/acquisitionMetrics.ts';

const meta = (adId: string, date: string, spend: number, adName = 'Vídeo de abertura', campaignName = 'Curso IA'): MetaRow => ({
  date, adId, adName, campaignName, spend, impressions: 10, clicks: 1, pageViews: 1, views3s: 0,
  accountId: '1', accountName: 'Conta', campaignId: 'c', campaignStatus: 'ACTIVE', adsetId: 's', adsetName: 'S', adsetStatus: 'ACTIVE', adStatus: 'ACTIVE', creativeId: 'cr', format: 'video',
});
const lead = (utm_content: string, utm_campaign: string, extra: Partial<Outcome> = {}, createdAt = '2026-11-10T15:00:00'): Outcome => ({
  lead: { createdAt, customData: { attribution: { utm_content, utm_campaign } } } as unknown as Outcome['lead'],
  channel: { key: 'meta_ads', label: 'Meta Ads', group: 'pago' }, qualified: false, hasOpp: false, pipelineCents: 0, won: false, wonCents: 0, lost: false, ...extra,
});
const period = { from: '2026-11-01', to: '2026-11-30' };

test('lead entra pelo ID do anúncio, no dia dele, com venda e faturamento', () => {
  const { rows, unmatched } = joinCrm([meta('111', '2026-11-10', 500)], [lead('111', 'x', { qualified: true, won: true, wonCents: 900 })], period);
  assert.deepEqual([rows.length, rows[0].leads, rows[0].qualified, rows[0].sales, rows[0].revenue, unmatched], [1, 1, 1, 1, 900, 0]);
});

test('padrão antigo reconhece pelos nomes normalizados; nome repetido fica com quem mais gastou', () => {
  const rows = joinCrm([meta('111', '2026-11-10', 100), meta('222', '2026-11-10', 900)], [lead('video_de_abertura', 'curso_ia')], period).rows;
  assert.deepEqual(rows.map((r) => r.leads), [0, 1]);
});

test('dia sem entrega ganha linha só do CRM, sem inventar gasto', () => {
  const { rows } = joinCrm([meta('111', '2026-11-05', 500)], [lead('111', 'x')], period);
  assert.equal(rows.length, 2);
  assert.deepEqual([rows[1].date, rows[1].spend, rows[1].leads], ['2026-11-10', 0, 1]);
});

test('fora do período não conta; Meta Ads sem anúncio reconhecido é contado à parte', () => {
  const out = joinCrm([meta('111', '2026-11-10', 500)], [lead('111', 'x', {}, '2026-10-01T12:00:00'), lead('desconhecido', 'x')], period);
  assert.deepEqual([out.rows[0].leads, out.unmatched], [0, 1]);
});
