import { useMemo } from 'react';
import { ExternalLink } from 'lucide-react';
import { UNTRACKED_ALERT } from '../../lib/acquisitionMetrics';
import { deliveryLayers } from '../../lib/trackingHealth';
import { PLATFORM_LABEL } from '../../lib/spend';
import type { SpendPlatform } from '../../lib/spend';
import { formatDateTime } from '../../lib/format';
import { ErrorBanner } from '../../components/ui';
import { Section } from '../../components/analytics/parts';
import { pct, share } from '../../components/analytics/format';
import { BrandLogo } from '../../components/analytics/SourceLogo';
import type { Acquisition } from './useAcquisition';

export default function Tracking({ a }: { a: Acquisition }) {
  const { q, health, healthError, spend } = a;
  const layers = useMemo(() => (health ? deliveryLayers(health.counts) : []), [health]);
  const leadsWord = q.inbound === 1 ? 'lead' : 'leads';
  return (
    <>
      <Section title="Qualidade dos dados" note="Leads do site no período; outbound e projetos conectados ficam fora.">
        <dl className="an-rules">
          <div className="an-rule" data-state={q.alert ? 'warn' : undefined}>
            <dt>Sem origem</dt>
            <dd className="an-rule-value">{share(q.untracked, q.inbound)}</dd>
            <dd>{q.untracked} de {q.inbound} {leadsWord} sem UTM nem referrer. Acima de {pct(UNTRACKED_ALERT)}, a leitura por canal não é confiável.</dd>
          </div>
          <div className="an-rule">
            <dt>Com UTM</dt>
            <dd className="an-rule-value">{share(q.withUtm, q.inbound)}</dd>
            <dd>Leads que chegaram por um link com UTM.</dd>
          </div>
          <div className="an-rule">
            <dt><BrandLogo provider="meta" name="Meta" />Com cookie da Meta</dt>
            <dd className="an-rule-value">{share(q.withMetaCookie, q.inbound)}</dd>
            <dd>Leads com _fbp, _fbc ou fbclid: sobe a nota de correspondência da Meta.</dd>
          </div>
        </dl>
      </Section>

      <Section title="Envio de conversões" note="O que o CRM avisou à Meta e ao GA4 nos últimos 30 dias.">
        {healthError && <ErrorBanner title="Não consegui ler os envios de conversão">{healthError}</ErrorBanner>}
        <dl className="an-rules">
          {layers.map((l) => (
            <div key={l.name} className="an-rule">
              <dt>{/GA4/.test(l.name) && <BrandLogo provider="ga4" name="GA4" />}{/Meta|offline/i.test(l.name) && <BrandLogo provider="meta" name="Meta" />}{/offline/i.test(l.name) && <BrandLogo provider="ga4" name="GA4" />}{l.name}</dt>
              <dd className="an-rule-value"><span className="an-state" data-state={l.state}>{l.status}</span></dd>
              <dd>{l.detail}</dd>
            </div>
          ))}
          {spend && (['meta', 'google'] as SpendPlatform[]).map((p) => (
            <div key={p} className="an-rule">
              <dt><BrandLogo provider={p === 'google' ? 'google_ads' : p} name={PLATFORM_LABEL[p]} />Investimento · {PLATFORM_LABEL[p]}</dt>
              <dd className="an-rule-value"><span className="an-state" data-state={spend.configured[p] ? 'ok' : undefined}>{spend.configured[p] ? 'Conectado' : 'Não conectado'}</span></dd>
              <dd>{spend.configured[p] ? 'O gasto entra no custo por lead e no retorno.' : 'O gasto desta plataforma fica fora das contas.'}</dd>
            </div>
          ))}
        </dl>
        {health && health.errors.length > 0 && (
          <div className="an-errors">
            <h3>Últimos erros</h3>
            {health.errors.map((e, i) => (
              <p key={i}><strong>{e.name}</strong> · {e.source} · {formatDateTime(e.at)}: {e.error}</p>
            ))}
          </div>
        )}
        <p className="an-outlinks">
          Conferir na fonte:
          <a className="an-link" href="https://business.facebook.com/events_manager2" target="_blank" rel="noreferrer"><BrandLogo provider="meta" name="Meta" size={16} />Gerenciador de Eventos <ExternalLink size={13} /></a>
          <a className="an-link" href="https://analytics.google.com/" target="_blank" rel="noreferrer"><BrandLogo provider="ga4" name="GA4" size={16} />GA4 <ExternalLink size={13} /></a>
          <a className="an-link" href="https://clarity.microsoft.com/" target="_blank" rel="noreferrer"><BrandLogo provider="clarity" name="Clarity" size={16} />Clarity <ExternalLink size={13} /></a>
        </p>
      </Section>
    </>
  );
}
