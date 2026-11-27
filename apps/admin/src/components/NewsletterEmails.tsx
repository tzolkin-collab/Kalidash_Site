import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, Monitor, Smartphone } from 'lucide-react';
import { API_URL } from '../lib/api';
import { EmptyState, ErrorBanner } from './ui';
import { LabelBadge, StatusBadge } from './badges';

/* Newsletter > E-mails: os três e-mails da newsletter como o leitor recebe, e o que falta para cada um funcionar.
 * Vem de GET /api/newsletter/emails (apps/api/newsletter_admin.go). Os modelos moram na API (apps/api/emails/);
 * o guia de como montar a edição está em docs/newsletter/README.md. */

type NewsletterEmail = { id: string; title: string; when: string; auto: boolean; active: boolean; missing: string[]; subject: string; html: string };
type Material = { slug: string; title: string; hasLink: boolean };
type Payload = { from: string; emails: NewsletterEmail[]; materials: Material[] };

const PURPOSE: Record<string, string> = {
  edicao: 'Mantém a Kalidash presente todo mês: o que estamos vendo nos clientes, os artigos novos e o convite para o diagnóstico.',
  'boas-vindas': 'Chega na hora da inscrição, quando o interesse está no máximo. Apresenta a Kalidash e indica 3 artigos para começar.',
  material: 'Entrega na hora o material que a pessoa pediu no artigo. Acaba o envio manual.',
};

/** O HTML do e-mail dentro de um iframe isolado; links abrem em outra aba. */
function Preview({ html, width }: { html: string; width: number }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(900);
  const doc = html.replace(/<head>/i, '<head><base target="_blank">');
  const fit = () => {
    const h = ref.current?.contentDocument?.documentElement.scrollHeight;
    if (h) setHeight(h + 4);
  };
  return (
    <iframe
      ref={ref}
      className="nl-frame"
      title="Pré-visualização do e-mail"
      srcDoc={doc}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      style={{ width, height }}
      onLoad={fit}
    />
  );
}

export default function NewsletterEmails() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState(false);
  const [current, setCurrent] = useState('edicao');
  const [device, setDevice] = useState<'mobile' | 'desktop'>('desktop');
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    fetch(`${API_URL}/api/newsletter/emails`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((p: Payload) => setData(p))
      .catch(() => setError(true));
  }, []);
  useEffect(load, [load]);

  if (error) return <ErrorBanner title="Os e-mails da newsletter não carregaram do servidor." onRetry={() => { setError(false); load(); }}>Confira se a API está ligada e tente de novo.</ErrorBanner>;
  if (!data) return <EmptyState title="Carregando os e-mails…" />;

  const email = data.emails.find((e) => e.id === current) ?? data.emails[0];
  const copy = async () => {
    await navigator.clipboard.writeText(email.html);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="nl-emails">
      <ul className="nl-list" aria-label="E-mails da newsletter">
        {data.emails.map((e, i) => (
          <li key={e.id}>
            <button type="button" className="nl-item" aria-current={e.id === email.id ? 'true' : undefined} onClick={() => setCurrent(e.id)}>
              <span className="nl-item-head">
                <span className="nl-item-num">{i + 1}</span>
                <span className="nl-item-title">{e.title}</span>
              </span>
              <span className="nl-item-when">{e.when}</span>
              <span className="nl-item-badges">
                <StatusBadge tone={e.active ? 'success' : 'warning'}>{e.active ? 'Pronto' : 'Falta configurar'}</StatusBadge>
                <LabelBadge>{e.auto ? 'Automático' : 'Enviado pela equipe'}</LabelBadge>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <section className="nl-detail" aria-label={email.title}>
        <p className="nl-purpose">{PURPOSE[email.id]}</p>

        {email.missing.length > 0 && (
          <div className="nl-missing" role="note">
            <strong>Para funcionar falta:</strong>
            <ul>{email.missing.map((m) => <li key={m}>{m}</li>)}</ul>
          </div>
        )}

        {email.id === 'material' && (
          <div className="nl-materials">
            <strong>Materiais</strong>
            <ul>
              {data.materials.map((m) => (
                <li key={m.slug}>
                  <span>{m.title}</span>
                  <StatusBadge tone={m.hasLink ? 'success' : 'warning'}>{m.hasLink ? 'Com link' : 'Sem link: a equipe manda à mão'}</StatusBadge>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="nl-toolbar">
          <div className="nl-subject">
            <span className="text-xs text-muted">Assunto</span>
            <span className="nl-subject-text">{email.subject}</span>
          </div>
          <div className="nl-actions">
            <div className="nl-device" role="group" aria-label="Tamanho da pré-visualização">
              <button type="button" className="btn btn-sm" aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}><Monitor size={14} aria-hidden="true" /> Computador</button>
              <button type="button" className="btn btn-sm" aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')}><Smartphone size={14} aria-hidden="true" /> Celular</button>
            </div>
            {email.id === 'edicao' && (
              <>
                <button type="button" className="btn btn-sm btn-solid" onClick={copy}>
                  {copied ? <><Check size={14} aria-hidden="true" /> Copiado</> : <><Copy size={14} aria-hidden="true" /> Copiar e-mail para o Resend</>}
                </button>
                <a className="btn btn-sm" href="https://resend.com/broadcasts" target="_blank" rel="noreferrer"><ExternalLink size={14} aria-hidden="true" /> Abrir o Resend</a>
              </>
            )}
          </div>
        </div>
        {email.id === 'edicao' && (
          <p className="text-xs text-muted nl-hint">Troque os textos entre [colchetes] antes de enviar. O passo a passo está no guia da newsletter (docs/newsletter/README.md).</p>
        )}

        <div className="nl-stage">
          <Preview key={email.id} html={email.html} width={device === 'mobile' ? 375 : 680} />
        </div>
        {email.auto && <p className="text-xs text-muted nl-hint">Pré-visualização com uma inscrita de exemplo (Ana Ribeiro).</p>}
      </section>
    </div>
  );
}
