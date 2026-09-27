import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Mail,
  Search,
  Filter,
  ChevronDown,
  FolderGit2,
  Check
} from 'lucide-react';
import Emails from './Emails';
import PipelineBuilder from './PipelineBuilder';
import type { Opportunity } from './types';
import { API_URL } from './lib/api';
import { formatCurrency } from './lib/format';
import { SYSTEM_COLUMNS, customColumnsFrom, resolveColumns } from './lib/columns';
import { useViewSettings } from './lib/viewSettings';
import ColumnPicker from './components/ColumnPicker';
import OpportunityDetail from './components/OpportunityDetail';
import OpportunityPeek from './components/OpportunityPeek';
import ViewSettingsPopover from './components/ViewSettingsPopover';

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

  // Configuração de visualização (salva no navegador) e modo de edição de colunas
  const { settings, update: updateSettings, reset: resetSettings } = useViewSettings();
  const [editColumns, setEditColumns] = useState(false);

  // Carrega os dados da API Go
  useEffect(() => {
    fetch(`${API_URL}/api/leads`) // A rota Go ainda atende aqui
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

  // Move uma oportunidade de etapa (arrastar no Kanban ou "Marcar como ganho" na ficha)
  const moveOpportunity = (oppId: string, stageId: string) => {
    // Atualização Otimista no Frontend
    setOpportunities(prev => prev.map(o => o.id === oppId ? { ...o, stage: stageId } : o));
    setSelectedOpp(prev => (prev && prev.id === oppId ? { ...prev, stage: stageId } : prev));

    // Persiste no Backend Go
    fetch(`${API_URL}/api/leads/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: oppId, column_id: stageId })
    }).catch(err => console.error("Falha ao mover oportunidade:", err));
  };

  // A ficha salvou título ou valor
  const handleOpportunityChange = (updated: Opportunity) => {
    setOpportunities(prev => prev.map(o => o.id === updated.id ? updated : o));
    setSelectedOpp(updated);
  };

  const closePeek = useCallback(() => setSelectedOpp(null), []);

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
    moveOpportunity(oppId, stageId);
  };

  const filteredOpportunities = selectedContext === 'Visão Geral'
    ? opportunities
    : opportunities.filter(opp => (opp.pipeline || 'Q4 Sales Pipeline') === selectedContext);

  const totalValue = (stageId: string) =>
    filteredOpportunities.filter(o => o.stage === stageId).reduce((acc, curr) => acc + (curr.value || 0), 0);

  // Colunas da Lista: as do sistema mais uma por chave de `customData` (jsonb) encontrada
  const allColumns = useMemo(() => [...SYSTEM_COLUMNS, ...customColumnsFrom(opportunities)], [opportunities]);
  const visibleColumns = useMemo(() => resolveColumns(allColumns, settings.columns), [allColumns, settings.columns]);
  const hiddenColumns = useMemo(() => {
    const visible = new Set(visibleColumns.map(c => c.id));
    return allColumns.filter(c => !visible.has(c.id));
  }, [allColumns, visibleColumns]);
  const detailProperties = useMemo(() => visibleColumns.filter(c => c.id !== 'title' && c.id !== 'value'), [visibleColumns]);

  const addColumn = (id: string) => updateSettings({ columns: [...settings.columns.filter(c => c !== id), id] });
  const removeColumn = (id: string) => updateSettings({ columns: settings.columns.filter(c => c !== id) });

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
        <main className={`main-content${currentRoute === 'crm' ? ` crm-scope crm-fs-${settings.fontSize}` : ''}`} style={{ background: 'var(--bg-app)' }}>
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
              <ViewSettingsPopover
                settings={settings}
                onChange={updateSettings}
                onReset={() => { resetSettings(); setEditColumns(false); }}
                view={viewMode}
                editColumns={editColumns}
                onToggleEditColumns={() => setEditColumns(v => !v)}
              />
              <div className="view-toggle" style={{ display: 'flex' }}>
                <button className={`view-toggle-btn ${viewMode === 'kanban' ? 'active' : ''}`} onClick={() => { setViewMode('kanban'); setEditColumns(false); }}>
                  <Kanban size={14} /> <span className="hide-on-mobile">Kanban</span>
                </button>
                <button className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`} onClick={() => setViewMode('table')}>
                  <LayoutList size={14} /> <span className="hide-on-mobile">Lista</span>
                </button>
              </div>
              <button className="btn-primary" onClick={() => {
                fetch(`${API_URL}/api/leads`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    title: 'Nova Oportunidade',
                    value: 1500,
                    stage: 'INBOUND',
                    tags: ['Novo'],
                    pipeline: selectedContext === 'Visão Geral' ? 'Q4 Sales Pipeline' : selectedContext
                  })
                }).then(res => res.json()).then(newOpp => setOpportunities(prev => [newOpp, ...prev]));
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
                        {filteredOpportunities.filter(o => o.stage === 'QUALIFICATION').length}
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
              <div className={`data-table-wrapper ${editColumns ? 'editing' : ''}`} style={{ background: 'var(--bg-surface)' }}>
                {/* Stripe-style Table Header / Filters */}
                <div style={{ padding: '16px 16px 0 16px', borderBottom: 'none' }}>
                  <div className="table-toolbar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-app)', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', flex: 1, maxWidth: '300px' }}>
                      <Search size={14} className="text-muted" />
                      <input type="text" placeholder="Pesquisar por nome, e-mail, etc." style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', width: '100%' }} />
                    </div>
                    <button style={{ background: 'transparent', border: '1px solid var(--border-subtle)', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Filter size={14} /> Filtro
                    </button>
                    {editColumns && (
                      <>
                        <ColumnPicker hidden={hiddenColumns} onAdd={addColumn} />
                        <button type="button" className="colpicker-done" onClick={() => setEditColumns(false)}>Concluir</button>
                      </>
                    )}
                  </div>
                  {editColumns && (
                    <div className="table-edit-banner">
                      Modo de edição de colunas: remova com o × do cabeçalho e adicione em "Adicionar coluna". A escolha fica salva neste navegador.
                    </div>
                  )}
                </div>

                <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      {visibleColumns.map(col => (
                        <th key={col.id}>
                          {col.label}
                          {editColumns && col.removable && (
                            <button type="button" className="th-remove" onClick={() => removeColumn(col.id)} title={`Remover a coluna ${col.label}`} aria-label={`Remover a coluna ${col.label}`}>
                              <X size={12} />
                            </button>
                          )}
                        </th>
                      ))}
                      <th style={{ width: '48px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOpportunities.map(opp => (
                      <tr key={opp.id} onClick={() => setSelectedOpp(opp)} className={selectedOpp?.id === opp.id ? 'selected' : undefined} style={{ cursor: 'pointer' }}>
                        {visibleColumns.map(col => (
                          <td key={col.id}>{col.render(opp)}</td>
                        ))}
                        <td>
                          <button style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}>
                            <MoreHorizontal size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredOpportunities.length === 0 && (
                      <tr>
                        <td colSpan={visibleColumns.length + 1} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '48px 0' }}>
                          Nenhuma oportunidade encontrada nesta pipeline. Clique em "Nova Oportunidade" para começar.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                </div>
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

      {/* Ficha da oportunidade: painel lateral ou popup central, conforme a configuração da visualização */}
      {selectedOpp && (
        <OpportunityPeek mode={settings.openMode} fontSize={settings.fontSize} onClose={closePeek}>
          <OpportunityDetail
            key={selectedOpp.id}
            opp={selectedOpp}
            variant={settings.openMode}
            onClose={closePeek}
            onChange={handleOpportunityChange}
            onMove={moveOpportunity}
            onSwitchMode={() => updateSettings({ openMode: settings.openMode === 'side' ? 'center' : 'side' })}
            properties={detailProperties}
            hiddenColumns={hiddenColumns}
            editColumns={editColumns}
            onHideColumn={removeColumn}
            onAddColumn={addColumn}
            onToggleEditColumns={() => setEditColumns(v => !v)}
          />
        </OpportunityPeek>
      )}

    </div>
  );
}
