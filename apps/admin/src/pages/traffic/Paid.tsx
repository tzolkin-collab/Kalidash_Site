import { useMemo, useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { paidSample } from '../../lib/paidSample';
import { METRICS, PAID_PERIODS, inPeriod, mergeAds, sum } from '../../lib/paidMedia';
import type { Period } from '../../lib/paidMedia';
import { useShell } from '../../lib/shell';
import { CustomSelect, Tabs } from '../../components/ui';
import PaidCampaigns from './PaidCampaigns';
import PaidCreatives from './PaidCreatives';
import { show } from './paidFormat';

// Tráfego pago. Os anúncios nascem no gerenciador do Meta e serão LIDOS aqui; enquanto as contas não são conectadas,
// as duas abas mostram exemplos fixos e identificados, sem misturar com número real.

/** Número principal e, embaixo, o que o explica. */
const SUMMARY: [string, string?][] = [['spend'], ['revenue'], ['profit', 'margin'], ['roas'], ['sales', 'cpa'], ['leads', 'cpl']];
const metric = (id: string) => METRICS.find((m) => m.id === id)!;

export default function Paid({ view }: { view?: string }) {
  const { navigate } = useShell();
  const current = view === 'criativos' ? 'criativos' : 'campanhas';
  const [account, setAccount] = useState('');
  const [period, setPeriod] = useState<Period>('30d');
  const [data] = useState(() => paidSample());
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
        <span className="tr-sample" title="As contas do Meta ainda não estão conectadas. Contas, anúncios e números são inventados, para avaliar as telas."><FlaskConical size={13} aria-hidden /> Dados de exemplo</span>
        <CustomSelect className="select" value={period} onChange={(e) => setPeriod(e.target.value as Period)} aria-label="Período">
          {PAID_PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </CustomSelect>
        <CustomSelect className="select" value={account} onChange={(e) => setAccount(e.target.value)} aria-label="Conta de anúncio">
          <option value="">Todas as contas</option>
          {accounts.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </CustomSelect>
      </div>
      <dl className="tr-summary">
        {SUMMARY.map(([main, extra]) => (
          <div key={main} title={metric(main).hint}>
            <dt>{metric(main).label}</dt>
            <dd>{show(metric(main).value(total), metric(main).kind)}</dd>
            {extra && <dd className="tr-summary-extra">{metric(extra).label} {show(metric(extra).value(total), metric(extra).kind)}</dd>}
          </div>
        ))}
      </dl>
      {current === 'campanhas' ? <PaidCampaigns rows={ads} /> : <PaidCreatives rows={ads} />}
    </>
  );
}
