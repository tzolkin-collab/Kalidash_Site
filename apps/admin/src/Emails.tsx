import './setup-easy-email-i18n';
import { useState, useEffect, useMemo } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { EmailEditorProvider, EmailEditor } from 'easy-email-editor';
import 'easy-email-editor/lib/style.css';
import { StandardLayout } from 'easy-email-extensions';
import 'easy-email-extensions/lib/style.css';
import '@arco-themes/react-easy-email-theme/css/arco.css';
import { BlockManager, BasicType, AdvancedType, JsonToMjml } from 'easy-email-core';
import mjml from 'mjml-browser';
import {
  Save, Mail, Plus, ArrowLeft, Trash2
} from 'lucide-react';
import { startEditorDomTranslation } from './easy-email-dom-translate';
import { API_URL } from './lib/api';
import { useAuth } from './lib/auth';
import { emailLog } from './mocks/team';
import { Badge, Page, PageHeader, PopupDialog, SampleBanner, Tabs } from './components/ui';
import { EmailJobsTable } from './components/EmailFlows';
import { deleteTemplate, saveTemplate, useEmailBoot } from './lib/emailApi';
import { useCan } from './lib/permissions';

// A lib tipa "categories" como obrigatória, mas já traz um padrão em tempo de execução.
// Passar [] esvaziaria o painel de blocos, então só ajustamos o tipo.
const EditorLayout = StandardLayout as unknown as ComponentType<{
  compact?: boolean;
  showSourceCode?: boolean;
  children?: ReactNode;
}>;

const getBlock = (type: BasicType | AdvancedType) => BlockManager.getBlockByType(type)!;

export default function Emails() {
  const [activeTab, setActiveTab] = useState<'inbox' | 'templates' | 'history'>('inbox');

  // Com EMAIL_AUTOMATIONS=1 na API os modelos são do servidor (os fluxos automáticos os enviam); sem a flag, ficam
  // só nesta tela, como antes. Um modelo novo é rascunho ('new:…') até o primeiro "Salvar".
  const email = useEmailBoot();
  const onServer = email.mode === 'api';
  const can = useCan();
  const canManage = can.has('automations:manage');
  type Draft = { id: string; name: string; tag: string; subject: string; design: any; html?: string; saved: boolean };
  const [localTemplates, setLocalTemplates] = useState<Draft[]>([
    { id: 'l1', name: 'Boas-vindas (Inbound)', tag: 'Lead Frio', subject: 'Bem-vindo ao Kalidash!', design: null, saved: false },
    { id: 'l2', name: 'Follow-up Reunião', tag: 'Acompanhamento', subject: 'Resumo da nossa reunião', design: null, saved: false }
  ]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const serverTemplates: Draft[] = email.templates.map((t) => ({ id: t.id, name: t.name, tag: t.tag, subject: t.subject, design: t.design ?? null, html: t.html, saved: true }));
  const templates: Draft[] = (onServer ? serverTemplates : localTemplates).map((t) => drafts[t.id] ?? t)
    .concat(Object.values(drafts).filter((d) => d.id.startsWith('new:')));
  const setTemplates = (fn: (prev: Draft[]) => Draft[]) => {
    if (!onServer) { setLocalTemplates(fn); return; }
    const next = fn(templates);
    setDrafts((prev) => { const out = { ...prev }; for (const t of next) out[t.id] = t; return out; });
  };
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  // O teste só vai para o e-mail de quem está logado (POST /api/emails/test): nunca há destinatário digitado.
  const auth = useAuth();
  const myEmail = auth.status === 'in' ? auth.user?.email : undefined;
  const myName = auth.status === 'in' ? auth.user?.name ?? '' : '';
  const [sendingTest, setSendingTest] = useState(false);
  const [feedback, setFeedback] = useState<{ title: string; description: string; tone: 'success' | 'danger' } | null>(null);

  // Com o editor aberto, traduz os textos que a biblioteca escreve fora do t().
  const isEditing = editingTemplateId !== null;
  useEffect(() => {
    if (!isEditing) return;
    return startEditorDomTranslation();
  }, [isEditing]);

  // O conteúdo inicial do editor: o layout salvo; sem layout (modelo criado pela API), o HTML salvo dentro de um
  // bloco de texto, para nunca abrir um texto padrão no lugar do e-mail que os fluxos enviam. O assunto é sempre o
  // do modelo: o campo "Assunto" do painel do editor é o único lugar onde ele se edita.
  const pageWith = (html: string) => ({
    subject: '',
    subTitle: 'Pré-visualização',
    content: getBlock(BasicType.PAGE).create({
      children: [
        getBlock(AdvancedType.WRAPPER).create({
          children: [
            getBlock(AdvancedType.SECTION).create({
              children: [
                getBlock(AdvancedType.COLUMN).create({
                  children: [
                    getBlock(AdvancedType.TEXT).create({
                      data: {
                        value: {
                          content: html,
                        },
                      },
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  });
  const bodyOf = (html: string) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.innerHTML.trim() || html;
  };
  const initialValuesFor = (t: Draft) => {
    const base = t.design ?? pageWith(t.html ? bodyOf(t.html) : '<h1>Olá, {{primeiro_nome}}!</h1><p>Arraste novos blocos aqui ou edite este texto.</p>');
    return { ...base, subject: t.subject };
  };

  const currentTemplate = templates.find(t => t.id === editingTemplateId);

  const updateCurrentTemplate = (updates: Partial<Draft>) => {
    setTemplates(prev => prev.map(t => t.id === editingTemplateId ? { ...t, ...updates } : t));
  };

  const openEditor = (templateId: string) => {
    setEditingTemplateId(templateId);
  };

  const createNewTemplate = () => {
    const newId = onServer ? `new:${Date.now()}` : `l${Date.now()}`;
    const draft: Draft = { id: newId, name: 'Novo modelo', tag: 'Geral', subject: 'Oi, {{primeiro_nome}}', design: null, saved: false };
    if (onServer) setDrafts((prev) => ({ ...prev, [newId]: draft }));
    else setLocalTemplates((prev) => [...prev, draft]);
    setEditingTemplateId(newId);
  };

  const closeEditor = () => {
    // Rascunho nunca salvo some ao voltar; o que tem versão no servidor volta para ela.
    if (editingTemplateId && onServer) setDrafts((prev) => { const out = { ...prev }; delete out[editingTemplateId]; return out; });
    setEditingTemplateId(null);
  };

  /** Compila o layout do editor no HTML final (o mesmo motor do canvas e do envio de teste). */
  const compileHtml = (values: any) => mjml(JsonToMjml({ data: values.content, mode: 'production', context: values.content })).html;

  const handleSave = async (values: any) => {
    if (!currentTemplate) return;
    if (!onServer) {
      updateCurrentTemplate({ design: values, subject: String(values.subject ?? '') });
      setFeedback({ title: 'Layout salvo nesta tela', description: 'A API daqui não guarda modelos (EMAIL_AUTOMATIONS desligado): o modelo se perde ao sair desta tela.', tone: 'success' });
      return;
    }
    setSaving(true);
    try {
      const subject = String(values.subject ?? '').trim();
      const saved = await saveTemplate({ id: currentTemplate.saved ? currentTemplate.id : undefined, name: currentTemplate.name, tag: currentTemplate.tag, subject, html: compileHtml(values), design: values });
      setDrafts((prev) => { const out = { ...prev }; delete out[currentTemplate.id]; return out; });
      setEditingTemplateId(saved.id);
      setFeedback({ title: 'Modelo salvo', description: 'Os fluxos que usam este modelo já enviam esta versão.', tone: 'success' });
    } catch (err) {
      setFeedback({ title: 'Não foi possível salvar', description: (err as Error).message, tone: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!currentTemplate) return;
    if (!currentTemplate.saved) { closeEditor(); return; }
    setConfirmDelete(false);
    try {
      await deleteTemplate(currentTemplate.id);
      setEditingTemplateId(null);
    } catch (err) {
      setFeedback({ title: 'Não foi possível apagar', description: (err as Error).message, tone: 'danger' });
    }
  };

  // Calculado uma vez por modelo aberto: um objeto novo a cada render reiniciaria o editor (e apagaria o que foi
  // arrastado) toda vez que alguém digitasse o nome do modelo. Salvar um rascunho troca o id, sem reabrir o editor.
  const openKey = editingTemplateId?.startsWith('new:') ? 'draft' : editingTemplateId;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialData = useMemo(() => (currentTemplate ? initialValuesFor(currentTemplate) : null), [openKey]);

  // RENDERIZAÇÃO DO MODO EDIÇÃO (FULL SCREEN)
  if (editingTemplateId && currentTemplate && initialData) {

    return (
      // email-editor-light: o editor de e-mail é sempre claro, mesmo com o app em modo escuro.
      <div className="email-editor-light" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', background: 'var(--bg-app)' }}>
        <EmailEditorProvider
          data={initialData}
          height={'100vh'}
          autoComplete
          dashed={false}
        >
          {({ values }) => {
            const handleSendTestEmail = async (currentValues: any) => {
              if (!myEmail) return;
              setSendingTest(true);
              setTestDialogOpen(false);
              try {
                // HTML final do e-mail, compilado aqui no navegador (mesmo motor do canvas), com as variáveis trocadas
                // pelos dados de quem está logado: a prévia chega como o lead vai ver.
                const sample: Record<string, string> = { nome: myName || 'Maria Souza', primeiro_nome: (myName || 'Maria Souza').split(/\s+/)[0], email: myEmail, oportunidade: 'Projeto de exemplo' };
                const fill = (text: string, escape: boolean) => text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, k: string) => {
                  const v = sample[k.toLowerCase()] ?? '';
                  return escape ? v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : v;
                });
                const html = fill(compileHtml(currentValues), true);

                const response = await fetch(`${API_URL}/api/emails/test`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ subject: 'Teste: ' + fill(String(currentValues.subject ?? '').trim(), false), body: html }),
                });

                if (response.ok) {
                  setFeedback({ title: 'E-mail de teste enviado', description: `Enviamos uma cópia para ${myEmail}.`, tone: 'success' });
                } else {
                  const reason = response.status === 401 ? 'Sua sessão não está ativa: entre de novo.'
                    : response.status === 429 ? 'Muitos testes seguidos. Espere alguns minutos.'
                    : response.status === 404 ? 'Esta API não tem o envio de teste (atualize a API).'
                    : 'A API não conseguiu enviar (confira a chave do Resend na API).';
                  setFeedback({ title: 'Não foi possível enviar', description: reason, tone: 'danger' });
                }
              } catch (err) {
                console.error(err);
                setFeedback({ title: 'Falha ao preparar o e-mail', description: 'Não foi possível compilar ou enviar este teste. Revise o conteúdo e tente novamente.', tone: 'danger' });
              } finally {
                setSendingTest(false);
              }
            };

            return (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Header do Modo Editor */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-app)' }}>
                  <div style={{ display: 'flex', gap: '16px', flex: '1 1 320px', alignItems: 'center', minWidth: 0 }}>
                    <button 
                      onClick={closeEditor} aria-label="Voltar para os modelos" 
                      style={{ background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}
                    >
                      <ArrowLeft size={20} />
                    </button>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}>
                      <input
                        type="text"
                        value={currentTemplate.name}
                        onChange={(e) => updateCurrentTemplate({ name: e.target.value })}
                        aria-label="Nome do modelo"
                        className="text-xl font-bold"
                        style={{ outline: 'none', border: 'none', background: 'transparent', minWidth: 0, width: '100%' }}
                      />
                      <span className="text-xs text-muted">{'Assunto no painel à esquerda. Variáveis no assunto e no texto: {{primeiro_nome}} {{nome}} {{email}} {{oportunidade}}'}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    <button onClick={() => { setFeedback(null); setTestDialogOpen(true); }} disabled={sendingTest || !myEmail} title={myEmail ? `Envia uma cópia para ${myEmail}` : 'Entre com a sua conta (login ligado na API) para enviar um teste: ele só vai para o seu próprio e-mail.'} style={{ background: '#2563eb', color: '#ffffff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, display: 'flex', gap: '8px', alignItems: 'center', cursor: sendingTest || !myEmail ? 'not-allowed' : 'pointer', boxShadow: 'var(--shadow-sm)', opacity: sendingTest || !myEmail ? 0.5 : 1 }}>
                      <Mail size={18} /> Enviar Teste
                    </button>{!myEmail && <span className="text-xs text-muted" role="note" style={{ maxWidth: 220 }}>Para enviar um teste, entre com a sua conta: ele só vai para o seu e-mail.</span>}
                    {onServer && canManage && (
                      <button type="button" className="btn" onClick={() => (currentTemplate.saved ? setConfirmDelete(true) : void handleDelete())} title={currentTemplate.saved ? 'Apaga o modelo (recusado se um fluxo usa ele)' : 'Descarta o rascunho'}>
                        <Trash2 size={16} /> {currentTemplate.saved ? 'Apagar' : 'Descartar'}
                      </button>
                    )}
                    <button onClick={() => void handleSave(values)} disabled={saving || (onServer && !canManage)} title={onServer && !canManage ? 'Só Admin e Gerente editam os modelos que as automações enviam' : undefined} style={{ background: 'var(--accent)', color: 'var(--accent-text)', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, display: 'flex', gap: '8px', alignItems: 'center', cursor: saving ? 'wait' : 'pointer', boxShadow: 'var(--shadow-sm)', opacity: saving || (onServer && !canManage) ? 0.6 : 1 }}>
                      <Save size={18} /> {saving ? 'Salvando…' : 'Salvar modelo'}
                    </button>
                  </div>
                </div>

                {/* Builder da Easy Email */}
                <div style={{ flex: 1, overflow: 'hidden', background: 'var(--bg-app)', display: 'flex', flexDirection: 'column' }}>
                  <EditorLayout compact={true} showSourceCode={false}>
                    <EmailEditor />
                  </EditorLayout>
                </div>

                {testDialogOpen && <PopupDialog
                  eyebrow="ENVIO DE TESTE"
                  title="Enviar uma prévia"
                  description={`A cópia deste modelo será enviada só para o seu e-mail: ${myEmail}.`}
                  onClose={() => setTestDialogOpen(false)}
                  footer={<><button type="button" className="btn" onClick={() => setTestDialogOpen(false)}>Cancelar</button><button type="submit" form="email-test-form" className="btn btn-solid" disabled={!myEmail || sendingTest}>{sendingTest ? 'Enviando…' : 'Enviar teste'}</button></>}
                >
                  <form id="email-test-form" onSubmit={(event) => { event.preventDefault(); void handleSendTestEmail(values); }}>
                    <p className="text-sm text-muted" style={{ margin: 0 }}>Por segurança, o teste nunca vai para outro endereço.</p>
                  </form>
                </PopupDialog>}

                {confirmDelete && <PopupDialog
                  eyebrow="APAGAR MODELO"
                  tone="danger"
                  title={`Apagar "${currentTemplate.name}"?`}
                  description="O modelo sai do servidor e não dá para desfazer. Se algum fluxo de e-mail usa este modelo, o servidor recusa: troque o modelo do fluxo antes."
                  onClose={() => setConfirmDelete(false)}
                  footer={<><button type="button" className="btn" onClick={() => setConfirmDelete(false)}>Cancelar</button><button type="button" className="btn btn-solid" onClick={() => void handleDelete()}>Apagar modelo</button></>}
                />}

                {feedback && <PopupDialog
                  eyebrow={feedback.tone === 'success' ? 'AÇÃO CONCLUÍDA' : 'ENVIO DE E-MAIL'}
                  tone={feedback.tone}
                  title={feedback.title}
                  description={feedback.description}
                  onClose={() => setFeedback(null)}
                  footer={<button type="button" className="btn btn-solid" onClick={() => setFeedback(null)}>Entendi</button>}
                />}
              </div>
            );
          }}
        </EmailEditorProvider>
      </div>
    );
  }

  // RENDERIZAÇÃO DO MODO NAVEGAÇÃO
  return (
    <Page>
      <PageHeader
        title="E-mails"
        subtitle="Monte os modelos visuais e acompanhe o que foi enviado. As regras que disparam e-mails ficam em Automações."
        actions={activeTab === 'templates' ? <button type="button" className="btn btn-solid" onClick={createNewTemplate}><Plus size={14} /> Criar template</button> : undefined}
      />
      <Tabs
        tabs={[{ id: 'inbox' as const, label: 'Caixa de Entrada' }, { id: 'templates' as const, label: 'Modelos visuais', count: templates.length }, { id: 'history' as const, label: 'Histórico de envio', count: onServer ? email.jobs.length : emailLog.length }]}
        value={activeTab}
        onChange={(id) => setActiveTab(id as 'inbox' | 'templates' | 'history')}
      />

      {activeTab === 'inbox' ? (
        // Ainda não existe: sem botão de conectar, para ninguém achar que é só uma configuração pendente.
        <div style={{ padding: '60px 24px', textAlign: 'center', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)', marginTop: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: 64, height: 64, background: 'var(--bg-body)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Mail size={32} className="text-muted" opacity={0.5} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Caixa de entrada ainda não disponível</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 460, lineHeight: 1.5 }}>
            Ler aqui as respostas dos leads, ligando uma conta Google Workspace ou Microsoft 365, ainda não existe no Kalidash.
            Por enquanto, responda pelo seu e-mail de sempre e registre o contato como anotação no lead ou na oportunidade.
          </p>
        </div>
      ) : activeTab === 'templates' ? (
        <>
        {email.mode === 'off' && <SampleBanner offline>Os modelos não são salvos: a API daqui não tem os e-mails automáticos ligados (EMAIL_AUTOMATIONS=1), então o que for criado ou editado se perde ao sair desta tela. O envio de teste do editor é real e vai só para o seu e-mail.</SampleBanner>}
        {onServer && templates.length === 0 && <p className="text-sm text-muted">Nenhum modelo ainda. Crie o primeiro e escolha-o num fluxo em Automações → E-mails automáticos.</p>}
        <div className="template-grid">
          {templates.map((tpl) => (
            <button type="button" key={tpl.id} className="template-card" onClick={() => openEditor(tpl.id)}>
              <div className="template-thumb"><Mail size={40} className="text-muted" opacity={0.3} /></div>
              <div className="template-info">
                <h3 className="template-name">{tpl.name}</h3>
                <p className="text-sm text-muted truncate">Assunto: {tpl.subject}</p>
                <Badge tone="info">{tpl.tag}</Badge>
              </div>
            </button>
          ))}
        </div>
        </>
      ) : onServer ? (
        <EmailJobsTable />
      ) : (
        <>
          <SampleBanner>Modelos e histórico ainda não são salvos no servidor: os envios abaixo são de exemplo. O envio de teste do editor é real e vai só para o seu e-mail.</SampleBanner>
          <div className="table-card">
            <div className="table-scroll">
              <table className="data-table data-table-cards">
                <thead><tr><th>Quando</th><th>Para</th><th>Assunto</th><th>Modelo</th><th>Contexto</th><th>Status</th></tr></thead>
                <tbody>
                  {emailLog.map((m) => (
                    <tr key={m.id}>
                      <td className="text-muted" data-label="Quando">{new Date(m.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td data-label="Para">{m.to}</td>
                      <td data-label="Assunto">{m.subject}</td>
                      <td data-label="Modelo">{m.template}</td>
                      <td className="text-muted" data-label="Contexto">{m.context}</td>
                      <td data-label="Status"><Badge tone={m.status === 'SENT' ? 'success' : m.status === 'FAILED' ? 'danger' : 'warning'}>{m.status === 'SENT' ? 'Enviado' : m.status === 'FAILED' ? 'Falhou' : 'Na fila'}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </Page>
  );
}
