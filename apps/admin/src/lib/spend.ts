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

/** Gasto do recorte da página: tudo, ou só o canal escolhido. */
export function totalSpend(r: SpendReport | null, channelKey = ''): number | undefined {
  if (!anyConfigured(r)) return undefined;
  if (channelKey) return channelSpend(r, channelKey) ?? 0;
  const p = byPlatform(r);
  return p.meta + p.google;
}

export type CampaignRow = GroupRow & { spendCents?: number; platform?: SpendPlatform };

/**
 * Campanhas do CRM com o gasto da plataforma ao lado. Campanha com gasto e nenhum lead entra também (com zero leads):
 * é exatamente o dinheiro que precisa de atenção. Ordem: pipeline, depois gasto, depois leads.
 */
export function mergeCampaigns(rows: GroupRow[], r: SpendReport | null): CampaignRow[] {
  const spend = new Map<string, { cents: number; platform: SpendPlatform; name: string }>();
  for (const c of r?.campaigns ?? []) {
    const k = campaignKey(c.name);
    const cur = spend.get(k);
    spend.set(k, { cents: (cur?.cents ?? 0) + c.spendCents, platform: cur?.platform ?? c.platform, name: cur?.name ?? c.name });
  }
  const out: CampaignRow[] = rows.map((row) => {
    const s = spend.get(campaignKey(row.label));
    if (s) spend.delete(campaignKey(row.label));
    return s ? { ...row, spendCents: s.cents, platform: s.platform } : { ...row };
  });
  for (const [k, s] of spend) {
    if (s.cents <= 0) continue;
    out.push({ key: `spend:${k}`, label: s.name, group: 'pago', leads: 0, qualified: 0, opps: 0, pipelineCents: 0, won: 0, wonCents: 0, lost: 0, spendCents: s.cents, platform: s.platform });
  }
  return out.sort((a, b) => b.pipelineCents - a.pipelineCents || (b.spendCents ?? 0) - (a.spendCents ?? 0) || b.leads - a.leads);
}

/** Custo por unidade (centavos); null sem gasto medido ou sem nenhuma unidade. */
export const costPer = (spendCents: number | undefined, n: number): number | null => (spendCents === undefined || !n ? null : spendCents / n);
/** Retorno: receita ÷ investimento; null sem investimento. */
export const roas = (wonCents: number, spendCents: number | undefined): number | null => (!spendCents ? null : wonCents / spendCents);

/**
 * Frase do investimento para a leitura do período: quanto custou cada lead qualificado e quanto foi gasto em
 * campanhas que não trouxeram nenhum lead. `fmt` formata centavos.
 */
export function spendSentence(r: SpendReport | null, qualified: number, campaigns: CampaignRow[], fmt: (c: number) => string): string {
  const total = totalSpend(r);
  if (total === undefined || total <= 0) return '';
  const parts = [`Investimento de ${fmt(total)} em mídia${qualified ? `: ${fmt(total / qualified)} por lead qualificado` : ' e nenhum lead qualificado ainda'}.`];
  const idle = campaigns.filter((c) => !c.leads && (c.spendCents ?? 0) > 0);
  if (idle.length) {
    const cents = idle.reduce((sum, c) => sum + (c.spendCents ?? 0), 0);
    parts.push(idle.length === 1 ? `A campanha ${idle[0].label} gastou ${fmt(cents)} sem trazer lead.` : `${idle.length} campanhas gastaram ${fmt(cents)} sem trazer lead.`);
  }
  return parts.join(' ');
}

/** Canais com o gasto da plataforma: Meta Ads ou Google Ads com gasto e nenhum lead no período entram com zero leads. */
export function withSpendChannels(rows: GroupRow[], r: SpendReport | null): GroupRow[] {
  if (!anyConfigured(r)) return rows;
  const spent = byPlatform(r);
  const out = [...rows];
  for (const p of Object.keys(PLATFORM_CHANNEL) as SpendPlatform[]) {
    if (!r!.configured[p] || spent[p] <= 0 || out.some((row) => row.key === PLATFORM_CHANNEL[p])) continue;
    out.push({ key: PLATFORM_CHANNEL[p], label: PLATFORM_LABEL[p], group: 'pago', leads: 0, qualified: 0, opps: 0, pipelineCents: 0, won: 0, wonCents: 0, lost: 0 });
  }
  return out;
}
