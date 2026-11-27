import type { GroupRow } from './acquisitionMetrics.ts';

// Investimento em mídia (GET /api/analytics/spend, apps/api/analytics_spend.go) cruzado com os leads do CRM.
// A campanha da plataforma casa com o utm_campaign do lead pelo nome normalizado (sem acento, minúsculo, "_" no lugar
// de espaço), o mesmo formato que os Links de divulgação e a convenção de docs/tracking.md geram.

export type SpendPlatform = 'meta' | 'google';
export type SpendCampaign = { platform: SpendPlatform; id: string; name: string; spendCents: number; impressions: number; clicks: number };
export type SpendReport = {
  from: string;
  to: string;
  configured: Partial<Record<SpendPlatform, boolean>>;
  currency?: Partial<Record<SpendPlatform, string>>;
  campaigns: SpendCampaign[];
  errors: Partial<Record<SpendPlatform, string>>;
};

/** Canal do Analytics (lib/channels.ts) que corresponde a cada plataforma. */
export const PLATFORM_CHANNEL: Record<SpendPlatform, string> = { meta: 'meta_ads', google: 'google_ads' };
export const PLATFORM_LABEL: Record<SpendPlatform, string> = { meta: 'Meta Ads', google: 'Google Ads' };

export function campaignKey(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/[\s+]+/g, '_').replace(/[^a-z0-9_-]/g, '');
}

export const anyConfigured = (r: SpendReport | null) => !!r && (!!r.configured.meta || !!r.configured.google);

/** Gasto total por plataforma no período. */
export function byPlatform(r: SpendReport | null): Record<SpendPlatform, number> {
  const out: Record<SpendPlatform, number> = { meta: 0, google: 0 };
  for (const c of r?.campaigns ?? []) out[c.platform] += c.spendCents;
  return out;
}

export const platformOfChannel = (channelKey: string): SpendPlatform | undefined =>
  (Object.keys(PLATFORM_CHANNEL) as SpendPlatform[]).find((k) => PLATFORM_CHANNEL[k] === channelKey);

/** Gasto de um canal do Analytics (só Meta Ads e Google Ads têm); undefined quando o canal não é de mídia medida. */
export function channelSpend(r: SpendReport | null, channelKey: string): number | undefined {
  if (!r) return undefined;
  const p = platformOfChannel(channelKey);
  if (!p || !r.configured[p]) return undefined;
  return byPlatform(r)[p];
}

/** Moedas das plataformas ligadas que já responderam. */
const currencies = (r: SpendReport | null) =>
  (Object.keys(PLATFORM_CHANNEL) as SpendPlatform[]).filter((p) => r?.configured[p] && r.currency?.[p]).map((p) => [p, r!.currency![p]!] as const);

/** Plataformas em moedas diferentes não se somam. */
export const mixedCurrency = (r: SpendReport | null) => new Set(currencies(r).map(([, c]) => c)).size > 1;

/** Aviso quando o gasto não está em reais (a página formata tudo como R$) ou as contas usam moedas diferentes. */
export function currencyNote(r: SpendReport | null): string {
  const list = currencies(r);
  if (mixedCurrency(r)) return `As contas usam moedas diferentes (${list.map(([p, c]) => `${PLATFORM_LABEL[p]} em ${c}`).join(', ')}): o total não soma as duas e cada valor está na moeda da própria conta.`;
  const other = list.find(([, c]) => c !== 'BRL');
  return other ? `A conta do ${PLATFORM_LABEL[other[0]]} está em ${other[1]}: os valores de investimento estão nessa moeda, não em reais.` : '';
}

/** Gasto do recorte da página: tudo, ou só o canal escolhido. Sem total quando as moedas não batem. */
export function totalSpend(r: SpendReport | null, channelKey = ''): number | undefined {
  if (!anyConfigured(r)) return undefined;
  if (channelKey) return channelSpend(r, channelKey) ?? 0;
  if (mixedCurrency(r)) return undefined;
  const p = byPlatform(r);
  return p.meta + p.google;
}

/**
 * Resultado só dos canais de mídia medida (Meta Ads e Google Ads ligados): é o que o investimento comprou. Lead
 * orgânico fica fora do custo por lead qualificado e do retorno.
 */
export function paidTotals(channels: GroupRow[], r: SpendReport | null): { qualified: number; wonCents: number } {
  const keys = new Set((Object.keys(PLATFORM_CHANNEL) as SpendPlatform[]).filter((p) => r?.configured[p]).map((p) => PLATFORM_CHANNEL[p]));
  const out = { qualified: 0, wonCents: 0 };
  for (const c of channels) if (keys.has(c.key)) { out.qualified += c.qualified; out.wonCents += c.wonCents; }
  return out;
}

/** `otherTouchLeads`: leads da mesma linha no outro toque (remarketing aparece só no último, por exemplo). */
export type CampaignRow = GroupRow & { spendCents?: number; platform?: SpendPlatform; otherTouchLeads?: number };

/** Gastou e não trouxe lead em nenhum dos dois toques. */
export const isIdle = (row: CampaignRow, spentCents = row.spendCents): boolean => (spentCents ?? 0) > 0 && !row.leads && !row.otherTouchLeads;

function otherLeads(other: GroupRow[] | undefined, keyOf: (r: GroupRow) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const o of other ?? []) m.set(keyOf(o), (m.get(keyOf(o)) ?? 0) + o.leads);
  return m;
}

/**
 * Campanhas do CRM com o gasto da plataforma ao lado. Campanha com gasto e nenhum lead entra também (com zero leads):
 * é exatamente o dinheiro que precisa de atenção. Ordem: pipeline, depois gasto, depois leads.
 */
export function mergeCampaigns(rows: GroupRow[], r: SpendReport | null, other?: GroupRow[]): CampaignRow[] {
  const elsewhere = otherLeads(other, (o) => campaignKey(o.label));
  const spend = new Map<string, { cents: number; platform: SpendPlatform; name: string }>();
  for (const c of r?.campaigns ?? []) {
    const k = campaignKey(c.name);
    const cur = spend.get(k);
    spend.set(k, { cents: (cur?.cents ?? 0) + c.spendCents, platform: cur?.platform ?? c.platform, name: cur?.name ?? c.name });
  }
  const out: CampaignRow[] = rows.map((row) => {
    const s = spend.get(campaignKey(row.label));
    if (s) spend.delete(campaignKey(row.label));
    const base: CampaignRow = { ...row, otherTouchLeads: elsewhere.get(campaignKey(row.label)) ?? 0 };
    return s ? { ...base, spendCents: s.cents, platform: s.platform } : base;
  });
  for (const [k, s] of spend) {
    if (s.cents <= 0) continue;
    out.push({ key: `spend:${k}`, label: s.name, group: 'pago', leads: 0, qualified: 0, opps: 0, pipelineCents: 0, won: 0, wonCents: 0, lost: 0, spendCents: s.cents, platform: s.platform, otherTouchLeads: elsewhere.get(k) ?? 0 });
  }
  return out.sort((a, b) => b.pipelineCents - a.pipelineCents || (b.spendCents ?? 0) - (a.spendCents ?? 0) || b.leads - a.leads);
}

/** Custo por unidade (centavos); null sem gasto medido ou sem nenhuma unidade. */
export const costPer = (spendCents: number | undefined, n: number): number | null => (spendCents === undefined || !n ? null : spendCents / n);
/** Retorno: receita ÷ investimento; null sem investimento. */
export const roas = (wonCents: number, spendCents: number | undefined): number | null => (!spendCents ? null : wonCents / spendCents);

/**
 * Frase do investimento para a leitura do período: quanto custou cada lead qualificado da mídia paga (`paidQualified`,
 * de paidTotals) e quanto foi gasto em campanhas que não trouxeram lead em nenhum toque. `fmt` formata centavos.
 */
export function spendSentence(r: SpendReport | null, paidQualified: number, campaigns: CampaignRow[], fmt: (c: number) => string): string {
  const total = totalSpend(r);
  if (total === undefined || total <= 0) return '';
  const parts = [`Investimento de ${fmt(total)} em mídia${paidQualified ? `: ${fmt(total / paidQualified)} por lead qualificado da mídia paga` : ' e nenhum lead qualificado vindo dela ainda'}.`];
  const idle = campaigns.filter((c) => isIdle(c));
  if (idle.length) {
    const cents = idle.reduce((sum, c) => sum + (c.spendCents ?? 0), 0);
    parts.push(idle.length === 1 ? `A campanha ${idle[0].label} gastou ${fmt(cents)} sem trazer lead.` : `${idle.length} campanhas gastaram ${fmt(cents)} sem trazer lead.`);
  }
  return parts.join(' ');
}

/** Canais com o gasto da plataforma: Meta Ads ou Google Ads com gasto e nenhum lead no período entram com zero leads. */
export function withSpendChannels(rows: GroupRow[], r: SpendReport | null, other?: GroupRow[]): CampaignRow[] {
  const elsewhere = otherLeads(other, (o) => o.key);
  const out: CampaignRow[] = rows.map((row) => ({ ...row, otherTouchLeads: elsewhere.get(row.key) ?? 0 }));
  if (!anyConfigured(r)) return out;
  const spent = byPlatform(r);
  for (const p of Object.keys(PLATFORM_CHANNEL) as SpendPlatform[]) {
    if (!r!.configured[p] || spent[p] <= 0 || out.some((row) => row.key === PLATFORM_CHANNEL[p])) continue;
    out.push({ key: PLATFORM_CHANNEL[p], label: PLATFORM_LABEL[p], group: 'pago', leads: 0, qualified: 0, opps: 0, pipelineCents: 0, won: 0, wonCents: 0, lost: 0, otherTouchLeads: elsewhere.get(PLATFORM_CHANNEL[p]) ?? 0 });
  }
  return out;
}
