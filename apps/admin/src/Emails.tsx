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
import { emailLog } from './mocks/team';
import { Badge, Field, Page, PageHeader, PopupDialog, SampleBanner, Tabs } from './components/ui';

// A lib tipa "categories" como obrigatória, mas já traz um padrão em tempo de execução.
// Passar [] esvaziaria o painel de blocos, então só ajustamos o tipo.
const EditorLayout = StandardLayout as unknown as ComponentType<{
  compact?: boolean;
  showSourceCode?: boolean;
  children?: ReactNode;
}>;

const getBlock = (type: BasicType | AdvancedType) => BlockManager.getBlockByType(type)!;

export default function Emails() {
  const [activeTab, setActiveTab] = useState<'templates' | 'history'>('templates');

  // Real State for Templates
  const [templates, setTemplates] = useState([
    { id: 1, name: 'Boas-vindas (Inbound)', tag: 'Lead Frio', subject: 'Bem-vindo ao Kalidash!', design: null },
    { id: 2, name: 'Follow-up Reunião', tag: 'Acompanhamento', subject: 'Resumo da nossa reunião', design: null }
  ]);
  
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testEmail, setTestEmail] = useState('');
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
              if (!testEmail.trim()) return;
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

                // ATENÇÃO: a API (/api/emails/send) ainda não aceita este formato: ela espera
                // opportunityId e ignora "to". O envio de teste só passa a funcionar quando a
                // API ganhar uma rota própria para isso.
                const response = await fetch(`${API_URL}/api/emails/send`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    to: testEmail.trim(),
                    subject: 'Teste de Template: ' + currentValues.subject,
                    body: html,
                    isHtml: true
                  })
                });

                if (response.ok) {
                  setFeedback({ title: 'E-mail de teste enviado', description: `Enviamos uma cópia para ${testEmail.trim()}.`, tone: 'success' });
                } else {
                  setFeedback({ title: 'Não foi possível enviar', description: 'A API não aceitou o envio. Verifique a conexão e se a rota de teste está habilitada.', tone: 'danger' });
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
                    <button onClick={() => { setTestEmail(''); setFeedback(null); setTestDialogOpen(true); }} disabled={sendingTest} style={{ background: '#2563eb', color: '#ffffff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', opacity: sendingTest ? 0.65 : 1 }}>
                      <Mail size={18} /> Enviar Teste
                    </button>
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
                  description="Escolha o endereço que receberá uma cópia deste modelo."
                  onClose={() => setTestDialogOpen(false)}
                  footer={<><button type="button" className="btn" onClick={() => setTestDialogOpen(false)}>Cancelar</button><button type="submit" form="email-test-form" className="btn btn-solid" disabled={!testEmail.trim() || sendingTest}>{sendingTest ? 'Enviando…' : 'Enviar teste'}</button></>}
                >
                  <form id="email-test-form" onSubmit={(event) => { event.preventDefault(); void handleSendTestEmail(values); }}>
                    <Field label="E-mail de destino"><input className="input" type="email" autoFocus required value={testEmail} onChange={(event) => setTestEmail(event.target.value)} placeholder="nome@empresa.com" /></Field>
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
        tabs={[{ id: 'templates' as const, label: 'Modelos visuais', count: templates.length }, { id: 'history' as const, label: 'Histórico de envio', count: emailLog.length }]}
        value={activeTab}
        onChange={(id) => setActiveTab(id as 'templates' | 'history')}
      />

      {activeTab === 'templates' ? (
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
          <SampleBanner phase={6}>O envio de teste e o histórico ainda não têm API: os envios abaixo são de exemplo.</SampleBanner>
          <div className="table-card">
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Quando</th><th>Para</th><th>Assunto</th><th>Modelo</th><th>Contexto</th><th>Status</th></tr></thead>
                <tbody>
                  {emailLog.map((m) => (
                    <tr key={m.id}>
                      <td className="text-muted">{new Date(m.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td>{m.to}</td>
                      <td>{m.subject}</td>
                      <td>{m.template}</td>
                      <td className="text-muted">{m.context}</td>
                      <td><Badge tone={m.status === 'SENT' ? 'success' : m.status === 'FAILED' ? 'danger' : 'warning'}>{m.status === 'SENT' ? 'Enviado' : m.status === 'FAILED' ? 'Falhou' : 'Na fila'}</Badge></td>
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
