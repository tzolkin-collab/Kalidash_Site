import './setup-easy-email-i18n';
import { useState, useEffect, useRef } from 'react';
import { EmailEditorProvider, EmailEditor } from 'easy-email-editor';
import 'easy-email-editor/lib/style.css';
import { StandardLayout } from 'easy-email-extensions';
import 'easy-email-extensions/lib/style.css';
import '@arco-themes/react-easy-email-theme/css/arco.css';
import { BlockManager, BasicType, AdvancedType, JsonToMjml } from 'easy-email-core';
import { 
  Save, Mail, FileText, Sparkles, Check, Plus, Trash2, ArrowLeft, MoreHorizontal, Eye 
} from 'lucide-react';

const TRANSLATIONS: Record<string, string> = {
  'Configuration': 'Configuração',
  'Attributes': 'Atributos',
  'Typography': 'Tipografia',
  'Margin': 'Margem',
  'Padding': 'Preenchimento',
  'Dimension': 'Dimensão',
  'Dimensions': 'Dimensões',
  'Action': 'Ação',
  'Color': 'Cor',
  'Background color': 'Cor de Fundo',
  'Text color': 'Cor do Texto',
  'Font family': 'Fonte',
  'Font size': 'Tamanho da Fonte',
  'Font weight': 'Peso da Fonte',
  'Line height': 'Altura da Linha',
  'Text align': 'Alinhamento de Texto',
  'Letter spacing': 'Espaçamento de Letras',
  'Width': 'Largura',
  'Height': 'Altura',
  'Align': 'Alinhamento',
  'Link': 'Link',
  'Href': 'URL do Link',
  'Blank': 'Nova Janela',
  'Target': 'Abrir em',
  'Border': 'Borda',
  'Border radius': 'Arredondamento',
  'Border width': 'Espessura da Borda',
  'Border style': 'Estilo da Borda',
  'Border color': 'Cor da Borda',
  'Source': 'Origem da Imagem',
  'Content': 'Conteúdo',
  'Background': 'Fundo',
  'Layout': 'Estrutura',
  'Text': 'Texto',
  'Image': 'Imagem',
  'Button': 'Botão',
  'Divider': 'Divisor',
  'Spacer': 'Espaçador',
  'Social': 'Redes Sociais',
  'Hero': 'Capa (Hero)',
  'Wrapper': 'Container',
  'Section': 'Seção',
  'Column': 'Coluna',
  'Group': 'Grupo',
  'Setting': 'Ajustes',
  'Blocks': 'Blocos',
  'Apply': 'Aplicar',
  'Underline': 'Sublinhado',
  'Import font': 'Importar Fonte',
  'Name': 'Nome',
  'Subject': 'Assunto',
  'Content background': 'Fundo do Conteúdo',
  'User style': 'Estilo CSS Customizado',
  'No repeat': 'Não Repetir',
  'Repeat': 'Repetir',
  'Background image': 'Imagem de Fundo',
  'Background repeat': 'Repetição de Fundo',
  'Background size': 'Tamanho do Fundo',
  'Class name': 'Classe CSS',
  'Left': 'Esquerda',
  'Right': 'Direita',
  'Center': 'Centro',
  'Container background color': 'Cor de Fundo do Container',
  'None': 'Nenhum',
  'Overline': 'Linha Acima',
  'Line through': 'Riscado',
  'Text decoration': 'Decoração do Texto',
  'Opacity': 'Opacidade',
  'Text transform': 'Transformação de Texto',
  'Direction': 'Direção',
  'Please select': 'Selecione',
  'Top': 'Cima',
  'Bottom': 'Baixo',
  'Dashed': 'Tracejada',
  'Dotted': 'Pontilhada',
  'Solid': 'Sólida',
  'Style': 'Estilo',
  'Normal': 'Normal',
  'Italic': 'Itálico',
  'Font style': 'Estilo da Fonte',
  'Bold': 'Negrito',
  'Inner padding': 'Espaçamento Interno',
  'Button color': 'Cor do Botão',
  'Vertical align': 'Alinhamento Vertical',
  'Drag block': 'Arraste um Bloco'
};

export default function Emails() {
  const [activeTab, setActiveTab] = useState<'templates' | 'automations'>('templates');

  // Hack de Tradução Forçada (Substitui as strings Hardcoded da lib)
  useEffect(() => {
    if (activeTab !== 'templates') return;
    
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        if (mutation.type === 'characterData') {
          const text = mutation.target.nodeValue?.trim();
          if (text && TRANSLATIONS[text]) {
            mutation.target.nodeValue = mutation.target.nodeValue?.replace(text, TRANSLATIONS[text]) || null;
          }
        } else if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
              const text = node.nodeValue?.trim();
              if (text && TRANSLATIONS[text]) {
                node.nodeValue = node.nodeValue?.replace(text, TRANSLATIONS[text]) || null;
              }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
              // Walk through text nodes
              const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);
              let textNode;
              while ((textNode = walker.nextNode())) {
                const text = textNode.nodeValue?.trim();
                if (text && TRANSLATIONS[text]) {
                  textNode.nodeValue = textNode.nodeValue?.replace(text, TRANSLATIONS[text]) || null;
                }
              }
            }
          });
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    // Roda uma vez no load inicial
    setTimeout(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      let textNode;
      while ((textNode = walker.nextNode())) {
        const text = textNode.nodeValue?.trim();
        if (text && TRANSLATIONS[text]) {
          textNode.nodeValue = textNode.nodeValue?.replace(text, TRANSLATIONS[text]) || null;
        }
      }
    }, 500);

    return () => observer.disconnect();
  }, [activeTab]);
  
  // Real State for Templates
  const [templates, setTemplates] = useState([
    { id: 1, name: 'Boas-vindas (Inbound)', tag: 'Lead Frio', subject: 'Bem-vindo ao Kalidash!', design: null },
    { id: 2, name: 'Follow-up Reunião', tag: 'Acompanhamento', subject: 'Resumo da nossa reunião', design: null }
  ]);
  
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const initialValues = {
    subject: 'Assunto do E-mail...',
    subTitle: 'Pré-visualização',
    content: BlockManager.getBlockByType(BasicType.PAGE).create({
      children: [
        BlockManager.getBlockByType(AdvancedType.WRAPPER).create({
          children: [
            BlockManager.getBlockByType(AdvancedType.SECTION).create({
              children: [
                BlockManager.getBlockByType(AdvancedType.COLUMN).create({
                  children: [
                    BlockManager.getBlockByType(AdvancedType.TEXT).create({
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

  // State for Automations
  const [automations, setAutomations] = useState([
    { id: 1, trigger: 'Oportunidade Ganhadora', pipeline: 'Q4 Sales Pipeline', action: 'Enviar E-mail', templateId: 1, isActive: true }
  ]);
  const [isCreatingRule, setIsCreatingRule] = useState(false);
  const [newRule, setNewRule] = useState({ trigger: 'Oportunidade Criada', pipeline: 'Q4 Sales Pipeline', templateId: 1 });

  const handleCreateRule = () => {
    setAutomations([...automations, {
      id: Date.now(),
      trigger: newRule.trigger,
      pipeline: newRule.pipeline,
      action: 'Enviar E-mail',
      templateId: newRule.templateId,
      isActive: true
    }]);
    setIsCreatingRule(false);
  };

  const deleteRule = (id: number) => setAutomations(automations.filter(a => a.id !== id));
  const toggleRule = (id: number) => setAutomations(automations.map(a => a.id === id ? { ...a, isActive: !a.isActive } : a));

  // RENDERIZAÇÃO DO MODO EDIÇÃO (FULL SCREEN)
  if (editingTemplateId && currentTemplate) {
    const initialData = currentTemplate.design || initialValues;

    const onBeforePreview = async (html: string, mergeTags: any, rawMjml?: string) => {
      console.log("onBeforePreview triggered! rawMjml length:", rawMjml?.length);
      if (!rawMjml) return html;
      try {
        const res = await fetch('/api/compile-mjml', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mjmlString: rawMjml }),
        });
        console.log("Remote API response status:", res.status);
        if (res.ok) {
          const data = await res.json();
          console.log("Remote API returned HTML length:", data.html?.length);
          return data.html || html;
        }
      } catch (err) {
        console.error("Failed to compile MJML remotely:", err);
      }
      return html;
    };

    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', background: 'var(--bg-app)' }}>
        <EmailEditorProvider
          data={initialData}
          height={'100vh'}
          autoComplete
          dashed={false}
          onBeforePreview={onBeforePreview}
        >
          {({ values }) => {
            const handleSendTestEmail = async (currentValues: any) => {
              try {
                const email = prompt('Digite o e-mail de teste:');
                if (!email) return;

                const mjmlString = JsonToMjml({
                  data: currentValues.content,
                  mode: 'production',
                  context: currentValues.content,
                });

                // Como a compilação de MJML para HTML via 'mjml-browser' quebra o Vite,
                // vamos enviar o MJML direto para o backend ou enviar mock HTML por agora.
                const htmlMock = `<html><body><h1>Teste do Email</h1><p>${currentValues.subject}</p><p>O HTML real seria compilado no backend.</p></body></html>`;

                const response = await fetch('http://localhost:8080/api/emails/send', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    to: email,
                    subject: 'Teste de Template: ' + currentValues.subject,
                    body: htmlMock, // enviando um mock apenas para o email chegar
                    isHtml: true
                  })
                });

                if (response.ok) {
                  alert('E-mail de teste enviado com sucesso!');
                } else {
                  alert('Erro ao enviar e-mail de teste.');
                }
              } catch (err) {
                console.error(err);
                alert('Erro ao compilar o e-mail (MJML). Veja o console.');
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
                    <button onClick={() => handleSendTestEmail(values)} style={{ background: '#2563eb', color: '#ffffff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>
                      <Mail size={18} /> Enviar Teste
                    </button>
                    <button onClick={() => { updateCurrentTemplate({ design: values }); alert('Template salvo com sucesso!'); }} style={{ background: 'var(--accent)', color: 'var(--accent-text)', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>
                      <Save size={18} /> Salvar Layout
                    </button>
                  </div>
                </div>

                {/* Builder da Easy Email */}
                <div style={{ flex: 1, overflow: 'hidden', background: 'var(--bg-app)', display: 'flex', flexDirection: 'column' }}>
                  <StandardLayout compact={true} showSourceCode={false}>
                    <EmailEditor />
                  </StandardLayout>
                </div>
              </div>
            );
          }}
        </EmailEditorProvider>
      </div>
    );
  }

  // RENDERIZAÇÃO DO MODO NAVEGAÇÃO
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-app)', overflowY: 'auto' }}>
      
      {/* Top Header - Integrado de forma fluida (semelhante ao App.tsx) */}
      <header className="header animate-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '32px 40px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <h1 className="text-2xl font-bold" style={{ letterSpacing: '-0.02em' }}>Comunicação</h1>
          
          {/* Abas Horizontais integradas no Header */}
          <div style={{ display: 'flex', gap: '24px', height: '100%', alignItems: 'center' }}>
            <button 
              onClick={() => setActiveTab('templates')}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: activeTab === 'templates' ? 600 : 500, color: activeTab === 'templates' ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', gap: '8px', alignItems: 'center', padding: '8px 12px', borderRadius: '6px', backgroundColor: activeTab === 'templates' ? 'var(--bg-surface-hover)' : 'transparent' }}
            >
              <FileText size={16} /> Modelos Visuais
            </button>
            <button 
              onClick={() => setActiveTab('automations')}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: activeTab === 'automations' ? 600 : 500, color: activeTab === 'automations' ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', gap: '8px', alignItems: 'center', padding: '8px 12px', borderRadius: '6px', backgroundColor: activeTab === 'automations' ? 'var(--bg-surface-hover)' : 'transparent' }}
            >
              <Sparkles size={16} /> Automações
            </button>
          </div>
        </div>

        {activeTab === 'templates' && (
          <button onClick={createNewTemplate} style={{ background: 'var(--text-primary)', color: 'var(--bg-app)', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>
            <Plus size={16} /> Criar Template
          </button>
        )}
      </header>

      {/* Conteúdo Principal da Aba */}
      <div style={{ padding: '40px' }}>
        {/* Conteúdo da Aba Templates (Cards Grid) */}
        {activeTab === 'templates' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
          {templates.map(tpl => (
            <div 
              key={tpl.id}
              onClick={() => openEditor(tpl.id)}
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '16px', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.2s', boxShadow: 'var(--shadow-sm)' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
            >
              <div style={{ height: '140px', background: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
                <Mail size={40} className="text-muted" opacity={0.3} />
              </div>
              <div style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <h3 className="font-bold text-lg text-primary">{tpl.name}</h3>
                  <button style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><MoreHorizontal size={16} /></button>
                </div>
                <p className="text-sm text-muted mb-4 truncate">Assunto: {tpl.subject}</p>
                <span className="text-xs font-semibold" style={{ background: 'var(--bg-app)', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                  {tpl.tag}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Conteúdo da Aba Automações */}
      {activeTab === 'automations' && (
        <div style={{ maxWidth: '800px' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
              <div>
                <h2 className="text-2xl font-bold mb-2">Configure o fluxo de e-mails</h2>
                <p className="text-sm text-muted">Dispare os templates criados na outra aba de forma 100% automática.</p>
              </div>
              {!isCreatingRule && (
                <button onClick={() => setIsCreatingRule(true)} style={{ background: 'var(--text-primary)', color: 'var(--bg-app)', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>
                  <Plus size={16} /> Nova Regra
                </button>
              )}
           </div>

           {isCreatingRule && (
             <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--accent)', borderRadius: '16px', padding: '32px', boxShadow: 'var(--shadow-lg)', marginBottom: '32px' }}>
               <h3 className="font-bold text-xl mb-6">Criar Nova Automação</h3>
               <div style={{ display: 'flex', gap: '24px', marginBottom: '24px' }}>
                  <div style={{ flex: 1 }}>
                    <label className="text-sm font-semibold text-muted mb-3 block">Gatilho (Quando isso acontecer...)</label>
                    <select 
                      value={newRule.trigger} 
                      onChange={e => setNewRule({...newRule, trigger: e.target.value})}
                      style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '15px' }}
                    >
                      <option>Oportunidade Criada</option>
                      <option>Movido para Negociação</option>
                      <option>Oportunidade Ganhadora</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="text-sm font-semibold text-muted mb-3 block">Ação (Enviar este template)</label>
                    <select 
                      value={newRule.templateId} 
                      onChange={e => setNewRule({...newRule, templateId: parseInt(e.target.value)})}
                      style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '15px' }}
                    >
                      {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
               </div>
               <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                 <button onClick={() => setIsCreatingRule(false)} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>Cancelar</button>
                 <button onClick={handleCreateRule} style={{ padding: '10px 20px', background: 'var(--accent)', color: 'var(--accent-text)', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '14px' }}>Salvar Regra Ativa</button>
               </div>
             </div>
           )}

           <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
             {automations.map(auto => (
               <div key={auto.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '24px', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', gap: '32px', opacity: auto.isActive ? 1 : 0.6, transition: 'all 0.2s' }}>
                  
                  <div style={{ flex: 1 }}>
                    <span className="text-xs font-bold text-muted uppercase tracking-wider mb-3 block">Gatilho (Se)</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', padding: '16px', borderRadius: '12px' }}>
                      <div style={{ background: 'var(--pipe-won)', padding: '8px', borderRadius: '8px', color: '#fff' }}><Check size={18} /></div>
                      <div>
                        <div className="font-bold text-base text-primary mb-1">{auto.trigger}</div>
                        <div className="text-xs text-muted">Pipeline: {auto.pipeline}</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ color: 'var(--border-subtle)', display: 'flex', alignItems: 'center', marginTop: '24px' }}>
                    <div style={{ width: '32px', height: '2px', background: 'var(--border-subtle)' }} />
                  </div>

                  <div style={{ flex: 1 }}>
                    <span className="text-xs font-bold text-muted uppercase tracking-wider mb-3 block">Ação (Então)</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', padding: '16px', borderRadius: '12px' }}>
                      <div style={{ background: 'var(--bg-surface-hover)', padding: '8px', borderRadius: '8px', color: 'var(--text-primary)' }}><Mail size={18} /></div>
                      <div>
                        <div className="font-bold text-base text-primary mb-1">{auto.action}</div>
                        <div className="text-xs text-muted">Template: {templates.find(t => t.id === auto.templateId)?.name || 'Removido'}</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', borderLeft: '1px solid var(--border-subtle)', paddingLeft: '32px', marginTop: '24px' }}>
                    <div onClick={() => toggleRule(auto.id)} style={{ width: '44px', height: '24px', background: auto.isActive ? '#10B981' : 'var(--border-subtle)', borderRadius: '12px', position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}>
                      <div style={{ width: '20px', height: '20px', background: '#fff', borderRadius: '50%', position: 'absolute', top: '2px', left: auto.isActive ? '22px' : '2px', transition: 'left 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
                    </div>
                    <button onClick={() => deleteRule(auto.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '8px', borderRadius: '8px' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-app)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'} title="Excluir Regra">
                      <Trash2 size={18} />
                    </button>
                  </div>
               </div>
             ))}
           </div>
        </div>
      )}
      </div>
    </div>
  );
}
