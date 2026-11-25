import { useEffect, useState } from 'react';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { useCan } from '../lib/permissions';
import { JOB_STATUS, delayText, refreshJobs, retryJob, saveFlow, useEmailBoot } from '../lib/emailApi';
import type { EmailFlow, EmailJob } from '../lib/emailApi';
import { Badge, CustomSelect, EmptyState, SampleBanner, Switch } from './ui';

// Fluxos de e-mail que rodam NO SERVIDOR (apps/api/email_automations.go): um por linha, liga e desliga, com o
// modelo e o atraso. Diferente das automações de exemplo da página, estes disparam mesmo com o admin fechado.

const when = (iso?: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

const DELAYS = [0, 30, 60, 3 * 60, 24 * 60, 2 * 24 * 60, 3 * 24 * 60, 7 * 24 * 60];

export function EmailFlowsTab({ onEditTemplates }: { onEditTemplates?: () => void }) {
  const email = useEmailBoot();
  const can = useCan();
  const manage = can.has('automations:manage');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (email.mode === 'loading') return <EmptyState title="Carregando os e-mails automáticos…" />;
  if (email.mode === 'off') {
    return (
      <SampleBanner offline>
        Os e-mails automáticos rodam no servidor, e a API daqui ainda não os tem ligados (EMAIL_AUTOMATIONS=1). {email.error}
      </SampleBanner>
    );
  }

  const change = async (f: EmailFlow, patch: Partial<Pick<EmailFlow, 'active' | 'templateId' | 'delayMinutes'>>) => {
    setBusy(f.id);
    setError(null);
    try {
      await saveFlow(f.id, { active: patch.active ?? f.active, templateId: patch.templateId ?? f.templateId, delayMinutes: patch.delayMinutes ?? f.delayMinutes });
    } catch (e) {
      setError(`${f.name}: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      {!email.configured && (
        <div className="sample-banner" role="note">
          <span><strong>Envio não configurado.</strong> Falta RESEND_API_KEY ou RESEND_FROM_EMAIL na API: os e-mails ficam na fila e saem quando a conta de envio for ligada.</span>
        </div>
      )}
      {email.configured && <p className="text-sm text-muted">Remetente: <strong>{email.from}</strong>. Cada pessoa recebe no máximo um e-mail de cada fluxo.</p>}
      {email.templates.length === 0 && (
        <div className="sample-banner" role="note">
          <span><strong>Nenhum modelo salvo ainda.</strong> Crie o modelo em E-mails → Modelos visuais antes de ligar um fluxo.{onEditTemplates && <> <button type="button" className="btn btn-sm" onClick={onEditTemplates}>Abrir modelos</button></>}</span>
        </div>
      )}
      {error && <div className="sample-banner" role="alert"><span><strong>Não foi possível salvar.</strong> {error}</span></div>}

      <div className="table-card">
        <div className="table-scroll">
          <table className="data-table data-table-cards">
            <thead><tr><th>Fluxo</th><th>Quando → Para quem</th><th>Modelo</th><th>Envio</th><th>Enviados</th><th style={{ width: 90 }}>Ligado</th></tr></thead>
            <tbody>
              {email.flows.map((f) => (
                <tr key={f.id} style={{ opacity: f.active ? 1 : 0.75 }}>
                  <td className="cell-block" data-label="Fluxo">
                    <div className="cell-stack">
                      <span className="cell-primary">{f.name}</span>
                      <span className="text-xs text-muted">{f.detail}</span>
                    </div>
                  </td>
                  <td className="cell-block" data-label="Quando → Para quem">
                    <div className="flow-line"><span>{f.eventLabel}</span><ArrowRight size={13} className="text-muted" /><span>{f.recipient}</span></div>
                  </td>
                  <td data-label="Modelo">
                    <CustomSelect className="select select-sm" value={f.templateId} disabled={!manage || busy === f.id} onChange={(e) => void change(f, { templateId: e.target.value, active: e.target.value ? f.active : false })} aria-label={`Modelo do fluxo ${f.name}`}>
                      <option value="">Escolha um modelo…</option>
                      {email.templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </CustomSelect>
                  </td>
                  <td data-label="Envio">
                    <CustomSelect className="select select-sm" value={String(f.delayMinutes)} disabled={!manage || busy === f.id} onChange={(e) => void change(f, { delayMinutes: Number(e.target.value) })} aria-label={`Atraso do fluxo ${f.name}`}>
                      {[...new Set([...DELAYS, f.delayMinutes])].sort((a, b) => a - b).map((m) => <option key={m} value={String(m)}>{delayText(m)}</option>)}
                    </CustomSelect>
                  </td>
                  <td data-label="Enviados">
                    <span title={`${f.queued} na fila · ${f.failed} com falha`}>{f.sent}</span>
                    {f.failed > 0 && <> <Badge tone="danger">{f.failed} falha{f.failed > 1 ? 's' : ''}</Badge></>}
                  </td>
                  <td data-label="Ligado">
                    <Switch checked={f.active} onChange={(v) => void change(f, { active: v })} label={`${f.active ? 'Desligar' : 'Ligar'} ${f.name}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {!manage && <p className="text-xs text-muted">Só Admin e Gerente ligam fluxos e trocam modelos.</p>}
    </>
  );
}

/** Histórico real de envios do servidor (fila de e-mail). */
export function EmailJobsTable({ limit }: { limit?: number }) {
  const email = useEmailBoot();
  const can = useCan();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (email.mode !== 'api') return;
    const t = setInterval(() => void refreshJobs().catch(() => undefined), 30_000);
    return () => clearInterval(t);
  }, [email.mode]);

  if (email.mode === 'loading') return <EmptyState title="Carregando o histórico…" />;
  if (email.mode === 'off') return <SampleBanner offline>O histórico de envios vem da fila de e-mail do servidor, que não está ligada nesta API (EMAIL_AUTOMATIONS=1).</SampleBanner>;

  const retry = async (j: EmailJob) => {
    setBusy(j.id);
    setError(null);
    try {
      await retryJob(j.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const jobs = limit ? email.jobs.slice(0, limit) : email.jobs;

  return (
    <>
      {error && <div className="sample-banner" role="alert"><span><strong>Não foi possível reenviar.</strong> {error}</span></div>}
      <div className="table-card">
        <div className="table-scroll">
          <table className="data-table data-table-cards">
            <thead><tr><th>Quando</th><th>Para</th><th>Assunto</th><th>Fluxo</th><th>Status</th><th /></tr></thead>
            <tbody>
              {jobs.length === 0 && <tr><td colSpan={6}><EmptyState title="Nenhum e-mail automático ainda">Quando um fluxo ligado disparar, cada envio aparece aqui, com o resultado do provedor.</EmptyState></td></tr>}
              {jobs.map((j) => {
                const st = JOB_STATUS[j.status];
                return (
                  <tr key={j.id}>
                    <td className="text-muted" data-label="Quando">{j.status === 'SENT' ? when(j.sentAt) : j.status === 'QUEUED' ? `Sai ${when(j.runAt)}` : when(j.createdAt)}</td>
                    <td className="cell-block" data-label="Para"><div className="cell-stack"><span>{j.to}</span>{j.entityName && <span className="text-xs text-muted">{j.entityName}</span>}</div></td>
                    <td data-label="Assunto">{j.subject || <span className="text-muted">—</span>}</td>
                    <td data-label="Fluxo">{j.automation}</td>
                    <td data-label="Status">
                      <span title={j.lastError || undefined}><Badge tone={st.tone}>{st.label}</Badge></span>
                      {j.lastError && j.status !== 'SENT' && <div className="text-xs text-muted">{j.lastError}{j.attempts > 1 ? ` (tentativa ${j.attempts})` : ''}</div>}
                    </td>
                    <td data-label="">
                      {(j.status === 'FAILED' || j.status === 'CANCELED') && can.has('automations:manage') && (
                        <button type="button" className="btn btn-sm" disabled={busy === j.id} onClick={() => void retry(j)}><RotateCcw size={12} /> Reenviar</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
