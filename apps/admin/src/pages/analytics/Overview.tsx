import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { METRICS, funnel, recentBuckets, series } from '../../lib/analyticsSeries';
import type { MetricId } from '../../lib/analyticsSeries';
import { byLanding, readout } from '../../lib/acquisitionMetrics';
import { deltaPct } from '../../lib/commercialMetrics';
import { PLATFORM_LABEL, byPlatform, costPer, roas } from '../../lib/spend';
import type { SpendPlatform } from '../../lib/spend';
import { Delta } from '../../components/dashboard/widgets';
import { BarList, Card } from '../../components/analytics/parts';
import { MIN_BASE } from '../../lib/acquisitionMetrics';
import { money, moneyOrDash, pct, times } from '../../components/analytics/format';
import { BrandLogo, ChannelLogo, SiteLogo } from '../../components/analytics/SourceLogo';
import type { Acquisition } from './useAcquisition';

const TrendChart = lazy(() => import('../../components/analytics/TrendChart'));

const leadsWord = (n: number) => `${n} ${n === 1 ? 'lead' : 'leads'}`;

export default function Overview({ a, go }: { a: Acquisition; go: (path: string) => void }) {
  const [metric, setMetric] = useState<MetricId>('pipeline');
  const meta = METRICS.find((m) => m.id === metric)!;
  const { s, prev, rows, prevRows, win, prevWin } = a;
  const chart = useMemo(() => series(rows, prevRows, win, prevWin, metric), [rows, prevRows, win, prevWin, metric]);

  const totals: Record<MetricId, [number, number | undefined, string]> = {
    pipeline: [s.pipelineCents, prev?.pipelineCents, money(s.pipelineCents)],
    revenue: [s.wonCents, prev?.wonCents, money(s.wonCents)],
    leads: [s.leads, prev?.leads, String(s.leads)],
    qualified: [s.qualified, prev?.qualified, String(s.qualified)],
  };

  // Funil resumido do pipeline com mais leads no período; o relatório completo deixa escolher.
  const main = useMemo(() => {
    const count = (id: string) => rows.filter((o) => o.lead.pipelineId === id).length;
    return [...a.pipelines].sort((x, y) => count(y.id) - count(x.id))[0];
  }, [a.pipelines, rows]);
  const steps = useMemo(() => (main ? funnel(rows, a.opportunities, main) : null), [rows, a.opportunities, main]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(t); }, []);
  const day = recentBuckets(a.leads.filter((l) => !l.archivedAt).map((l) => l.createdAt), 24, 3_600_000, now);
  const today = day.reduce((x, y) => x + y, 0);

  const logo = (key: string, name: string) => <ChannelLogo channel={key} name={name} domain={a.projectDomain.get(key)} />;
  const channelBars = [...a.channels].sort((x, y) => y.leads - x.leads);
  const landings = byLanding(rows).slice(0, 5);
  const platforms = byPlatform(a.spend);
  const connected = (['meta', 'google'] as SpendPlatform[]).filter((p) => a.spend?.configured[p]);

  return (
    <>
      <section className="an-panel" aria-label="Evolução no período">
        <div className="an-metrics" role="tablist" aria-label="Métrica do gráfico">
          {METRICS.map((m) => (
            <button key={m.id} type="button" role="tab" aria-selected={metric === m.id} className="an-metric" onClick={() => setMetric(m.id)}>
              <span className="an-metric-label">{m.label}</span>
              <span className="an-metric-value">{totals[m.id][2]}</span>
              <Delta value={totals[m.id][1] === undefined ? null : deltaPct(totals[m.id][0], totals[m.id][1]!)} hasPrevious={!!prev} />
            </button>
          ))}
        </div>
        <Suspense fallback={<div className="an-chart-wait" />}>
          <TrendChart points={chart.points} unit={chart.unit} label={meta.label} isMoney={meta.money} />
        </Suspense>
        <p className="an-note">
          {readout(s, a.channel ? a.channels.filter((c) => c.key === a.channel) : a.channels, a.q, money)} Lead → venda: {pct(s.leadToWon)}
          {s.leadToWon === null ? ` (aparece com ${MIN_BASE} leads ou mais)` : s.medianCycleDays !== null ? `, ciclo mediano de ${Math.round(s.medianCycleDays)} dias` : ''}.
          {' '}Os valores contam pela data em que o lead entrou.
        </p>
      </section>

      <div className="an-grid">
        <Card title="Últimas 24 horas" note="Leads que entraram, hora a hora" action="Ver tempo real" onAction={() => go('tempo-real')}>
          <p className="an-big">{today}<small>{today === 1 ? 'lead' : 'leads'}</small></p>
          <div className="an-minibars" role="img" aria-label={`${leadsWord(today)} nas últimas 24 horas`}>
            {day.map((n, i) => <span key={i} data-zero={!n || undefined} style={{ height: n ? `${(n / Math.max(...day)) * 100}%` : undefined }} />)}
          </div>
        </Card>

        <Card title="Leads por canal" note="Clique para filtrar a página" action="Ver campanhas" onAction={() => go('campanhas')}>
          <BarList
            empty="Nenhum lead no período." head={['Canal', 'Leads']} picked={a.channel}
            onPick={(k) => a.setChannel(a.channel === k ? '' : k)}
            rows={channelBars.slice(0, 6).map((c) => ({ icon: logo(c.key, c.label), key: c.key, label: c.label, value: c.leads, display: String(c.leads) }))}
          />
        </Card>

        <Card title="Pipeline por canal" note="Onde está o valor" action="Ver campanhas" onAction={() => go('campanhas')}>
          <BarList
            empty="Nenhum valor gerado no período." head={['Canal', 'Pipeline']} picked={a.channel}
            onPick={(k) => a.setChannel(a.channel === k ? '' : k)}
            rows={a.channels.filter((c) => c.pipelineCents > 0).slice(0, 6).map((c) => ({ icon: logo(c.key, c.label), key: c.key, label: c.label, sub: c.wonCents ? `${money(c.wonCents)} ganhos` : undefined, value: c.pipelineCents, display: money(c.pipelineCents) }))}
          />
        </Card>

        <Card title="Funil" note={main ? main.name : undefined} action="Ver funil completo" onAction={() => go('funil')}>
          <BarList
            empty="Nenhum lead neste funil no período." head={['Chegou até', 'Leads']}
            rows={steps && steps.total ? steps.steps.map((st) => ({ key: st.id, label: st.name, value: st.reached, display: String(st.reached) })) : []}
          />
        </Card>

        <Card title="Campanhas" note="Pipeline gerado por utm_campaign" action="Comparar campanhas" onAction={() => go('campanhas')}>
          <BarList
            empty="Nenhum lead com utm_campaign no período." head={['Campanha', 'Pipeline']}
            rows={a.campaigns.slice(0, 5).map((c) => ({ icon: logo(a.campaignChannel.get(c.label.toLowerCase()) ?? (c.platform ? `${c.platform}_ads` : ''), c.label), key: c.key, label: c.label, sub: leadsWord(c.leads), value: c.pipelineCents, display: money(c.pipelineCents) }))}
          />
        </Card>

        <Card title="Páginas de entrada" note="Primeira página vista no site">
          <BarList
            empty="Nenhum lead do site com página registrada." head={['Página', 'Leads']}
            rows={[...landings].sort((x, y) => y.leads - x.leads).map((l) => ({ icon: <SiteLogo />, key: l.key, label: l.label, value: l.leads, display: String(l.leads) }))}
          />
        </Card>

        {a.spendOn && (
          <Card title="Investimento em mídia" action="Ver por campanha" onAction={() => go('campanhas')}>
            <ul className="an-accounts">
              {connected.map((p) => <li key={p}><BrandLogo provider={p === 'google' ? 'google_ads' : p} name={PLATFORM_LABEL[p]} />{PLATFORM_LABEL[p]}<strong>{money(platforms[p])}</strong></li>)}
            </ul>
            <p className="an-big">{a.spent === undefined ? '—' : money(a.spent)}</p>
            <dl className="an-pairs">
              <div><dt>Custo por qualificado</dt><dd>{moneyOrDash(a.paid ? costPer(a.spent, a.paid.qualified) : null)}</dd></div>
              <div><dt>Retorno</dt><dd>{a.paid ? times(roas(a.paid.wonCents, a.spent)) : '—'}</dd></div>
            </dl>
          </Card>
        )}
      </div>
      {a.spend && !a.spendOn && <p className="an-note">Investimento, custo por lead e retorno aparecem quando as contas de anúncio da Meta ou do Google Ads forem conectadas.</p>}
    </>
  );
}
