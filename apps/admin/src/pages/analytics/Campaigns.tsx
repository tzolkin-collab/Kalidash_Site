import { Suspense, lazy, useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { METRICS, metricValue, series } from '../../lib/analyticsSeries';
import type { MetricId } from '../../lib/analyticsSeries';
import { MIN_BASE, byCampaign, byLanding, byOrganicPiece, rate, signupsByPage } from '../../lib/acquisitionMetrics';
import type { GroupRow, Outcome } from '../../lib/acquisitionMetrics';
import { attributionOf, campaignOf, landingOf } from '../../lib/channels';
import { shortLabel } from '../../lib/campaignLinks';
import { currencyNote } from '../../lib/spend';
import type { CampaignRow } from '../../lib/spend';
import { ErrorBanner } from '../../components/ui';
import GroupTable from '../../components/analytics/GroupTable';
import { BrandLogo, ChannelLogo, SiteLogo } from '../../components/analytics/SourceLogo';
import { providerOfSource } from '../../lib/brandLogos';
import { BarList, Section, Segmented } from '../../components/analytics/parts';
import { SMALL, money, pct } from '../../components/analytics/format';
import type { Acquisition } from './useAcquisition';

const TrendChart = lazy(() => import('../../components/analytics/TrendChart'));

type Dim = 'campaign' | 'channel' | 'piece' | 'landing';
const DIMS: { id: Dim; label: string; first: string; empty: string }[] = [
  { id: 'campaign', label: 'Campanha', first: 'Campanha', empty: 'Nenhum lead com utm_campaign no período. Todo anúncio precisa de UTM (convenção em docs/tracking.md).' },
  { id: 'channel', label: 'Canal', first: 'Canal', empty: 'Nenhum lead no período.' },
  { id: 'piece', label: 'Peça orgânica', first: 'Peça', empty: 'Nenhum lead veio de um link orgânico com UTM.' },
  { id: 'landing', label: 'Página de entrada', first: 'Página', empty: 'Nenhum lead do site com página registrada.' },
];

type Kind = 'all' | 'pago' | 'organico';
const KINDS: { id: Kind; label: string }[] = [{ id: 'all', label: 'Pagas e orgânicas' }, { id: 'pago', label: 'Pagas' }, { id: 'organico', label: 'Orgânicas' }];
/** Orgânica: rede social, mensagem e busca sem anúncio. Outbound, direto e indicação só aparecem em "Pagas e orgânicas". */
const isKind = (group: GroupRow['group'], kind: Kind) =>
  kind === 'all' || (kind === 'pago' ? group === 'pago' : group === 'organico' || group === 'mensagem' || group === 'busca');

const groupValue = (r: GroupRow, m: MetricId) => (m === 'pipeline' ? r.pipelineCents : m === 'revenue' ? r.wonCents : m === 'qualified' ? r.qualified : r.leads);

export default function Campaigns({ a, go }: { a: Acquisition; go: (path: string) => void }) {
  const [dim, setDim] = useState<Dim>('campaign');
  const [metric, setMetric] = useState<MetricId>('pipeline');
  const [picked, setPicked] = useState('');
  const [kind, setKind] = useState<Kind>('all');
  const meta = METRICS.find((m) => m.id === metric)!;
  const info = DIMS.find((d) => d.id === dim)!;

  // Leads do tipo escolhido (pagas ou orgânicas): valem para o gráfico, as quebras e o total.
  const base = useMemo(() => a.rows.filter((o) => isKind(o.channel.group, kind)), [a.rows, kind]);
  const prevBase = useMemo(() => a.prevRows?.filter((o) => isKind(o.channel.group, kind)) ?? null, [a.prevRows, kind]);

  const rows: (GroupRow | CampaignRow)[] = useMemo(() => {
    // Com um tipo escolhido, a campanha é somada só com os leads dele; o gasto da plataforma só existe nas pagas.
    if (dim === 'campaign') return kind === 'all' ? a.campaigns : kind === 'pago' ? a.campaigns.filter((r) => r.group === 'pago') : byCampaign(base, a.touch);
    if (dim === 'channel') return a.channelRows.filter((r) => isKind(r.group, kind));
    if (dim === 'piece') return byOrganicPiece(base);
    return byLanding(base);
  }, [dim, kind, a.campaigns, a.channelRows, a.touch, base]);

  const selected = rows.find((r) => r.key === picked);
  // Leads do item escolhido, com a mesma chave que o agrupamento usa (vale para o período atual e o anterior).
  const matches = useMemo(() => {
    if (!selected) return null;
    return (o: Outcome) => {
      if (dim === 'channel') return o.channel.key === selected.key;
      if (dim === 'campaign') return campaignOf(o.lead, a.touch).toLowerCase() === selected.label.toLowerCase();
      if (dim === 'landing') return landingOf(o.lead) === selected.key;
      return byOrganicPiece([o])[0]?.key === selected.key;
    };
  }, [selected, dim, a.touch]);

  const chart = useMemo(
    () => series(matches ? base.filter(matches) : base, prevBase && matches ? prevBase.filter(matches) : prevBase, a.win, a.prevWin, metric),
    [base, prevBase, a.win, a.prevWin, metric, matches],
  );

  const logo = (r: GroupRow | CampaignRow) => {
    if (dim === 'landing') return <SiteLogo />;
    const platform = 'platform' in r && r.platform ? `${r.platform}_ads` : '';
    const key = dim === 'channel' ? r.key : dim === 'piece' ? r.key.split('|')[0] : a.campaignChannel.get(r.label.toLowerCase()) ?? platform;
    return <ChannelLogo channel={key} name={r.label} domain={a.projectDomain.get(key)} />;
  };

  const bars = useMemo(
    () => [...rows].filter((r) => groupValue(r, metric) > 0).sort((x, y) => groupValue(y, metric) - groupValue(x, metric)).slice(0, 8),
    [rows, metric],
  );
  const total = base.reduce((sum, o) => sum + metricValue(o, metric), 0);

  const signups = useMemo(() => signupsByPage(a.rows.map((o) => o.lead)).slice(0, 8), [a.rows]);
  const topLinks = useMemo(() => [...a.links].sort((x, y) => y.clicks - x.clicks || (y.leads ?? 0) - (x.leads ?? 0)).slice(0, 10), [a.links]);
  const note = currencyNote(a.spend);
  const showSpend = a.spendOn && (dim === 'channel' || (dim === 'campaign' && (!a.channel || a.pickedPlatform)));
  const spendOf = !showSpend ? undefined
    : dim === 'channel' ? (r: GroupRow | CampaignRow) => a.spendOfChannel!(r.key)
    : (r: GroupRow | CampaignRow) => ('spendCents' in r ? r.spendCents : undefined);
  const untagged = base.filter((o) => !attributionOf(o.lead).utm_campaign && !attributionOf(o.lead).first_utm_campaign).length;

  return (
    <>
      <div className="an-controls">
        <Segmented label="Tipo" options={KINDS} value={kind} onChange={(k) => { setKind(k); setPicked(''); }} />
        <Segmented label="Agrupar por" options={DIMS} value={dim} onChange={(d) => { setDim(d); setPicked(''); }} />
        <Segmented label="Métrica" options={METRICS} value={metric} onChange={setMetric} />
      </div>
      {note && <ErrorBanner title="Moeda do investimento">{note}</ErrorBanner>}

      <div className="an-compare">
        <section className="an-card">
          <header><h2>{meta.label} por {info.label.toLowerCase()}</h2><p>Clique em um item para ver a evolução dele</p></header>
          <div className="an-card-body">
            <BarList
              empty={rows.length ? 'Nada com valor nesta métrica no período.' : info.empty} picked={picked}
              onPick={(k) => setPicked((cur) => (cur === k ? '' : k))}
              rows={bars.map((r) => ({
                key: r.key, label: r.label, icon: logo(r), value: groupValue(r, metric),
                display: `${meta.money ? money(groupValue(r, metric)) : groupValue(r, metric)}${total ? ` · ${pct(groupValue(r, metric) / total)}` : ''}`,
              }))}
            />
          </div>
        </section>
        <section className="an-card">
          <header>
            <h2>{selected ? selected.label : 'Todos os leads'}</h2>
            <p>{meta.label} ao longo do período{selected && <> · <button type="button" className="an-link" onClick={() => setPicked('')}>ver todos</button></>}</p>
          </header>
          <div className="an-card-body">
            <Suspense fallback={<div className="an-chart-wait" />}>
              <TrendChart points={chart.points} unit={chart.unit} label={meta.label} isMoney={meta.money} height={240} />
            </Suspense>
          </div>
        </section>
      </div>

      <Section title="Relatório completo" note={dim === 'campaign' && untagged ? `${untagged} ${untagged === 1 ? 'lead sem campanha fica' : 'leads sem campanha ficam'} fora desta quebra.` : undefined}>
        {rows.length ? <GroupTable rows={rows} first={info.first} picked={picked} onPick={(k) => setPicked((cur) => (cur === k ? '' : k))} spendOf={spendOf} icon={logo} /> : <p className="an-empty">{info.empty}</p>}
      </Section>

      <Section title="Links orgânicos" note="Cliques no link curto e leads com as mesmas UTMs, desde a criação.">
        {topLinks.length ? (
          <div className="table-scroll">
            <table className="data-table an-table">
              <thead><tr><th>Link</th><th>Campanha</th><th className="an-num">Cliques</th><th className="an-num">Leads</th><th className="an-num">Clique → lead</th></tr></thead>
              <tbody>{topLinks.map((l) => (
                <tr key={l.id}>
                  <td><div className="an-cell"><BrandLogo provider={providerOfSource(l.utm_source) ?? ''} name={l.utm_source} /><div><span className="cell-primary">{l.label}</span><code className="an-sub">{shortLabel(l.code)}</code></div></div></td>
                  <td><code className="an-path">{l.utm_campaign}</code></td>
                  <td className="an-num">{l.clicks}</td>
                  <td className="an-num">{l.leads ?? '—'}</td>
                  <td className="an-num" title={rate(l.leads ?? 0, l.clicks) === null ? SMALL : `Mínimo de ${MIN_BASE} cliques`}>{pct(rate(l.leads ?? 0, l.clicks))}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : (
          <p className="an-empty">Nenhum link criado. Cada post ganha um link curto com as UTMs certas. <button type="button" className="an-link" onClick={() => go('/trafego')}>Criar criativo <ArrowRight size={14} /></button></p>
        )}
      </Section>

      {signups.length > 0 && (
        <Section title="Newsletter e material" note="Inscrições do blog por artigo.">
          <table className="data-table an-table">
            <thead><tr><th>Página</th><th className="an-num">Newsletter</th><th className="an-num">Material</th></tr></thead>
            <tbody>{signups.map((r) => <tr key={r.page}><td><div className="an-cell"><SiteLogo /><code className="an-path">{r.page}</code></div></td><td className="an-num">{r.newsletter}</td><td className="an-num">{r.material}</td></tr>)}</tbody>
          </table>
        </Section>
      )}
    </>
  );
}
