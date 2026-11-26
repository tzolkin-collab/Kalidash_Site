import type { Lead, Pipeline } from '../domain.ts';
import type { Opportunity } from '../types.ts';
import { attributionOf, campaignOf, channelOf, landingOf, UNTRACKED_KEY } from './channels.ts';
import type { Channel, Touch } from './channels.ts';
import { stageInfo, toCents } from './salesMetrics.ts';

// Métricas de aquisição (página Analytics). Coorte: os leads CRIADOS no período, e tudo o que eles geraram depois
// (oportunidade, venda), mesmo que a venda tenha fechado fora do período. É a leitura certa para comparar canais num
// ciclo longo: o canal recebe o crédito pelo pipeline e pela receita que abriu. Somas em centavos inteiros.

/** Abaixo disto uma taxa não é mostrada (5 de 6 não é 83% de nada). */
export const MIN_BASE = 5;
/** Acima disto a leitura por canal não é confiável (leads sem origem). */
export const UNTRACKED_ALERT = 0.3;

export type Window = { from: number; to: number } | null;

export type Outcome = {
  lead: Lead;
  channel: Channel;
  qualified: boolean;
  hasOpp: boolean;
  pipelineCents: number;
  won: boolean;
  wonCents: number;
  lost: boolean;
  /** Dias do lead até o ganho (só ganhos com data). */
  cycleDays?: number;
};

export type Totals = {
  leads: number;
  qualified: number;
  opps: number;
  pipelineCents: number;
  won: number;
  wonCents: number;
  lost: number;
};

const emptyTotals = (): Totals => ({ leads: 0, qualified: 0, opps: 0, pipelineCents: 0, won: 0, wonCents: 0, lost: 0 });

function add(t: Totals, o: Outcome): void {
  t.leads++;
  if (o.qualified) t.qualified++;
  if (o.hasOpp) t.opps++;
  t.pipelineCents += o.pipelineCents;
  if (o.won) { t.won++; t.wonCents += o.wonCents; }
  if (o.lost) t.lost++;
}

/** Taxa a/b, ou null quando a base é pequena demais para dizer algo. */
export const rate = (a: number, b: number): number | null => (b >= MIN_BASE ? a / b : null);

const inWindow = (iso: string | undefined, w: Window) => {
  if (!w) return true;
  const t = iso ? Date.parse(iso) : NaN;
  return !Number.isNaN(t) && t >= w.from && t <= w.to;
};

/** Leads inbound e outbound não arquivados criados na janela. */
export const cohort = (leads: Lead[], w: Window): Lead[] => leads.filter((l) => !l.archivedAt && inWindow(l.createdAt, w));

/**
 * O que cada lead da coorte gerou: oportunidade (pelo convertedOpportunityId do lead ou pelo leadId da oportunidade),
 * valor dela (pipeline) e se foi ganha ou perdida.
 */
export function outcomes(leads: Lead[], opps: Opportunity[], pipelines: Pipeline[], touch: Touch): Outcome[] {
  const byId = new Map<string, Opportunity>();
  const byLead = new Map<string, Opportunity>();
  for (const o of opps) {
    if (o.isLead || o.isSample) continue;
    byId.set(o.id, o);
    if (o.leadId) byLead.set(o.leadId, o);
  }
  return leads.map((lead) => {
    const opp = (lead.convertedOpportunityId && byId.get(lead.convertedOpportunityId)) || byLead.get(lead.id);
    const kind = opp ? stageInfo(opp.stage, pipelines)?.kind : undefined;
    const counted = !!opp && kind !== 'LEAD';
    const won = counted && kind === 'WON';
    const cents = counted ? toCents(opp!.value) : 0;
    const wonAt = won && opp!.wonAt ? Date.parse(opp!.wonAt) : NaN;
    const created = Date.parse(lead.createdAt);
    return {
      lead,
      channel: channelOf(lead, touch),
      qualified: lead.status === 'QUALIFIED' || counted,
      hasOpp: counted,
      pipelineCents: cents,
      won,
      wonCents: won ? cents : 0,
      lost: counted && kind === 'LOST',
      cycleDays: !Number.isNaN(wonAt) && !Number.isNaN(created) && wonAt >= created ? (wonAt - created) / 86_400_000 : undefined,
    };
  });
}

export type Summary = Totals & { medianCycleDays: number | null; leadToWon: number | null; leadToQualified: number | null };

export function summary(rows: Outcome[]): Summary {
  const t = emptyTotals();
  const cycles: number[] = [];
  for (const o of rows) {
    add(t, o);
    if (o.cycleDays !== undefined) cycles.push(o.cycleDays);
  }
  cycles.sort((a, b) => a - b);
  const mid = cycles.length >> 1;
  const median = !cycles.length ? null : cycles.length % 2 ? cycles[mid] : (cycles[mid - 1] + cycles[mid]) / 2;
  return { ...t, medianCycleDays: median, leadToWon: rate(t.won, t.leads), leadToQualified: rate(t.qualified, t.leads) };
}

export type GroupRow = Totals & { key: string; label: string; group?: Channel['group'] };

function groupBy(rows: Outcome[], keyOf: (o: Outcome) => { key: string; label: string; group?: Channel['group'] } | null): GroupRow[] {
  const map = new Map<string, GroupRow>();
  for (const o of rows) {
    const k = keyOf(o);
    if (!k) continue;
    const row = map.get(k.key) ?? { ...emptyTotals(), ...k };
    add(row, o);
    map.set(k.key, row);
  }
  // Pipeline gerado manda; empate: receita, depois leads.
  return [...map.values()].sort((a, b) => b.pipelineCents - a.pipelineCents || b.wonCents - a.wonCents || b.leads - a.leads || a.label.localeCompare(b.label));
}

export const byChannel = (rows: Outcome[]): GroupRow[] => groupBy(rows, (o) => o.channel);

/** Campanhas (utm_campaign) do toque escolhido; leads sem campanha ficam de fora. */
export const byCampaign = (rows: Outcome[], touch: Touch): GroupRow[] =>
  groupBy(rows, (o) => {
    const c = campaignOf(o.lead, touch);
    return c ? { key: c, label: c, group: o.channel.group } : null;
  });

/** Orgânico por peça: rede + utm_content (o que os Links de divulgação geram). Só social orgânico e mensagens. */
export const byOrganicPiece = (rows: Outcome[]): GroupRow[] =>
  groupBy(rows, (o) => {
    if (o.channel.group !== 'organico' && o.channel.group !== 'mensagem') return null;
    const a = attributionOf(o.lead);
    const content = a.utm_content || a.first_utm_content || 'sem peça';
    const campaign = campaignOf(o.lead, 'last') || campaignOf(o.lead, 'first');
    return { key: `${o.channel.key}|${campaign}|${content}`, label: `${o.channel.label} · ${campaign || 'sem tema'} · ${content}`, group: o.channel.group };
  });

/** Páginas de entrada que geram lead. */
export const byLanding = (rows: Outcome[]): GroupRow[] =>
  groupBy(rows, (o) => {
    const path = landingOf(o.lead);
    return path ? { key: path, label: path } : null;
  });

export type SignupRow = { page: string; newsletter: number; material: number };

/** Inscrições de newsletter e material por artigo (fonte blog-newsletter-<lugar>[-<slug>]). */
export function signupsByPage(leads: Lead[]): SignupRow[] {
  const map = new Map<string, SignupRow>();
  for (const l of leads) {
    const src = String(l.customData?.formSource ?? l.customData?.source ?? '');
    if (!src.startsWith('blog-newsletter')) continue;
    const page = landingOf(l) || '(sem página)';
    const row = map.get(page) ?? { page, newsletter: 0, material: 0 };
    if (src.startsWith('blog-newsletter-material')) row.material++;
    else row.newsletter++;
    map.set(page, row);
  }
  return [...map.values()].sort((a, b) => b.material + b.newsletter - (a.material + a.newsletter) || a.page.localeCompare(b.page));
}

export type Quality = {
  inbound: number;
  untracked: number;
  untrackedShare: number | null;
  withUtm: number;
  withMetaCookie: number;
  alert: boolean;
};

/**
 * Qualidade da origem nos leads inbound do site (projetos conectados e outbound ficam fora: a origem deles não vem de
 * UTM). Sem origem acima de UNTRACKED_ALERT liga o aviso de leitura não confiável.
 */
export function quality(rows: Outcome[]): Quality {
  const site = rows.filter((o) => o.channel.group !== 'outbound' && o.channel.group !== 'projeto');
  const untracked = site.filter((o) => o.channel.key === UNTRACKED_KEY).length;
  const withUtm = site.filter((o) => { const a = attributionOf(o.lead); return !!(a.utm_source || a.first_utm_source); }).length;
  const withMetaCookie = site.filter((o) => { const a = attributionOf(o.lead); return !!(a._fbp || a._fbc || a.fbclid); }).length;
  const share = rate(untracked, site.length);
  return { inbound: site.length, untracked, untrackedShare: share, withUtm, withMetaCookie, alert: share !== null && share > UNTRACKED_ALERT };
}
