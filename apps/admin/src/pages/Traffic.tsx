import { useShell } from '../lib/shell';
import { Page, PageHeader, Tabs } from '../components/ui';
import Organic from './traffic/Organic';
import Paid from './traffic/Paid';
import Links from './Links';
import './analytics/analytics.css';
import './traffic/traffic.css';

// Tráfego: um lugar só para o que a equipe divulga. Orgânico (criativos cadastrados aqui), Pago (anúncios lidos das
// plataformas) e os links avulsos, para quando não há uma peça (assinatura de e-mail, perfil, site de parceiro).

type View = 'organico' | 'pago' | 'links';
const VIEWS: { id: View; label: string }[] = [{ id: 'organico', label: 'Orgânico' }, { id: 'pago', label: 'Pago' }, { id: 'links', label: 'Links avulsos' }];

export default function Traffic({ view, sub }: { view?: string; sub?: string }) {
  const { navigate } = useShell();
  const current = VIEWS.find((v) => v.id === view)?.id ?? 'organico';
  return (
    <Page>
      <PageHeader title="Tráfego" subtitle="Criativos orgânicos e pagos, e os links que trazem gente para o site." />
      <Tabs tabs={VIEWS} value={current} onChange={(id) => navigate(id === 'organico' ? '/trafego' : `/trafego/${id}`)} />
      {current === 'organico' && <Organic />}
      {current === 'pago' && <Paid view={sub} />}
      {current === 'links' && <Links embedded />}
    </Page>
  );
}
