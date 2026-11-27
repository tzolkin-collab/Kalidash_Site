import { useEffect, useMemo, useState } from 'react';
import { useOpportunities } from '../../lib/useOpportunities';
import { useStore } from '../../lib/store';
import { leadsStore } from '../../mocks/leads';
import { pipelinesStore } from '../../mocks/pipelines';
import type { Period } from '../../lib/salesMetrics';
import { periodWindows } from '../../lib/commercialMetrics';
import { attributionOf, campaignOf } from '../../lib/channels';
import type { Touch } from '../../lib/channels';
import { accountDomain } from '../../lib/brandLogos';
import { byCampaign, byChannel, cohort, outcomes, quality, summary } from '../../lib/acquisitionMetrics';
import type { Window } from '../../lib/acquisitionMetrics';
import { listLinks } from '../../lib/campaignLinks';
import type { CampaignLink } from '../../lib/campaignLinks';
import { loadSpend, loadTrackingHealth } from '../../lib/analyticsApi';
import type { TrackingHealth } from '../../lib/analyticsApi';
import { anyConfigured, channelSpend, mergeCampaigns, paidTotals, platformOfChannel, totalSpend, withSpendChannels } from '../../lib/spend';
import type { CampaignRow, SpendReport } from '../../lib/spend';

/** Data local AAAA-MM-DD (a rota de investimento usa o dia da conta de anúncios, não UTC). */
const ymd = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** Dados e filtros compartilhados pelas abas do Analytics (período, toque e canal escolhido). Só leitura. */
export function useAcquisition() {
  const { opportunities, error: oppError, reload } = useOpportunities();
  const [pipelines] = useStore(pipelinesStore);
  const [leads] = useStore(leadsStore);
  const [period, setPeriod] = useState<Period>('90d');
  const [touch, setTouch] = useState<Touch>('first');
  const [channel, setChannel] = useState('');
  const [links, setLinks] = useState<CampaignLink[]>([]);
  const [health, setHealth] = useState<TrackingHealth | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [spend, setSpend] = useState<SpendReport | null>(null);
  const [spendError, setSpendError] = useState<string | null>(null);

  useEffect(() => {
    listLinks().then(setLinks).catch(() => setLinks([]));
    loadTrackingHealth(30).then(setHealth).catch((e: unknown) => setHealthError(e instanceof Error ? e.message : 'erro'));
  }, []);

  const windows = useMemo(() => periodWindows(period), [period]);
  const win = useMemo<Window>(() => (windows ? { from: windows.from, to: windows.to } : null), [windows]);
  const prevWin = useMemo<Window>(() => (windows ? { from: windows.prevFrom, to: windows.prevTo } : null), [windows]);

  // Janela do investimento em dias locais; em "Tudo", desde o lead mais antigo (a API limita a 37 meses).
  const [today] = useState(() => Date.now());
  const spendFrom = useMemo(() => {
    if (win) return ymd(win.from);
    return ymd(leads.reduce((m, l) => Math.min(m, Date.parse(l.createdAt) || m), today));
  }, [win, leads, today]);
  const spendTo = ymd(win ? Math.min(win.to, today) : today);
  useEffect(() => {
    let live = true;
    loadSpend(spendFrom, spendTo)
      .then((r) => { if (live) { setSpend(r); setSpendError(null); } })
      .catch((e: unknown) => { if (live) setSpendError(e instanceof Error ? e.message : 'erro'); });
    return () => { live = false; };
  }, [spendFrom, spendTo]);
  const spendOn = anyConfigured(spend);

  const all = useMemo(() => outcomes(cohort(leads, win), opportunities, pipelines, touch), [leads, win, opportunities, pipelines, touch]);
  const channels = useMemo(() => byChannel(all), [all]);
  // O outro toque só serve para não acusar "gastou sem trazer lead" em remarketing (lead que aparece só no último).
  const otherTouch: Touch = touch === 'first' ? 'last' : 'first';
  const allOther = useMemo(() => outcomes(cohort(leads, win), opportunities, pipelines, otherTouch), [leads, win, opportunities, pipelines, otherTouch]);
  const campaignsOther = useMemo(() => byCampaign(allOther, otherTouch), [allOther, otherTouch]);
  const rows = useMemo(() => (channel ? all.filter((o) => o.channel.key === channel) : all), [all, channel]);
  const prevRows = useMemo(() => {
    if (!prevWin) return null;
    const p = outcomes(cohort(leads, prevWin), opportunities, pipelines, touch);
    return channel ? p.filter((o) => o.channel.key === channel) : p;
  }, [leads, prevWin, opportunities, pipelines, touch, channel]);

  const s = useMemo(() => summary(rows), [rows]);
  const prev = useMemo(() => (prevRows ? summary(prevRows) : null), [prevRows]);
  const q = useMemo(() => quality(all), [all]);
  // Com canal escolhido, só o gasto da plataforma daquele canal entra nas campanhas (outros canais não têm gasto).
  const campaigns = useMemo<CampaignRow[]>(() => {
    const base = byCampaign(rows, touch);
    if (!spendOn || !spend) return base;
    const p = channel ? platformOfChannel(channel) : undefined;
    if (channel && !p) return base;
    return mergeCampaigns(base, p ? { ...spend, campaigns: spend.campaigns.filter((c) => c.platform === p) } : spend, campaignsOther);
  }, [rows, touch, spend, spendOn, channel, campaignsOther]);

  const channelRows = useMemo(() => withSpendChannels(channels, spend, byChannel(allOther)), [channels, spend, allOther]);
  const pickedPlatform = channel ? platformOfChannel(channel) : undefined;
  // Custo por qualificado e retorno contam só o que a mídia trouxe; canal sem mídia medida não tem custo.
  const paid = channel ? (pickedPlatform ? { qualified: s.qualified, wonCents: s.wonCents } : null) : paidTotals(channels, spend);

  // Canal que mais trouxe leads para cada campanha: é dele o logo mostrado ao lado do nome.
  const campaignChannel = useMemo(() => {
    const tally = new Map<string, Map<string, number>>();
    for (const o of [...allOther, ...all]) {
      const c = campaignOf(o.lead, touch).toLowerCase();
      if (!c) continue;
      const m = tally.get(c) ?? new Map<string, number>();
      m.set(o.channel.key, (m.get(o.channel.key) ?? 0) + 1);
      tally.set(c, m);
    }
    return new Map([...tally].map(([c, m]) => [c, [...m].sort((x, y) => y[1] - x[1])[0][0]]));
  }, [all, allOther, touch]);

  // Projeto conectado não é um provedor: o logo dele é o favicon do site de onde os leads vieram.
  const projectDomain = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of all) {
      if (o.channel.group !== 'projeto' || map.has(o.channel.key)) continue;
      const a = attributionOf(o.lead);
      const domain = accountDomain(a.page_url || a.landing_page);
      if (domain) map.set(o.channel.key, domain);
    }
    return map;
  }, [all]);

  return {
    campaignChannel, projectDomain,
    opportunities, oppError, reload, pipelines, leads,
    period, setPeriod, touch, setTouch, channel, setChannel,
    pickedLabel: channelRows.find((c) => c.key === channel)?.label,
    links, health, healthError,
    spend, spendError, spendOn, spent: totalSpend(spend, channel), paid, pickedPlatform,
    spendOfChannel: spendOn ? (key: string) => channelSpend(spend, key) : undefined,
    win, prevWin, all, rows, prevRows, s, prev, q, channels, channelRows, campaigns, campaignsOther,
  };
}

export type Acquisition = ReturnType<typeof useAcquisition>;
