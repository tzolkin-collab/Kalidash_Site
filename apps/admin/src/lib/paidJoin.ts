import type { Outcome } from './acquisitionMetrics.ts';
import { attributionOf } from './channels.ts';
import { isoDay } from './paidMedia.ts';
import type { AdRow } from './paidMedia.ts';

// Junta o que veio da Meta (uma linha por anúncio e dia) com o CRM: cada lead vai para o anúncio que o trouxe, no
// dia em que entrou. Reconhece o padrão novo (utm_content = ID do anúncio) e o antigo (nomes da campanha e do
// anúncio). Sem React (tests/paidJoin.test.ts).

/** Linha como a API entrega: sem os números do CRM. */
export type MetaRow = Omit<AdRow, 'leads' | 'qualified' | 'sales' | 'revenue'>;

/** Mesma comparação da API para UTMs: sem acento, minúsculo, sem separadores. */
const key = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');

export type Joined = { rows: AdRow[]; unmatched: number };

export function joinCrm(meta: MetaRow[], outcomes: Outcome[], period: { from: string; to: string }): Joined {
  const rows: AdRow[] = meta.map((r) => ({ ...r, leads: 0, qualified: 0, sales: 0, revenue: 0 }));
  const byDay = new Map(rows.map((r) => [`${r.adId}|${r.date}`, r]));
  // Por anúncio, a linha de maior gasto: dela saem os nomes e a estrutura.
  const ads = new Map<string, AdRow>();
  const spent = new Map<string, number>();
  for (const r of rows) {
    spent.set(r.adId, (spent.get(r.adId) ?? 0) + r.spend);
    if (!ads.has(r.adId)) ads.set(r.adId, r);
  }
  // Nomes repetidos: fica o anúncio que mais gastou no período.
  const byName = new Map<string, string>();
  for (const [id, r] of [...ads].sort((a, b) => (spent.get(a[0]) ?? 0) - (spent.get(b[0]) ?? 0))) byName.set(`${key(r.campaignName)}|${key(r.adName)}`, id);

  let unmatched = 0;
  for (const o of outcomes) {
    const day = isoDay(new Date(o.lead.createdAt));
    if (day < period.from || day > period.to) continue;
    const a = attributionOf(o.lead);
    const content = a.utm_content ?? '';
    const id = ads.has(content) ? content : content && a.utm_campaign ? byName.get(`${key(a.utm_campaign)}|${key(content)}`) : undefined;
    if (!id) {
      if (o.channel.key === 'meta_ads') unmatched++;
      continue;
    }
    let row = byDay.get(`${id}|${day}`);
    if (!row) {
      // o lead entrou num dia sem entrega: linha só com o resultado do CRM
      row = { ...ads.get(id)!, date: day, spend: 0, impressions: 0, clicks: 0, pageViews: 0, views3s: 0, leads: 0, qualified: 0, sales: 0, revenue: 0 };
      byDay.set(`${id}|${day}`, row);
      rows.push(row);
    }
    row.leads++;
    if (o.qualified) row.qualified++;
    if (o.won) { row.sales++; row.revenue += o.wonCents; }
  }
  return { rows, unmatched };
}
