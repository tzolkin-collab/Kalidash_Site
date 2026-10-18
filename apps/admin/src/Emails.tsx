import './setup-easy-email-i18n';
import { useState, useEffect } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { EmailEditorProvider, EmailEditor } from 'easy-email-editor';
import 'easy-email-editor/lib/style.css';
import { StandardLayout } from 'easy-email-extensions';
import 'easy-email-extensions/lib/style.css';
import '@arco-themes/react-easy-email-theme/css/arco.css';
import { BlockManager, BasicType, AdvancedType, JsonToMjml } from 'easy-email-core';
import mjml from 'mjml-browser';
import {
  Save, Mail, Plus, ArrowLeft
} from 'lucide-react';
import { startEditorDomTranslation } from './easy-email-dom-translate';
import { API_URL } from './lib/api';
import { useAuth } from './lib/auth';
import { emailLog } from './mocks/team';
import { Badge, Page, PageHeader, PopupDialog, SampleBanner, Tabs } from './components/ui';

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

  // Real State for Templates
  const [templates, setTemplates] = useState([
    { id: 1, name: 'Boas-vindas (Inbound)', tag: 'Lead Frio', subject: 'Bem-vindo ao Kalidash!', design: null },
    { id: 2, name: 'Follow-up Reunião', tag: 'Acompanhamento', subject: 'Resumo da nossa reunião', design: null }
  ]);
  
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  // O teste só vai para o e-mail de quem está logado (POST /api/emails/test): nunca há destinatário digitado.
  const auth = useAuth();
  const myEmail = auth.status === 'in' ? auth.user?.email : undefined;
  const [sendingTest, setSendingTest] = useState(false);
  const [feedback, setFeedback] = useState<{ title: string; description: string; tone: 'success' | 'danger' } | null>(null);

  // Com o editor aberto, traduz os textos que a biblioteca escreve fora do t().
  const isEditing = editingTemplateId !== null;
  useEffect(() => {
    if (!isEditing) return;
    return startEditorDomTranslation();
  }, [isEditing]);

  const initialValues = {
    subject: 'Assunto do E-mail...',
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
                          content: '<h1>Bem-vindo!</h1><p>Arraste novos blocos aqui ou edite este texto.</p>',
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
  };

  const currentTemplate = templates.find(t => t.id === editingTemplateId);

  const updateCurrentTemplate = (updates: any) => {
    setTemplates(prev => prev.map(t => t.id === editingTemplateId ? { ...t, ...updates } : t));
  };

  const openEditor = (templateId: number) => {
    setEditingTemplateId(templateId);
  };

  const createNewTemplate = () => {
    const newId = Date.now();
    setTemplates([...templates, { id: newId, name: 'Novo Template Lindo', tag: 'Geral', subject: 'Assunto do E-mail...', design: null }]);
    setEditingTemplateId(newId);
  };

  // RENDERIZAÇÃO DO MODO EDIÇÃO (FULL SCREEN)
  if (editingTemplateId && currentTemplate) {
    const initialData = currentTemplate.design || initialValues;

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
                const mjmlString = JsonToMjml({
                  data: currentValues.content,
                  mode: 'production',
                  context: currentValues.content,
                });

                // HTML final do e-mail, compilado aqui no navegador (mesmo motor do canvas).
                const { html } = mjml(mjmlString);

                const response = await fetch(`${API_URL}/api/emails/test`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ subject: 'Teste de Template: ' + currentValues.subject, body: html }),
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-app)' }}>
                  <div style={{ display: 'flex', gap: '24px', flex: 1, alignItems: 'center' }}>
                    <button 
                      onClick={() => setEditingTemplateId(null)} 
                      style={{ background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}
                    >
                      <ArrowLeft size={20} />
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <input 
                        type="text"
                        value={currentTemplate.name}
                        onChange={(e) => updateCurrentTemplate({ name: e.target.value })}
                        className="text-xl font-bold" 
                        style={{ outline: 'none', border: 'none', background: 'transparent' }}
                      />
                      <div style={{ width: '1px', height: '24px', background: 'var(--border-subtle)' }}></div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span className="text-sm font-semibold text-muted">Assunto:</span>
                        <input 
                          type="text" 
                          value={currentTemplate.subject}
                          onChange={(e) => updateCurrentTemplate({ subject: e.target.value })}
                          style={{ background: 'transparent', border: 'none', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', outline: 'none', minWidth: '250px' }}
                        />
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={() => { setFeedback(null); setTestDialogOpen(true); }} disabled={sendingTest || !myEmail} title={myEmail ? `Envia uma cópia para ${myEmail}` : 'Entre com a sua conta (login ligado na API) para enviar um teste: ele só vai para o seu próprio e-mail.'} style={{ background: '#2563eb', color: '#ffffff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, display: 'flex', gap: '8px', alignItems: 'center', cursor: sendingTest || !myEmail ? 'not-allowed' : 'pointer', boxShadow: 'var(--shadow-sm)', opacity: sendingTest || !myEmail ? 0.5 : 1 }}>
                      <Mail size={18} /> Enviar Teste
                    </button>{!myEmail && <span className="text-xs text-muted" role="note" style={{ maxWidth: 220 }}>Para enviar um teste, entre com a sua conta: ele só vai para o seu e-mail.</span>}
                    <button onClick={() => { updateCurrentTemplate({ design: values }); setFeedback({ title: 'Layout salvo', description: 'O modelo foi atualizado nesta sessão.', tone: 'success' }); }} style={{ background: 'var(--accent)', color: 'var(--accent-text)', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>
                      <Save size={18} /> Salvar Layout
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
        tabs={[{ id: 'inbox' as const, label: 'Caixa de Entrada' }, { id: 'templates' as const, label: 'Modelos visuais', count: templates.length }, { id: 'history' as const, label: 'Histórico de envio', count: emailLog.length }]}
        value={activeTab}
        onChange={(id) => setActiveTab(id as 'inbox' | 'templates' | 'history')}
      />

      {activeTab === 'inbox' ? (
        <div style={{ padding: '60px 24px', textAlign: 'center', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)', marginTop: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: 64, height: 64, background: 'var(--bg-body)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Mail size={32} className="text-muted" opacity={0.5} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Caixa de entrada desconectada</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 420, marginBottom: 24, lineHeight: 1.5 }}>
            Conecte sua conta de e-mail (Google Workspace ou Microsoft 365) via OAuth para centralizar as mensagens dos seus leads aqui.
          </p>
          <button className="btn btn-solid" onClick={() => alert('Em breve: Redirecionamento para a página de Integrações (Google/Microsoft OAuth).')}>
            Conectar conta de e-mail
          </button>
        </div>
      ) : activeTab === 'templates' ? (
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
      ) : (
        <>
          <SampleBanner phase={6}>Modelos e histórico ainda não têm API: os envios abaixo são de exemplo. O envio de teste do editor é real e vai só para o seu e-mail.</SampleBanner>
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
