import { useEffect, useMemo, useState } from 'react';
import { FileText, Plus, RefreshCw, Send, Trash2, UserCheck } from 'lucide-react';
import type { Article } from '../domain';
import { listArticles } from '../lib/blog';
import { saveTemplate, useEmailBoot } from '../lib/emailApi';
import { useCan } from '../lib/permissions';
import {
  EDITION_STATUS, articleEmailHTML, deleteEdition, loadNewsletter, saveEdition, sendEdition, startSync, testEdition, useNewsletterBoot,
} from '../lib/newsletterApi';
import type { EditionInput, NewsletterEdition } from '../lib/newsletterApi';
import { Badge, CustomSelect, EmptyState, Field, PopupDialog, SampleBanner } from './ui';

// Aba "Edições" da página Newsletter: monta a edição com um modelo de E-mails, manda um teste para quem está
// logado e envia (ou agenda) pelo Resend Broadcasts para o público escolhido.

/** Como o Field, mas sem <label>: dentro de um label, clicar numa opção do CustomSelect reabre a lista. */
function SelectField({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

const when = (iso?: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

type Feedback = { title: string; description: string; tone: 'success' | 'danger' };

/** "2026-11-26T09:00" (input datetime-local) a partir de agora + 1 dia, 9h. */
function tomorrowAtNine(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function NewsletterEditions({ onOpenTemplates }: { onOpenTemplates: () => void }) {
  const nl = useNewsletterBoot();
  const email = useEmailBoot();
  const can = useCan();
  const manage = can.has('automations:manage');
  const [editing, setEditing] = useState<NewsletterEdition | 'new' | null>(null);
  const [sending, setSending] = useState<NewsletterEdition | null>(null);
  const [fromArticle, setFromArticle] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  // Enquanto a sincronização roda, a tela acompanha o progresso.
  useEffect(() => {
    if (!nl.sync.running) return;
    const t = setInterval(() => void loadNewsletter(), 3000);
    return () => clearInterval(t);
  }, [nl.sync.running]);

  if (nl.mode === 'loading') return <EmptyState title="Carregando as edições…" />;
  if (nl.mode === 'off') {
    return <SampleBanner offline>As edições saem pelo servidor, e a API daqui ainda não tem os e-mails ligados (EMAIL_AUTOMATIONS=1). {nl.error}</SampleBanner>;
  }

  const audience = (id: string) => nl.audiences.find((a) => a.id === id);
  const newsletterReady = audience('newsletter')?.configured;

  const run = async (key: string, fn: () => Promise<Feedback | void>) => {
    setBusy(key);
    try {
      const f = await fn();
      if (f) setFeedback(f);
    } catch (e) {
      setFeedback({ title: 'Não deu certo', description: (e as Error).message, tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  const test = (e: NewsletterEdition) => run(`test:${e.id}`, async () => {
    const to = await testEdition(e.id);
    return { title: 'Teste enviado', description: `A edição foi para ${to}, com as variáveis preenchidas com os seus dados. Confira na caixa de entrada (e no spam).`, tone: 'success' };
  });

  const remove = (e: NewsletterEdition) => run(`del:${e.id}`, async () => { await deleteEdition(e.id); });

  const sync = () => run('sync', async () => {
    await startSync();
    return { title: 'Sincronizando', description: 'Os inscritos que já estão no CRM estão indo para o segmento da newsletter no Resend. Quem cancelou a inscrição lá não volta a receber.', tone: 'success' };
  });

  return (
    <>
      {!nl.configured && (
        <div className="sample-banner" role="note"><span><strong>Envio não configurado.</strong> Falta RESEND_API_KEY ou RESEND_FROM_EMAIL na API.</span></div>
      )}
      {!newsletterReady && (
        <div className="sample-banner" role="note"><span><strong>Segmento da newsletter não configurado.</strong> Falta RESEND_NEWSLETTER_SEGMENT_ID na API: as inscrições não vão para o Resend e as edições não têm para quem ir.</span></div>
      )}

      <div className="toolbar" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <span className="text-sm text-muted">
          {nl.configured ? <>Remetente: <strong>{nl.from}</strong>. </> : null}
          {nl.sync.running
            ? `Sincronizando inscritos com o Resend: ${nl.sync.done} de ${nl.sync.total}…`
            : nl.sync.finishedAt
              ? `Última sincronização ${when(nl.sync.finishedAt)}: ${nl.sync.done - nl.sync.failed} ok${nl.sync.failed ? `, ${nl.sync.failed} com falha (${nl.sync.error})` : ''}.`
              : null}
        </span>
        {manage && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn" disabled={!newsletterReady || nl.sync.running || busy === 'sync'} onClick={() => void sync()} title="Põe no segmento do Resend quem se inscreveu antes da ligação (seguro repetir)">
              <RefreshCw size={14} /> Sincronizar inscritos
            </button>
            <button type="button" className="btn" disabled={email.mode !== 'api'} onClick={() => setFromArticle(true)}><FileText size={14} /> Modelo de um artigo</button>
            <button type="button" className="btn btn-solid" onClick={() => setEditing('new')}><Plus size={14} /> Nova edição</button>
          </div>
        )}
      </div>

      <div className="table-card">
        <div className="table-scroll">
          <table className="data-table data-table-cards">
            <thead><tr><th>Edição</th><th>Modelo</th><th>Público</th><th>Status</th><th>Quando</th><th /></tr></thead>
            <tbody>
              {nl.editions.length === 0 && (
                <tr><td colSpan={6}><EmptyState title="Nenhuma edição ainda">Crie o modelo em E-mails (ou a partir de um artigo do blog), depois a edição: dá para mandar um teste para você antes de enviar para a lista.</EmptyState></td></tr>
              )}
              {nl.editions.map((e) => {
                const st = EDITION_STATUS[e.status];
                const open = e.status === 'DRAFT' || e.status === 'FAILED';
                return (
                  <tr key={e.id}>
                    <td className="cell-block" data-label="Edição">
                      <div className="cell-stack">
                        <span className="cell-primary">{e.subject}</span>
                        {e.name !== e.subject && <span className="text-xs text-muted">{e.name}</span>}
                      </div>
                    </td>
                    <td data-label="Modelo">{e.template || <span className="text-muted">Sem modelo</span>}</td>
                    <td data-label="Público">{audience(e.audience)?.label ?? e.audience}</td>
                    <td data-label="Status">
                      <Badge tone={st.tone}>{st.label}</Badge>
                      {e.lastError && e.status === 'FAILED' && <div className="text-xs text-muted">{e.lastError}</div>}
                    </td>
                    <td className="text-muted" data-label="Quando">
                      {e.status === 'SENT' ? when(e.sentAt) : e.status === 'SCHEDULED' ? `Sai ${when(e.scheduledAt)}` : `Criada ${when(e.createdAt)}`}
                      {e.sentBy && <div className="text-xs">por {e.sentBy}</div>}
                    </td>
                    <td data-label="">
                      {manage && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <button type="button" className="btn btn-sm" disabled={!e.templateId || busy === `test:${e.id}`} onClick={() => void test(e)} title="Manda só para o seu e-mail">
                            <UserCheck size={12} /> {busy === `test:${e.id}` ? 'Enviando…' : 'Teste para mim'}
                          </button>
                          {open && <button type="button" className="btn btn-sm" onClick={() => setEditing(e)}>Editar</button>}
                          {open && <button type="button" className="btn btn-sm btn-solid" disabled={!e.templateId} onClick={() => setSending(e)}><Send size={12} /> Enviar…</button>}
                          {open && <button type="button" className="btn btn-sm" aria-label={`Apagar ${e.subject}`} disabled={busy === `del:${e.id}`} onClick={() => void remove(e)}><Trash2 size={12} /></button>}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {!manage && <p className="text-xs text-muted">Só Admin e Gerente criam e enviam edições.</p>}

      {editing && (
        <EditionDialog
          edition={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onOpenTemplates={onOpenTemplates}
          onSaved={() => setEditing(null)}
        />
      )}
      {sending && (
        <SendDialog
          edition={sending}
          audienceLabel={audience(sending.audience)?.label ?? sending.audience}
          onClose={() => setSending(null)}
          onDone={(f) => { setSending(null); setFeedback(f); }}
        />
      )}
      {fromArticle && (
        <ArticleTemplateDialog
          onClose={() => setFromArticle(false)}
          onDone={(name) => {
            setFromArticle(false);
            setFeedback({ title: 'Modelo criado', description: `"${name}" já está em E-mails → Modelos visuais. Ajuste lá se quiser e escolha-o numa nova edição.`, tone: 'success' });
          }}
        />
      )}
      {feedback && (
        <PopupDialog title={feedback.title} description={feedback.description} tone={feedback.tone} onClose={() => setFeedback(null)}
          footer={<button type="button" className="btn btn-solid" onClick={() => setFeedback(null)}>Ok</button>} />
      )}
    </>
  );
}

function EditionDialog({ edition, onClose, onSaved, onOpenTemplates }: { edition: NewsletterEdition | null; onClose: () => void; onSaved: () => void; onOpenTemplates: () => void }) {
  const nl = useNewsletterBoot();
  const email = useEmailBoot();
  const [form, setForm] = useState<EditionInput>(() => ({
    name: edition?.name ?? '',
    templateId: edition?.templateId ?? '',
    subject: edition?.subject ?? '',
    previewText: edition?.previewText ?? '',
    audience: edition?.audience ?? 'newsletter',
  }));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<EditionInput>) => setForm((f) => ({ ...f, ...patch }));

  const pickTemplate = (id: string) => {
    const t = email.templates.find((x) => x.id === id);
    set({ templateId: id, subject: form.subject || t?.subject || '' });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveEdition({ ...form, name: form.name || form.subject }, edition?.id);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <PopupDialog
      title={edition ? 'Editar edição' : 'Nova edição'}
      description="O conteúdo vem de um modelo de E-mails. Use {{primeiro_nome}} no assunto e no texto: cada inscrito recebe o próprio nome."
      onClose={onClose}
      footer={<>
        <button type="button" className="btn" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn btn-solid" disabled={saving || !form.subject.trim()} onClick={() => void save()}>{saving ? 'Salvando…' : 'Salvar rascunho'}</button>
      </>}
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <SelectField label="Modelo" hint={email.templates.length ? undefined : <>Nenhum modelo salvo. <button type="button" className="btn btn-sm" onClick={onOpenTemplates}>Abrir E-mails</button></>}>
          <CustomSelect className="select" value={form.templateId} onChange={(e) => pickTemplate(e.target.value)} aria-label="Modelo da edição">
            <option value="">Escolha um modelo…</option>
            {email.templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </CustomSelect>
        </SelectField>
        <Field label="Assunto"><input className="input" value={form.subject} maxLength={200} onChange={(e) => set({ subject: e.target.value })} placeholder="Ex.: {{primeiro_nome}}, o guia de agentes de IA saiu" /></Field>
        <Field label="Texto de prévia" hint="Aparece ao lado do assunto na caixa de entrada. Opcional."><input className="input" value={form.previewText} maxLength={200} onChange={(e) => set({ previewText: e.target.value })} /></Field>
        <SelectField label="Público">
          <CustomSelect className="select" value={form.audience} onChange={(e) => set({ audience: e.target.value })} aria-label="Público">
            {nl.audiences.map((a) => <option key={a.id} value={a.id} disabled={!a.configured}>{a.label}{a.configured ? '' : ' (não configurado)'}</option>)}
          </CustomSelect>
        </SelectField>
        <Field label="Nome interno" hint="Só para a equipe. Vazio: usa o assunto."><input className="input" value={form.name} maxLength={160} onChange={(e) => set({ name: e.target.value })} /></Field>
        {error && <div className="sample-banner" role="alert"><span>{error}</span></div>}
      </div>
    </PopupDialog>
  );
}

function SendDialog({ edition, audienceLabel, onClose, onDone }: { edition: NewsletterEdition; audienceLabel: string; onClose: () => void; onDone: (f: Feedback) => void }) {
  const [mode, setMode] = useState<'now' | 'later'>('now');
  const [at, setAt] = useState(tomorrowAtNine);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      const iso = mode === 'later' ? new Date(at).toISOString() : undefined;
      const e = await sendEdition(edition.id, iso);
      onDone(e.status === 'SCHEDULED'
        ? { title: 'Edição agendada', description: `Sai ${when(e.scheduledAt)} para "${audienceLabel}". Dá para cancelar no Resend (Broadcasts) até lá.`, tone: 'success' }
        : { title: 'Edição enviada', description: `O Resend está entregando para "${audienceLabel}". Aberturas e cliques ficam em Resend → Broadcasts.`, tone: 'success' });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <PopupDialog
      title="Enviar edição"
      tone="warning"
      description={<>“{edition.subject}” vai para <strong>todos do público “{audienceLabel}”</strong>. Depois de enviada, a edição não pode ser desfeita.</>}
      onClose={onClose}
      footer={<>
        <button type="button" className="btn" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn btn-solid" disabled={!confirm || sending} onClick={() => void send()}>
          <Send size={14} /> {sending ? 'Enviando…' : mode === 'now' ? 'Enviar agora' : 'Agendar'}
        </button>
      </>}
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <label className="text-sm" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="radio" checked={mode === 'now'} onChange={() => setMode('now')} /> Enviar agora
        </label>
        <label className="text-sm" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="radio" checked={mode === 'later'} onChange={() => setMode('later')} /> Agendar para
          <input type="datetime-local" className="input" style={{ width: 'auto' }} value={at} disabled={mode !== 'later'} onChange={(e) => setAt(e.target.value)} />
        </label>
        <label className="text-sm" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} /> Já mandei um teste para mim e conferi o e-mail
        </label>
        {error && <div className="sample-banner" role="alert"><span>{error}</span></div>}
      </div>
    </PopupDialog>
  );
}

function ArticleTemplateDialog({ onClose, onDone }: { onClose: () => void; onDone: (name: string) => void }) {
  const [articles, setArticles] = useState<Article[] | null>(null);
  const [id, setId] = useState('');
  const [full, setFull] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listArticles()
      .then((all) => setArticles(all.filter((a) => a.published)))
      .catch((e) => { setArticles([]); setError((e as Error).message); });
  }, []);

  const sorted = useMemo(() => (articles ?? []).slice().sort((a, b) => (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt)), [articles]);
  const article = sorted.find((a) => a.id === id);

  const create = async () => {
    if (!article) return;
    setSaving(true);
    setError(null);
    try {
      const name = `Newsletter: ${article.title}`.slice(0, 160);
      await saveTemplate({ name, tag: 'Newsletter', subject: article.title.slice(0, 200), html: articleEmailHTML(article, { full }), design: null });
      onDone(name);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <PopupDialog
      title="Modelo a partir de um artigo"
      description="Cria um modelo em E-mails com a capa, o título, o resumo e o botão para o artigo no blog (com UTM da newsletter). Dá para ajustar no editor depois."
      onClose={onClose}
      footer={<>
        <button type="button" className="btn" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn btn-solid" disabled={!article || saving} onClick={() => void create()}>{saving ? 'Criando…' : 'Criar modelo'}</button>
      </>}
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <SelectField label="Artigo publicado">
          <CustomSelect className="select" value={id} onChange={(e) => setId(e.target.value)} disabled={!articles} aria-label="Artigo">
            <option value="">{articles ? (sorted.length ? 'Escolha o artigo…' : 'Nenhum artigo publicado') : 'Carregando…'}</option>
            {sorted.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
          </CustomSelect>
        </SelectField>
        <label className="text-sm" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={full} onChange={(e) => setFull(e.target.checked)} /> Incluir o texto inteiro (sem marcar, vai só o resumo e o botão)
        </label>
        {error && <div className="sample-banner" role="alert"><span>{error}</span></div>}
      </div>
    </PopupDialog>
  );
}
