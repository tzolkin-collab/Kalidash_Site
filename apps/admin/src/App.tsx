import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Kanban,
  LayoutList, 
  Users, 
  Settings, 
  Plus, 
  MoreHorizontal,
  CircleDashed,
  CircleDot,
  CheckCircle2,
  PhoneCall,
  User,
  Menu,
  Moon,
  Sun,
  X,
  Globe,
  FileText,
  CheckSquare,
  MessageSquare,
  Activity,
  Send,
  Phone,
  Mail,
  Search,
  Filter,
  ChevronDown,
  FolderGit2,
  Check
} from 'lucide-react';
import Emails from './Emails';
import PipelineBuilder from './PipelineBuilder';

type Note = {
  id: string;
  content: string;
  type: string;
  created_at: string;
  authorName?: string;
  authorAvatar?: string;
};

type Opportunity = {
  id: string;
  title: string;
  value: number;
  stage: string;
  priority: string;
  tags: string[];
  pipeline?: string;
  
  // Relacionais (B2C / B2B)
  companyId?: string;
  companyName?: string;
  companyLogo?: string;
  
  contactId?: string;
  contactName?: string;
  contactAvatar?: string;
  
  ownerId?: string;
  ownerName?: string;
  ownerAvatar?: string;
};

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [currentRoute, setCurrentRoute] = useState<'crm' | 'emails' | 'new-pipeline'>('crm');
  const [isContextSelectorOpen, setIsContextSelectorOpen] = useState(false);
  const [selectedContext, setSelectedContext] = useState('Visão Geral');
  const pipelines = ['Q4 Sales Pipeline', 'Parcerias B2B', 'Expansão 2026'];
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState('team'); 
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('table');
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);

  // CRM State
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [noteType, setNoteType] = useState('NOTE');

  // Modal specific states
  const [activeTab, setActiveTab] = useState('overview');
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingValue, setEditingValue] = useState(false);
  const [tempTitle, setTempTitle] = useState('');
  const [tempValue, setTempValue] = useState('');

  // Carrega os dados da API Go
  useEffect(() => {
    fetch('http://localhost:8080/api/leads') // A rota Go ainda atende aqui
      .then(res => res.json())
      .then(data => {
        setOpportunities(data || []);
        setTimeout(() => setIsReady(true), 500);
      })
      .catch(err => {
        console.error("Erro ao carregar oportunidades:", err);
        setIsReady(true);
      });
  }, []);

  const toggleTheme = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!document.startViewTransition) {
      setIsDarkMode(!isDarkMode);
      return;
    }
    const x = e.clientX;
    const y = e.clientY;
    const endRadius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

    const transition = document.startViewTransition(() => {
      setIsDarkMode((prev) => !prev);
    });

    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 700,
          easing: 'cubic-bezier(0.645, 0.045, 0.355, 1)',
          pseudoElement: '::view-transition-new(root)',
        }
      );
    });
  };

  // Fetch Notes whenever selectedOpp changes
  useEffect(() => {
    if (selectedOpp) {
      fetch(`http://localhost:8080/api/leads/notes?opportunityId=${selectedOpp.id}`)
        .then(res => res.json())
        .then(data => setNotes(data || []))
        .catch(console.error);
    } else {
      setNotes([]);
      setNewNote('');
      setNoteType('NOTE');
    }
  }, [selectedOpp]);

  const handleAddNote = () => {
    if (!newNote.trim() || !selectedOpp) return;
    
    const payload = {
      content: newNote,
      type: noteType,
      opportunityId: selectedOpp.id
    };

    fetch('http://localhost:8080/api/leads/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(savedNote => {
      setNotes(prev => [savedNote, ...prev]);
      setNewNote('');
    })
    .catch(console.error);
  };

  const logSystemNote = (oppId: string, content: string) => {
    fetch('http://localhost:8080/api/leads/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, type: 'NOTE', opportunityId: oppId })
    })
    .then(res => res.json())
    .then(savedNote => setNotes(prev => [savedNote, ...prev]))
    .catch(console.error);
  };

  const saveOpportunityEdit = () => {
    if (!selectedOpp) return;

    const valueNum = parseFloat(tempValue.replace(/\D/g, '')) / 100 || selectedOpp.value;

    fetch('http://localhost:8080/api/leads', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...selectedOpp, title: tempTitle, value: valueNum })
    })
    .then(res => res.json())
    .then(updatedOpp => {
      if (tempTitle !== selectedOpp.title) logSystemNote(selectedOpp.id, `O título foi alterado para: "${tempTitle}"`);
      if (valueNum !== selectedOpp.value) logSystemNote(selectedOpp.id, `O valor foi alterado para: ${formatCurrency(valueNum)}`);

      setOpportunities(prev => prev.map(o => o.id === selectedOpp.id ? updatedOpp : o));
      setSelectedOpp(updatedOpp);
      setEditingTitle(false);
      setEditingValue(false);
    })
    .catch(console.error);
  };

  // Drag and Drop Logic
  const handleDragStart = (e: React.DragEvent, oppId: string) => {
    e.dataTransfer.setData("oppId", oppId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    const oppId = e.dataTransfer.getData("oppId");
    if (!oppId) return;

    // Atualização Otimista no Frontend
    setOpportunities(prev => prev.map(o => o.id === oppId ? { ...o, stage: stageId } : o));

    // Persiste no Backend Go
    fetch('http://localhost:8080/api/leads/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: oppId, column_id: stageId })
    }).catch(err => console.error("Falha ao mover oportunidade:", err));
  };

  // Funções Utilitárias
  const formatCurrency = (val: number) => `R$ ${(val || 0).toLocaleString('pt-BR')}`;

  const filteredOpportunities = selectedContext === 'Visão Geral' 
    ? opportunities 
    : opportunities.filter(opp => (opp.pipeline || 'Q4 Sales Pipeline') === selectedContext);
  
  const totalValue = (stageId: string) => 
    filteredOpportunities.filter(o => o.stage === stageId).reduce((acc, curr) => acc + (curr.value || 0), 0);
  
  const renderCard = (opp: Opportunity) => (
    <div 
      key={opp.id}
      className="card"
      style={{ boxShadow: 'var(--shadow-sm)' }}
      draggable
      onDragStart={(e) => handleDragStart(e, opp.id)}
      onClick={() => setSelectedOpp(opp)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span className="text-sm font-semibold">{opp.title}</span>
        {opp.stage === 'INBOUND' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
            <PhoneCall size={12} />
            <span className="text-xs">Novo</span>
          </div>
        )}
      </div>

      {/* Visual B2B/B2C */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        {opp.contactAvatar ? (
           <img src={opp.contactAvatar} alt={opp.contactName} style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
           <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--bg-surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={12} color="var(--text-muted)" /></div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
           <span className="text-xs font-medium">{opp.contactName || 'Sem contato'}</span>
           {opp.companyName && <span className="text-xs text-muted" style={{ fontSize: '10px' }}>{opp.companyName}</span>}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {opp.tags && opp.tags.map(t => <span key={t} className="tag">{t}</span>)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="text-sm font-semibold text-muted">{formatCurrency(opp.value)}</span>
          <div className="avatar-stack">
            {opp.ownerAvatar ? (
               <img src={opp.ownerAvatar} alt={opp.ownerName} title={opp.ownerName} />
            ) : (
               <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--bg-surface)', border: '2px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={12} color="var(--text-muted)" /></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`app-wrapper ${isDarkMode ? 'dark' : ''}`}>
      {/* Splash Screen */}
      <div className={`splash-screen ${isReady ? 'hide' : ''}`}>
        <div className="splash-logo" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <img src="/kalidash-logo.svg" alt="Kalidash Logo" style={{ height: '70px', filter: isDarkMode ? 'invert(1)' : 'none' }} />
        </div>
      </div>

      <div className="layout">
        <div 
          className={`sidebar-backdrop ${isMobileMenuOpen ? 'show' : ''}`} 
          onClick={() => setIsMobileMenuOpen(false)}
        ></div>

        {/* Sidebar */}
        <aside className={`sidebar animate-sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
          <div style={{ padding: '24px 20px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src="/kalidash-icon.svg" alt="Kalidash Icon" style={{ width: '28px', height: '28px', filter: isDarkMode ? 'invert(1)' : 'none' }} />
            <span className="font-bold text-base" style={{ letterSpacing: '-0.02em' }}>Kalidash</span>
          </div>
          
          <nav style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <a href="#" className="nav-link">
              <LayoutDashboard size={18} className="nav-icon" strokeWidth={2} /> Dashboard
            </a>
            <a href="#" className={`nav-link ${currentRoute === 'crm' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setCurrentRoute('crm'); }}>
              <Kanban size={18} className="nav-icon" strokeWidth={2.5} /> Oportunidades
            </a>
            <a href="#" className="nav-link">
              <Users size={18} className="nav-icon" strokeWidth={2} /> Pessoas & Empresas
            </a>
            <a href="#" className={`nav-link ${currentRoute === 'emails' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setCurrentRoute('emails'); }}>
              <Mail size={18} className="nav-icon" strokeWidth={2} /> Automações de E-mail
            </a>

            <div style={{ marginTop: 'auto', paddingBottom: '24px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <a href="#" className="nav-link" onClick={toggleTheme}>
                {isDarkMode ? (
                  <><Sun size={18} className="nav-icon" strokeWidth={2} /> Light Mode</>
                ) : (
                  <><Moon size={18} className="nav-icon" strokeWidth={2} /> Dark Mode</>
                )}
              </a>
              <a href="#" className="nav-link" onClick={(e) => { e.preventDefault(); setIsSettingsOpen(true); setIsMobileMenuOpen(false); }}>
                <Settings size={18} className="nav-icon" strokeWidth={2} /> Configurações
              </a>
            </div>
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="main-content" style={{ background: 'var(--bg-app)' }}>
          {currentRoute === 'crm' && (
            <header className="header animate-header" style={{ padding: '32px 40px', borderBottom: 'none', position: 'relative', zIndex: 50 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
              <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)}>
                <Menu size={24} />
              </button>
              
              {/* Context Selector */}
              <button 
                onClick={() => setIsContextSelectorOpen(!isContextSelectorOpen)}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', 
                  border: 'none', cursor: 'pointer', padding: '4px 8px', marginLeft: '-8px',
                  borderRadius: '6px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <FolderGit2 size={18} className="text-muted" />
                <span className="text-base font-bold">{selectedContext}</span>
                <ChevronDown size={16} className="text-muted" />
              </button>

              {/* Context Dropdown Modal */}
              {isContextSelectorOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 100 }} onClick={() => setIsContextSelectorOpen(false)} />
                  <div style={{ 
                    position: 'absolute', top: '44px', left: '36px', width: '280px', 
                    background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', 
                    borderRadius: '12px', boxShadow: 'var(--shadow-modal)', zIndex: 101,
                    display: 'flex', flexDirection: 'column', padding: '8px'
                  }}>
                    <button 
                      style={{ padding: '8px 12px', textAlign: 'left', background: 'transparent', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      onClick={() => { setSelectedContext('Visão Geral'); setIsContextSelectorOpen(false); }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Globe size={16} className="text-muted" />
                        <span className="font-medium text-sm" style={{ color: selectedContext === 'Visão Geral' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>Visão Geral (Todas)</span>
                      </div>
                      {selectedContext === 'Visão Geral' && <Check size={14} className="text-primary" />}
                    </button>

                    <div style={{ margin: '8px 0', borderTop: '1px solid var(--border-subtle)' }} />
                    <div style={{ padding: '4px 12px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>
                      Suas Pipelines
                    </div>
                    
                    {pipelines.map(pipe => (
                      <button 
                        key={pipe}
                        style={{ padding: '8px 12px', textAlign: 'left', background: 'transparent', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface-hover)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        onClick={() => { setSelectedContext(pipe); setIsContextSelectorOpen(false); }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="font-medium text-sm" style={{ color: selectedContext === pipe ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{pipe}</span>
                        </div>
                        {selectedContext === pipe && <Check size={14} className="text-primary" />}
                      </button>
                    ))}

                    <div style={{ margin: '8px 0', borderTop: '1px solid var(--border-subtle)' }} />
                    
                    <button 
                      onClick={() => { setCurrentRoute('new-pipeline'); setIsContextSelectorOpen(false); }}
                      style={{ padding: '8px 12px', textAlign: 'left', background: 'transparent', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <Plus size={16} className="text-muted" />
                      <span className="font-medium text-sm text-secondary">Criar nova Pipeline</span>
                    </button>
                  </div>
                </>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div className="view-toggle" style={{ display: 'flex' }}>
                <button className={`view-toggle-btn ${viewMode === 'kanban' ? 'active' : ''}`} onClick={() => setViewMode('kanban')}>
                  <Kanban size={14} /> <span className="hide-on-mobile">Kanban</span>
                </button>
                <button className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`} onClick={() => setViewMode('table')}>
                  <LayoutList size={14} /> <span className="hide-on-mobile">Lista</span>
                </button>
              </div>
              <button className="btn-primary" onClick={() => {
                fetch('http://localhost:8080/api/leads', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    title: 'Nova Oportunidade', 
                    value: 1500, 
                    stage: 'INBOUND', 
                    tags: ['Novo'],
                    pipeline: selectedContext === 'Visão Geral' ? 'Q4 Sales Pipeline' : selectedContext
                  })
                }).then(res => res.json()).then(newOpp => setOpportunities([newOpp, ...opportunities]));
              }}>
                <Plus size={16} strokeWidth={3} /> <span className="hide-on-mobile" style={{ marginLeft: '4px' }}>Nova Oportunidade</span>
              </button>
            </div>
          </header>
          )}

          {currentRoute === 'crm' && (
            viewMode === 'kanban' ? (
            <div className="board animate-board">
              
              {/* Column 1: Entrada / INBOUND */}
              <div className="column" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, 'INBOUND')}>
                <div className="column-header" style={{ '--pipe-color': 'var(--pipe-triage)' } as React.CSSProperties}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CircleDashed size={16} color="var(--pipe-triage)" strokeWidth={2.5} />
                      <span className="text-sm font-semibold">Entrada</span>
                      <span className="tag" style={{ marginLeft: '4px', border: 'none', background: 'var(--bg-app)' }}>
                        {filteredOpportunities.filter(o => o.stage === 'INBOUND').length}
                      </span>
                    </div>
                    <MoreHorizontal size={16} className="text-muted" />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                    <span className="text-xs text-muted">Aguardando contato</span>
                    <span className="text-xs font-semibold">{formatCurrency(totalValue('INBOUND'))}</span>
                  </div>
                </div>
                {filteredOpportunities.filter(o => o.stage === 'INBOUND').map(opp => renderCard(opp))}
              </div>

              {/* Column 2: Progress / QUALIFICATION */}
              <div className="column" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, 'QUALIFICATION')}>
                <div className="column-header" style={{ '--pipe-color': 'var(--pipe-progress)' } as React.CSSProperties}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CircleDot size={16} color="var(--pipe-progress)" strokeWidth={2.5} />
                      <span className="text-sm font-semibold">Qualificação</span>
                      <span className="tag" style={{ marginLeft: '4px', border: 'none', background: 'var(--bg-app)' }}>
                        {opportunities.filter(o => o.stage === 'QUALIFICATION').length}
                      </span>
                    </div>
                    <MoreHorizontal size={16} className="text-muted" />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                    <span className="text-xs text-muted">Avançando</span>
                    <span className="text-xs font-semibold">{formatCurrency(totalValue('QUALIFICATION'))}</span>
                  </div>
                </div>
                {filteredOpportunities.filter(o => o.stage === 'QUALIFICATION').map(opp => renderCard(opp))}
              </div>

              {/* Column 3: Won / WON */}
              <div className="column" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, 'WON')}>
                <div className="column-header" style={{ '--pipe-color': 'var(--pipe-won)' } as React.CSSProperties}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={16} color="var(--pipe-won)" strokeWidth={2.5} />
                      <span className="text-sm font-semibold">Ganho</span>
                      <span className="tag" style={{ marginLeft: '4px', border: 'none', background: 'var(--bg-app)' }}>
                        {filteredOpportunities.filter(o => o.stage === 'WON').length}
                      </span>
                    </div>
                    <MoreHorizontal size={16} className="text-muted" />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                    <span className="text-xs text-muted">Contratos assinados</span>
                    <span className="text-xs font-semibold">{formatCurrency(totalValue('WON'))}</span>
                  </div>
                </div>
                {filteredOpportunities.filter(o => o.stage === 'WON').map(opp => renderCard(opp))}
              </div>

            </div>
          ) : (
            <div className="table-container animate-board" style={{ padding: '0 32px 32px 32px' }}>
              <div className="data-table-wrapper" style={{ background: 'var(--bg-surface)' }}>
                {/* Stripe-style Table Header / Filters */}
                <div style={{ padding: '16px 16px 0 16px', borderBottom: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-app)', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', flex: 1, maxWidth: '300px' }}>
                      <Search size={14} className="text-muted" />
                      <input type="text" placeholder="Pesquisar por nome, e-mail, etc." style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', width: '100%' }} />
                    </div>
                    <button style={{ background: 'transparent', border: '1px solid var(--border-subtle)', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Filter size={14} /> Filtro
                    </button>
                  </div>
                </div>

                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Oportunidade</th>
                      <th>Cliente (Pessoa / Empresa)</th>
                      <th>Estágio</th>
                      <th>Tags</th>
                      <th>Valor</th>
                      <th style={{ width: '48px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {opportunities.map(opp => (
                      <tr key={opp.id} onClick={() => setSelectedOpp(opp)} style={{ cursor: 'pointer' }}>
                        <td>
                          <div className="font-semibold">{opp.title}</div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {opp.contactAvatar ? (
                              <img src={opp.contactAvatar} alt="" style={{ width: '20px', height: '20px', borderRadius: '50%' }} />
                            ) : (
                              <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--bg-surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={10} color="var(--text-muted)" /></div>
                            )}
                            <div>
                              <div className="text-sm font-medium">{opp.contactName || 'Sem contato'}</div>
                              {opp.companyName && <div className="text-xs text-muted">{opp.companyName}</div>}
                            </div>
                          </div>
                        </td>
                        <td>
                          {opp.stage === 'INBOUND' && (
                            <span className="tag" style={{ color: 'var(--pipe-triage)', borderColor: 'var(--pipe-triage)', background: 'transparent', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <CircleDashed size={12} /> Entrada
                            </span>
                          )}
                          {opp.stage === 'QUALIFICATION' && (
                            <span className="tag" style={{ color: 'var(--pipe-progress)', borderColor: 'var(--pipe-progress)', background: 'transparent', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <CircleDot size={12} /> Qualificação
                            </span>
                          )}
                          {opp.stage === 'WON' && (
                            <span className="tag" style={{ color: 'var(--pipe-won)', borderColor: 'var(--pipe-won)', background: 'transparent', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <CheckCircle2 size={12} /> Ganho
                            </span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {opp.tags && opp.tags.map(t => <span key={t} className="tag">{t}</span>)}
                          </div>
                        </td>
                        <td className="font-medium">{formatCurrency(opp.value)}</td>
                        <td>
                          <button style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}>
                            <MoreHorizontal size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredOpportunities.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '48px 0' }}>
                          Nenhuma oportunidade encontrada nesta pipeline. Clique em "Nova Oportunidade" para começar.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          
          {/* Rota de Emails */}
          {currentRoute === 'emails' && (
            <Emails />
          )}

          {/* Rota de Criação de Pipeline */}
          {currentRoute === 'new-pipeline' && (
            <PipelineBuilder onBack={() => setCurrentRoute('crm')} />
          )}

        </main>
      </div>
      
      {isSettingsOpen && (
        <div className="modal-overlay" onClick={() => setIsSettingsOpen(false)}>
          {/* Modal continua o mesmo */}
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="settings-sidebar">
              <div className="settings-group-title">Conta</div>
              <a href="#" className={`nav-link ${activeSettingsTab === 'account' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveSettingsTab('account'); }}><User size={16} className="nav-icon" /> Meu Perfil</a>
              <div className="settings-group-title" style={{ marginTop: '16px' }}>Workspace</div>
              <a href="#" className={`nav-link ${activeSettingsTab === 'team' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveSettingsTab('team'); }}><Users size={16} className="nav-icon" /> Equipe e Acessos</a>
              <a href="#" className={`nav-link ${activeSettingsTab === 'api' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveSettingsTab('api'); }}><Globe size={16} className="nav-icon" /> Integrações (API)</a>
            </div>

            <div className="settings-main">
              <button className="modal-close-btn" onClick={() => setIsSettingsOpen(false)}>
                <X size={20} />
              </button>
              {activeSettingsTab === 'team' && (
                <div>
                  <h2 className="text-base font-bold" style={{ marginBottom: '4px' }}>Equipe e Acessos</h2>
                  <p className="text-sm text-muted" style={{ marginBottom: '32px' }}>Gerencie os membros da equipe e os níveis de permissão.</p>
                  <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <img src="https://lh3.googleusercontent.com/a/ACg8ocKw5q5uP_a2q_H-h1P82q1J2yL7w82y2H3q1H2q2q1H=s96-c" alt="Carol" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                        <div><div className="text-sm font-semibold">Carol Sales (Você)</div><div className="text-xs text-muted">carol@agenciatzolkin.com</div></div>
                      </div>
                      <span className="tag" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none' }}>Administrador</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL GIGANTE para Detalhes da Oportunidade (Estilo Configurações/Notion) */}
      {selectedOpp && (
        <div className="modal-overlay" onClick={() => setSelectedOpp(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            
            {/* Left Sidebar do Modal de Oportunidade */}
            <div className="settings-sidebar" style={{ background: 'var(--bg-app)', borderRight: 'none', padding: '32px 0' }}>
              <div style={{ padding: '0 24px 24px 24px', marginBottom: '16px' }}>
                
                {/* Title Edit */}
                {editingTitle ? (
                  <input 
                    autoFocus
                    value={tempTitle}
                    onChange={(e) => setTempTitle(e.target.value)}
                    onBlur={saveOpportunityEdit}
                    onKeyDown={(e) => e.key === 'Enter' && saveOpportunityEdit()}
                    style={{ width: '100%', fontSize: '20px', fontWeight: 'bold', padding: '4px', borderRadius: '4px', border: '1px solid var(--border-focus)', background: 'var(--bg-surface)', color: 'var(--text-primary)', boxShadow: 'var(--shadow-sm)' }}
                  />
                ) : (
                  <h2 
                    className="font-bold text-xl leading-tight" 
                    style={{ cursor: 'pointer', padding: '4px', marginLeft: '-4px', borderRadius: '4px', transition: 'background 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    onClick={() => { setTempTitle(selectedOpp.title); setEditingTitle(true); }}
                    title="Clique para editar"
                  >
                    {selectedOpp.title}
                  </h2>
                )}

                {/* Value Edit */}
                {editingValue ? (
                  <input 
                    autoFocus
                    value={tempValue}
                    onChange={(e) => setTempValue(e.target.value)}
                    onBlur={saveOpportunityEdit}
                    onKeyDown={(e) => e.key === 'Enter' && saveOpportunityEdit()}
                    placeholder="Ex: 5000,00"
                    style={{ width: '100%', fontSize: '24px', fontWeight: 'bold', marginTop: '8px', padding: '4px', borderRadius: '4px', border: '1px solid var(--border-focus)', background: 'var(--bg-surface)', color: 'var(--text-primary)', boxShadow: 'var(--shadow-sm)' }}
                  />
                ) : (
                  <div 
                    className="text-2xl font-bold mt-2" 
                    style={{ color: 'var(--text-primary)', cursor: 'pointer', padding: '4px', marginLeft: '-4px', borderRadius: '4px', transition: 'background 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    onClick={() => { setTempValue(selectedOpp.value.toString()); setEditingValue(true); }}
                    title="Clique para editar"
                  >
                    {formatCurrency(selectedOpp.value)}
                  </div>
                )}
                
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
                  <span className="tag" style={{ border: `1px solid var(--pipe-${selectedOpp.stage.toLowerCase() === 'won' ? 'won' : selectedOpp.stage.toLowerCase() === 'qualification' ? 'progress' : 'triage'})` }}>
                    {selectedOpp.stage}
                  </span>
                  <span className="tag">{selectedOpp.priority}</span>
                </div>
              </div>

              <div className="nav-link" style={{ padding: '12px 24px', marginBottom: '8px', cursor: 'default', background: 'transparent' }}>
                <span className="text-xs font-bold text-muted uppercase tracking-wider">Ações</span>
              </div>
              <a href="#" className={`nav-link ${activeTab === 'overview' ? 'active' : ''}`} style={{ margin: '0 16px' }} onClick={(e) => { e.preventDefault(); setActiveTab('overview'); }}><Activity size={16} className="nav-icon" /> Visão Geral</a>
              <a href="#" className={`nav-link ${activeTab === 'notes' ? 'active' : ''}`} style={{ margin: '0 16px' }} onClick={(e) => { e.preventDefault(); setActiveTab('notes'); }}><FileText size={16} className="nav-icon" /> Anotações</a>
              <a href="#" className={`nav-link ${activeTab === 'tasks' ? 'active' : ''}`} style={{ margin: '0 16px' }} onClick={(e) => { e.preventDefault(); setActiveTab('tasks'); }}><CheckSquare size={16} className="nav-icon" /> Tarefas</a>
              <a href="#" className={`nav-link ${activeTab === 'emails' ? 'active' : ''}`} style={{ margin: '0 16px' }} onClick={(e) => { e.preventDefault(); setActiveTab('emails'); }}><MessageSquare size={16} className="nav-icon" /> E-mails</a>
            </div>

            {/* Right Main Content */}
            <div className="settings-main" style={{ display: 'flex', flexDirection: 'column', padding: '40px 60px', overflowY: 'auto' }}>
              <button className="modal-close-btn" style={{ top: '24px', right: '24px', boxShadow: 'var(--shadow-sm)', background: 'var(--bg-surface)' }} onClick={() => { setSelectedOpp(null); setActiveTab('overview'); }}>
                <X size={20} />
              </button>

              {activeTab === 'overview' && (
                <>
                  <h2 className="text-xl font-bold mb-6">Visão Geral</h2>
                  
                  {/* Raio-X */}
              <div style={{ background: 'var(--bg-surface)', padding: '24px', borderRadius: '8px', boxShadow: 'var(--shadow-md)', marginBottom: '32px' }}>
                <div style={{ display: 'flex', gap: '32px' }}>
                  {/* Contato */}
                  <div style={{ flex: 1 }}>
                    <div className="text-xs font-semibold text-muted mb-3 uppercase" style={{ letterSpacing: '0.05em' }}>Contato Principal</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      {selectedOpp.contactAvatar ? (
                        <img src={selectedOpp.contactAvatar} alt="" style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px solid var(--border-subtle)' }} />
                      ) : (
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--bg-surface)', border: '2px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <User size={24} color="var(--text-muted)" />
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-base">{selectedOpp.contactName || 'Sem Contato'}</div>
                        <div className="text-sm text-muted" style={{ marginTop: '2px' }}>Ver ficha completa &rarr;</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ width: '1px', background: 'var(--border-subtle)' }}></div>

                  {/* Owner */}
                  <div style={{ flex: 1 }}>
                    <div className="text-xs font-semibold text-muted mb-3 uppercase" style={{ letterSpacing: '0.05em' }}>Dono da Oportunidade</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      {selectedOpp.ownerAvatar ? (
                        <img src={selectedOpp.ownerAvatar} alt="" style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px solid var(--border-subtle)' }} />
                      ) : (
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--bg-surface)', border: '2px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <User size={24} color="var(--text-muted)" />
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-base">{selectedOpp.ownerName || 'Não Atribuído'}</div>
                        <div className="text-sm text-muted" style={{ marginTop: '2px' }}>Equipe Kalidash</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Timeline (Input + Historico) */}
              <div style={{ flex: 1 }}>
                 <h3 className="font-semibold text-sm mb-4 uppercase text-muted" style={{ letterSpacing: '0.05em' }}>Timeline de Atividades</h3>
                 
                 {/* Input Box */}
                 <div style={{ background: 'var(--bg-surface)', borderRadius: '8px', boxShadow: 'var(--shadow-md)', padding: '16px', marginBottom: '32px' }}>
                    <textarea 
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder={noteType === 'EMAIL' ? "Rascunho ou log de e-mail..." : noteType === 'CALL' ? "Resumo da ligação..." : "Adicione uma anotação sobre a negociação..."}
                      style={{ width: '100%', minHeight: '80px', background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontSize: '14px', color: 'var(--text-primary)' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                       <div style={{ display: 'flex', gap: '8px' }}>
                         <button onClick={() => setNoteType('NOTE')} className="tag" style={{ border: 'none', background: noteType === 'NOTE' ? 'var(--bg-app)' : 'transparent', cursor: 'pointer', fontWeight: noteType === 'NOTE' ? 600 : 500 }}><FileText size={14}/> Anotação</button>
                         <button onClick={() => setNoteType('CALL')} className="tag" style={{ border: 'none', background: noteType === 'CALL' ? 'var(--bg-app)' : 'transparent', cursor: 'pointer', fontWeight: noteType === 'CALL' ? 600 : 500 }}><Phone size={14}/> Ligação</button>
                         <button onClick={() => setNoteType('EMAIL')} className="tag" style={{ border: 'none', background: noteType === 'EMAIL' ? 'var(--bg-app)' : 'transparent', cursor: 'pointer', fontWeight: noteType === 'EMAIL' ? 600 : 500 }}><Mail size={14}/> E-mail</button>
                       </div>
                       <button className="btn-primary" onClick={handleAddNote} disabled={!newNote.trim()}>
                         Salvar
                         <Send size={16} />
                       </button>
                    </div>
                 </div>

                 {/* Lista de Atividades */}
                 <div style={{ borderLeft: '2px solid var(--border-subtle)', marginLeft: '16px', paddingLeft: '32px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    
                    {notes.map(note => (
                      <div key={note.id} style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '-42px', top: '2px', width: '18px', height: '18px', borderRadius: '50%', background: note.type === 'CALL' ? 'var(--pipe-progress)' : note.type === 'EMAIL' ? 'var(--pipe-triage)' : 'var(--border-focus)', border: '4px solid var(--bg-surface)' }}></div>
                        <div className="text-xs text-muted mb-1">
                          {new Date(note.created_at).toLocaleString('pt-BR')} 
                          {note.authorName && ` • por ${note.authorName}`}
                        </div>
                        <div className="font-medium text-base">
                          {note.type === 'CALL' ? 'Ligação Registrada' : note.type === 'EMAIL' ? 'E-mail Enviado' : 'Anotação'}
                        </div>
                        <div className="text-sm text-muted mt-1" style={{ whiteSpace: 'pre-wrap' }}>{note.content}</div>
                      </div>
                    ))}

                    <div style={{ position: 'relative' }}>
                      <div style={{ position: 'absolute', left: '-42px', top: '2px', width: '18px', height: '18px', borderRadius: '50%', background: 'var(--border-subtle)', border: '4px solid var(--bg-surface)' }}></div>
                      <div className="text-xs text-muted mb-1">Criação do Negócio</div>
                      <div className="font-medium text-base">Oportunidade Criada</div>
                      <div className="text-sm text-muted mt-1">Negociação iniciada via Dashboard.</div>
                    </div>

                 </div>
              </div>

              {/* Footer Actions Gigantes */}
              <div style={{ marginTop: '40px', paddingTop: '24px', display: 'flex', gap: '16px' }}>
                 <button className="btn-won" style={{ padding: '16px', fontSize: '18px', boxShadow: 'var(--shadow-md)', border: 'none' }} onClick={() => {
                   fetch('http://localhost:8080/api/leads/move', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lead_id: selectedOpp.id, column_id: 'WON' }) });
                   setOpportunities(prev => prev.map(o => o.id === selectedOpp.id ? { ...o, stage: 'WON' } : o));
                   setSelectedOpp(null);
                 }}>MARCAR COMO GANHO</button>
                 <button className="btn-lost" style={{ padding: '16px', fontSize: '18px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>MARCAR COMO PERDIDO</button>
              </div>
              </>
              )}

              {activeTab === 'notes' && (
                <div>
                  <h2 className="text-xl font-bold mb-6">Anotações</h2>
                  <p className="text-muted">Mostre apenas as anotações do sistema aqui.</p>
                </div>
              )}
              {activeTab === 'tasks' && (
                <div>
                  <h2 className="text-xl font-bold mb-6">Tarefas Pendentes</h2>
                  <p className="text-muted">Adicione agendamentos de reuniões e lembretes aqui.</p>
                </div>
              )}
              {activeTab === 'emails' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h2 className="text-xl font-bold">Central de E-mails</h2>
                    <button className="btn-primary" style={{ padding: '8px 16px', fontSize: '14px', boxShadow: 'var(--shadow-sm)' }}>
                      Ir para Caixa de Entrada <Send size={14} style={{ marginLeft: '8px' }}/>
                    </button>
                  </div>
                  
                  <div style={{ background: 'var(--bg-surface)', borderRadius: '8px', boxShadow: 'var(--shadow-md)', padding: '24px', textAlign: 'center', marginBottom: '32px' }}>
                    <Mail size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 16px auto' }} />
                    <h3 className="text-lg font-bold mb-2">Editor de E-mails Avançado</h3>
                    <p className="text-muted text-sm max-w-md mx-auto" style={{ maxWidth: '400px' }}>
                      Para criar campanhas, templates e e-mails personalizados com drag and drop (usando o Tiptap HTML Builder), acesse a página completa de E-mails.
                    </p>
                  </div>

                  <h3 className="font-bold text-sm text-muted mb-4 uppercase tracking-wider">Histórico de E-mails</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {notes.filter(n => n.type === 'EMAIL').length === 0 ? (
                      <p className="text-muted text-sm">Nenhum e-mail enviado para este lead ainda.</p>
                    ) : (
                      notes.filter(n => n.type === 'EMAIL').map(note => (
                        <div key={note.id} style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: '8px', boxShadow: 'var(--shadow-sm)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span className="font-bold text-sm" style={{ color: '#3b82f6' }}>E-mail Enviado</span>
                            <span className="text-xs text-muted">{new Date(note.created_at).toLocaleString('pt-BR')}</span>
                          </div>
                          <div className="text-sm" style={{ whiteSpace: 'pre-wrap' }}>{note.content}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
