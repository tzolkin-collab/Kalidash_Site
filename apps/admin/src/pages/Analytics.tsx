import { X } from 'lucide-react';
import { useShell } from '../lib/shell';
import { PERIODS } from '../lib/salesMetrics';
import type { Period } from '../lib/salesMetrics';
import type { Touch } from '../lib/channels';
import { PLATFORM_LABEL } from '../lib/spend';
import type { SpendPlatform } from '../lib/spend';
import { ErrorBanner, Page, PageHeader, Tabs } from '../components/ui';
import { useAcquisition } from './analytics/useAcquisition';
import Overview from './analytics/Overview';
import Realtime from './analytics/Realtime';
import Campaigns from './analytics/Campaigns';
import FunnelView from './analytics/FunnelView';
import Tracking from './analytics/Tracking';
import { ChannelLogo } from '../components/analytics/SourceLogo';
import './analytics/analytics.css';

// Analytics: de onde vem o resultado. Coorte = leads criados no período e o que eles geraram depois (pipeline e
// receita), com primeiro toque como padrão (ciclo B2B longo). Só leitura. Regras em docs/tracking.md (seção 9).
// Navegação no estilo de ferramenta de analytics: uma aba por relatório, filtros no canto, que valem para todas.

type View = '' | 'tempo-real' | 'campanhas' | 'funil' | 'rastreamento';

const VIEWS: { id: View; label: string; subtitle: string }[] = [
  { id: '', label: 'Visão geral', subtitle: 'Qual canal gera pipeline e receita.' },
  { id: 'tempo-real', label: 'Tempo real', subtitle: 'O que está entrando agora.' },
  { id: 'campanhas', label: 'Campanhas', subtitle: 'Compare campanhas, canais, peças e páginas.' },
  { id: 'funil', label: 'Funil', subtitle: 'Onde os leads avançam e onde param.' },
  { id: 'rastreamento', label: 'Rastreamento', subtitle: 'O quanto dá para confiar nos números.' },
];

export default function Analytics({ view = '' }: { view?: string }) {
  const { navigate } = useShell();
  const a = useAcquisition();
  const current = VIEWS.find((v) => v.id === view) ?? VIEWS[0];
  const go = (path: string) => navigate(path.startsWith('/') ? path : path ? `/analytics/${path}` : '/analytics');
  const live = current.id === 'tempo-real';

  const filters = (
    <div className="an-filters">
      {a.channel && !live && (
        <button type="button" className="chip active an-filter" onClick={() => a.setChannel('')} aria-label="Limpar filtro de canal"><ChannelLogo channel={a.channel} name={a.pickedLabel ?? ''} domain={a.projectDomain.get(a.channel)} size={16} />{a.pickedLabel} <X size={12} /></button>
      )}
      <label>
        <span>Atribuição</span>
        <select value={a.touch} onChange={(e) => a.setTouch(e.target.value as Touch)} title="Primeiro toque: quem trouxe a pessoa pela primeira vez. Último toque: a campanha antes do formulário.">
          <option value="first">Primeiro toque</option>
          <option value="last">Último toque</option>
        </select>
      </label>
      {!live && (
        <label>
          <span>Período</span>
          <select value={a.period} onChange={(e) => a.setPeriod(e.target.value as Period)}>
            {PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
      )}
    </div>
  );

  return (
    <Page>
      <PageHeader title="Analytics" subtitle={current.subtitle} actions={filters} />
      <Tabs tabs={VIEWS.map((v) => ({ id: v.id, label: v.label }))} value={current.id} onChange={go} />

      {a.oppError && <ErrorBanner title="Não consegui carregar as oportunidades" onRetry={a.reload}>Pipeline e receita ficam zerados até carregar.</ErrorBanner>}
      {a.spendError && <ErrorBanner title="Não consegui ler o investimento em mídia">{a.spendError}</ErrorBanner>}
      {a.spend && (Object.entries(a.spend.errors) as [SpendPlatform, string][]).map(([p, e]) => (
        <ErrorBanner key={p} title={`Não consegui ler o investimento do ${PLATFORM_LABEL[p]}`}>{e}</ErrorBanner>
      ))}

      {current.id === '' && <Overview a={a} go={go} />}
      {live && <Realtime touch={a.touch} go={go} />}
      {current.id === 'campanhas' && <Campaigns a={a} go={go} />}
      {current.id === 'funil' && <FunnelView a={a} />}
      {current.id === 'rastreamento' && <Tracking a={a} />}
    </Page>
  );
}
