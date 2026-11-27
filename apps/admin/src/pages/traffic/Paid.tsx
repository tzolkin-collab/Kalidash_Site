import { useEffect, useMemo, useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { paidSample } from '../../lib/paidSample';
import { METRICS, PAID_PERIODS, inPeriod, mergeAds, periodDays, sum } from '../../lib/paidMedia';
import type { Period } from '../../lib/paidMedia';
import { useShell } from '../../lib/shell';
import { CustomSelect, ErrorBanner, Tabs } from '../../components/ui';
import { BrandLogo } from '../../components/analytics/SourceLogo';
import { loadAds } from '../../lib/analyticsApi';
import type { AdsReport } from '../../lib/analyticsApi';
import { joinCrm } from '../../lib/paidJoin';
import { outcomes } from '../../lib/acquisitionMetrics';
import { useOpportunities } from '../../lib/useOpportunities';
import { useStore } from '../../lib/store';
import { leadsStore } from '../../mocks/leads';
import { pipelinesStore } from '../../mocks/pipelines';
import PaidCampaigns from './PaidCampaigns';
import PaidCreatives from './PaidCreatives';
import { show } from './paidFormat';

// Tráfego pago. Os anúncios nascem no gerenciador do Meta e são LIDOS aqui (nada é alterado lá). Leads, vendas e
// faturamento vêm do CRM. Sem conta conectada, as duas abas mostram exemplos fixos e identificados.

/** Número principal e, embaixo, o que o explica. */
const SUMMARY: [string, string?][] = [['spend'], ['revenue'], ['profit', 'margin'], ['roas'], ['sales', 'cpa'], ['leads', 'cpl']];
const metric = (id: string) => METRICS.find((m) => m.id === id)!;

export default function Paid({ view }: { view?: string }) {
  const { navigate } = useShell();
  const current = view === 'criativos' ? 'criativos' : 'campanhas';
  const [account, setAccount] = useState('');
  const [period, setPeriod] = useState<Period>('30d');
  const [sample] = useState(() => paidSample());
  const days = useMemo(() => periodDays(period), [period]);
  const [loaded, setLoaded] = useState<{ key: string; report?: AdsReport; error?: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${days.from}|${days.to}|${attempt}`;
  useEffect(() => {
    let live = true;
    loadAds(days.from, days.to)
      .then((report) => { if (live) setLoaded({ key: requestKey, report }); })
      .catch((e: unknown) => { if (live) setLoaded({ key: requestKey, error: e instanceof Error ? e.message : 'erro' }); });
    return () => { live = false; };
  }, [days, requestKey]);
  const current_ = loaded?.key === requestKey ? loaded : null;
  const report = current_?.report;
  const real = report?.configured === true;
  const failure = current_?.error ?? report?.error;

  const [leads] = useStore(leadsStore);
  const [pipelines] = useStore(pipelinesStore);
  const { opportunities } = useOpportunities();
  const joined = useMemo(() => (real && report ? joinCrm(report.rows, outcomes(leads, opportunities, pipelines, 'last'), days) : null), [real, report, leads, opportunities, pipelines, days]);
  // Exemplo só quando a API diz que não há conta conectada: erro ou carregando nunca viram número inventado.
  const isSample = report?.configured === false;
  const data = useMemo(() => joined?.rows ?? (isSample ? sample : []), [joined, isSample, sample]);
  const accounts = useMemo(() => [...new Map(data.map((r) => [r.accountId, r.accountName]))], [data]);
  const rows = useMemo(() => inPeriod(data, period).filter((r) => !account || r.accountId === account), [data, period, account]);
  const total = sum(rows);
  const ads = useMemo(() => mergeAds(rows), [rows]);

  return (
    <>
      <div className="tr-subbar">
        <Tabs
          tabs={[{ id: 'campanhas' as const, label: 'Campanhas' }, { id: 'criativos' as const, label: 'Criativos' }]}
          value={current}
          onChange={(id) => navigate(id === 'campanhas' ? '/trafego/pago' : '/trafego/pago/criativos')}
        />
        {isSample && <span className="tr-sample" title="As contas do Meta não estão conectadas nesta API. Contas, anúncios e números são inventados, para avaliar as telas."><FlaskConical size={13} aria-hidden /> Dados de exemplo</span>}
        {real && !failure && <span className="tr-source" title="Lido da Meta, sem alterar nada. Atualiza a cada 15 minutos."><BrandLogo provider="meta" name="Meta" size={16} /> Meta · lido às {new Date(report!.fetchedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}
        {!report && <span className="tr-source" />}
        <CustomSelect className="select" value={period} onChange={(e) => setPeriod(e.target.value as Period)} aria-label="Período">
          {PAID_PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </CustomSelect>
        <CustomSelect className="select" value={account} onChange={(e) => setAccount(e.target.value)} aria-label="Conta de anúncio">
          <option value="">Todas as contas</option>
          {accounts.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </CustomSelect>
      </div>
      {failure && <ErrorBanner title="Não consegui ler os anúncios" onRetry={() => setAttempt((n) => n + 1)}>{failure}</ErrorBanner>}
      {!current_ && <p className="an-empty" role="status">Lendo os anúncios na Meta. A primeira leitura do período pode levar alguns segundos.</p>}
      {report?.currency && report.currency !== 'BRL' && <ErrorBanner title="Moeda da conta">{`A conta usa ${report.currency}: os valores de gasto não são reais.`}</ErrorBanner>}
      {joined && joined.unmatched > 0 && <p className="tr-hint">{joined.unmatched} {joined.unmatched === 1 ? 'lead de Meta Ads não foi ligado' : 'leads de Meta Ads não foram ligados'} a um anúncio (UTM fora do padrão ou anúncio sem entrega no período).</p>}
      {current_ && !failure && <><dl className="tr-summary">
        {SUMMARY.map(([main, extra]) => (
          <div key={main} title={metric(main).hint}>
            <dt>{metric(main).label}</dt>
            <dd>{show(metric(main).value(total), metric(main).kind)}</dd>
            {extra && <dd className="tr-summary-extra">{metric(extra).label} {show(metric(extra).value(total), metric(extra).kind)}</dd>}
          </div>
        ))}
      </dl>
      {current === 'campanhas' ? <PaidCampaigns rows={ads} sample={isSample} /> : <PaidCreatives rows={ads} />}</>}
    </>
  );
}
