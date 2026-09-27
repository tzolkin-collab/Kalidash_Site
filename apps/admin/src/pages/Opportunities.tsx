import React, { useCallback, useMemo, useState } from 'react';
import {
  Check, CheckCircle2, ChevronDown, CircleDashed, CircleDot, Filter, FolderGit2, Globe, Kanban, LayoutList,
  Menu, MoreHorizontal, PhoneCall, Plus, Settings, User, Users, X,
} from 'lucide-react';
import type { Lead } from '../domain';
import type { Opportunity } from '../types';
import { API_URL } from '../lib/api';
import { formatCurrency } from '../lib/format';
import { SYSTEM_COLUMNS, customColumnsFrom, resolveColumns } from '../lib/columns';
import { useViewSettings } from '../lib/viewSettings';
import { useOpportunities } from '../lib/useOpportunities';
import { usePaged } from '../lib/usePaged';
import { useShell } from '../lib/shell';
import { useStore } from '../lib/store';
import { leadsStore } from '../mocks/leads';
import { pipelinesStore } from '../mocks/pipelines';
import ColumnPicker from '../components/ColumnPicker';
import OpportunityDetail from '../components/OpportunityDetail';
import OpportunityPeek from '../components/OpportunityPeek';
import ViewSettingsPopover from '../components/ViewSettingsPopover';
import { Badge, EmptyState, Pagination, SearchBox } from '../components/ui';

const ALL = 'Visão Geral';

const KANBAN_COLUMNS = [
  { id: 'INBOUND', title: 'Entrada', hint: 'Aguardando contato', Icon: CircleDashed, color: 'var(--pipe-triage)' },
  { id: 'QUALIFICATION', title: 'Qualificação', hint: 'Avançando', Icon: CircleDot, color: 'var(--pipe-progress)' },
  { id: 'WON', title: 'Ganho', hint: 'Contratos assinados', Icon: CheckCircle2, color: 'var(--pipe-won)' },
];

const LEAD_COLUMNS = [
  { key: 'novos', title: 'Novos', hint: 'Ainda sem contato' },
  { key: 'contato', title: 'Em contato', hint: 'Sendo qualificados' },
];

const STAGE_FILTERS = [{ id: '', label: 'Todos os estágios' }, ...KANBAN_COLUMNS.map((c) => ({ id: c.id, label: c.title }))];

/** Lead exibido como uma linha da lista, ao lado das oportunidades. */
const leadAsRow = (l: Lead, stageName: string): Opportunity => ({
  id: l.id, title: l.name, value: 0, stage: stageName, priority: '', tags: l.tags, isLead: true,
  contactName: l.origin === 'INBOUND' ? l.sourceName : `Trouxe: ${l.sourceName}`,
});

export default function Opportunities() {
  const { openMenu, navigate } = useShell();
  const { opportunities, setOpportunities, loading, error } = useOpportunities();
  const [pipelines] = useStore(pipelinesStore);
  const [leads] = useStore(leadsStore);
  const defaultPipeline = pipelines[0]?.name ?? '';

  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('table');
  const [selectedContext, setSelectedContext] = useState(ALL);
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [search, setSearch] = useState('');
  const [showLeads, setShowLeads] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [stageFilter, setStageFilter] = useState('');

  const { settings, update: updateSettings, reset: resetSettings } = useViewSettings();
  const [editColumns, setEditColumns] = useState(false);

  const moveOpportunity = (oppId: string, stageId: string) => {
    setOpportunities((prev) => prev.map((o) => (o.id === oppId ? { ...o, stage: stageId } : o)));
    setSelectedOpp((prev) => (prev && prev.id === oppId ? { ...prev, stage: stageId } : prev));
    fetch(`${API_URL}/api/leads/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: oppId, column_id: stageId }),
    }).catch((err) => console.error('Falha ao mover oportunidade:', err));
  };

  const handleOpportunityChange = (updated: Opportunity) => {
    setOpportunities((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    setSelectedOpp(updated);
  };

  const closePeek = useCallback(() => setSelectedOpp(null), []);

  const createOpportunity = () => {
    fetch(`${API_URL}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Nova Oportunidade', value: 1500, stage: 'INBOUND', tags: ['Novo'],
        pipeline: selectedContext === ALL ? defaultPipeline : selectedContext,
      }),
    })
      .then((res) => res.json())
      .then((created: Opportunity) => setOpportunities((prev) => [created, ...prev]));
  };

  // Arrastar e soltar (Kanban)
  const handleDragStart = (e: React.DragEvent, oppId: string) => {
    e.dataTransfer.setData('oppId', oppId);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  const handleDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    const oppId = e.dataTransfer.getData('oppId');
    if (oppId) moveOpportunity(oppId, stageId);
  };

  const inContext = useCallback(
    (name: string | undefined) => selectedContext === ALL || (name || defaultPipeline) === selectedContext,
    [selectedContext, defaultPipeline],
  );

  const contextOpportunities = useMemo(() => opportunities.filter((o) => inContext(o.pipeline)), [opportunities, inContext]);

  // Busca e filtro valem para a Lista
  const visibleOpportunities = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contextOpportunities.filter((o) => {
      if (stageFilter && o.stage !== stageFilter) return false;
      if (!q) return true;
      return [o.title, o.contactName, o.companyName, ...(o.tags ?? [])].some((v) => v?.toLowerCase().includes(q));
    });
  }, [contextOpportunities, search, stageFilter]);

  const contextLeads = useMemo(
    () => leads.filter((l) => l.status === 'ACTIVE' && inContext(pipelines.find((p) => p.id === l.pipelineId)?.name)),
    [leads, pipelines, inContext],
  );

  const leadRows = useMemo(() => {
    if (!showLeads) return [];
    const q = search.trim().toLowerCase();
    return contextLeads
      .filter((l) => !stageFilter && (!q || [l.name, l.sourceName, ...l.tags].some((v) => v.toLowerCase().includes(q))))
      .map((l) => leadAsRow(l, l.stageId.endsWith(':contato') ? 'Em contato' : 'Novos'));
  }, [showLeads, contextLeads, search, stageFilter]);

  const tableRows = useMemo(() => [...leadRows, ...visibleOpportunities], [leadRows, visibleOpportunities]);
  const paged = usePaged(tableRows, 20);

  const totalValue = (stageId: string) =>
    contextOpportunities.filter((o) => o.stage === stageId).reduce((acc, curr) => acc + (curr.value || 0), 0);

  const allColumns = useMemo(() => [...SYSTEM_COLUMNS, ...customColumnsFrom(opportunities)], [opportunities]);
  const visibleColumns = useMemo(() => resolveColumns(allColumns, settings.columns), [allColumns, settings.columns]);
  const hiddenColumns = useMemo(() => {
    const visible = new Set(visibleColumns.map((c) => c.id));
    return allColumns.filter((c) => !visible.has(c.id));
  }, [allColumns, visibleColumns]);
  const detailProperties = useMemo(() => visibleColumns.filter((c) => c.id !== 'title' && c.id !== 'value'), [visibleColumns]);

  const addColumn = (id: string) => updateSettings({ columns: [...settings.columns.filter((c) => c !== id), id] });
  const removeColumn = (id: string) => updateSettings({ columns: settings.columns.filter((c) => c !== id) });

  const renderCard = (opp: Opportunity) => (
    <div key={opp.id} className="card" style={{ boxShadow: 'var(--shadow-sm)' }} draggable onDragStart={(e) => handleDragStart(e, opp.id)} onClick={() => setSelectedOpp(opp)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span className="text-sm font-semibold">{opp.title}</span>
        {opp.stage === 'INBOUND' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
            <PhoneCall size={12} />
            <span className="text-xs">Novo</span>
          </div>
        )}
      </div>
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
        <div style={{ display: 'flex', gap: '4px' }}>{opp.tags && opp.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div>
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

  const renderLeadCard = (l: Lead) => (
    <div key={l.id} className="card lead-card" onClick={() => navigate('/leads')} title="Abrir na página Leads">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', gap: '8px' }}>
        <span className="text-sm font-semibold">{l.name}</span>
        <Badge tone="accent">Lead</Badge>
      </div>
      <div className="text-xs text-muted" style={{ marginBottom: '8px' }}>
        {l.origin === 'INBOUND' ? l.sourceName : `Trouxe: ${l.sourceName}`}
      </div>
      <div className="tag-row">{l.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div>
    </div>
  );

  const stageColumn = (col: (typeof KANBAN_COLUMNS)[number]) => {
    const items = contextOpportunities.filter((o) => o.stage === col.id);
    return (
      <div key={col.id} className="column" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, col.id)}>
        <div className="column-header" style={{ '--pipe-color': col.color } as React.CSSProperties}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <col.Icon size={16} color={col.color} strokeWidth={2.5} />
              <span className="text-sm font-semibold">{col.title}</span>
              <span className="tag" style={{ marginLeft: '4px', border: 'none', background: 'var(--bg-app)' }}>{items.length}</span>
            </div>
            <MoreHorizontal size={16} className="text-muted" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
            <span className="text-xs text-muted">{col.hint}</span>
            <span className="text-xs font-semibold">{formatCurrency(totalValue(col.id))}</span>
          </div>
        </div>
        {items.map(renderCard)}
      </div>
    );
  };

  const toolbar = (
    <div className="table-toolbar opp-toolbar">
      <SearchBox value={search} onChange={setSearch} placeholder="Pesquisar por nome, contato, tag…" />
      <div className="colpicker">
        <button type="button" className={`btn ${stageFilter ? 'btn-active' : ''}`} onClick={() => setFilterOpen((v) => !v)} aria-expanded={filterOpen}>
          <Filter size={14} /> Filtro{stageFilter ? ' (1)' : ''}
        </button>
        {filterOpen && (
          <>
            <div className="click-catcher" onClick={() => setFilterOpen(false)} />
            <div className="colpicker-menu filter-menu" role="menu">
              <div className="colpicker-group">Estágio</div>
              {STAGE_FILTERS.map((s) => (
                <button key={s.id} type="button" role="menuitemradio" aria-checked={stageFilter === s.id} className="colpicker-item filter-item" onClick={() => { setStageFilter(s.id); setFilterOpen(false); }}>
                  {s.label}
                  {stageFilter === s.id && <Check size={14} />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <button type="button" className={`btn ${showLeads ? 'btn-active' : ''}`} onClick={() => setShowLeads((v) => !v)} aria-pressed={showLeads} title="Mostrar os leads junto das oportunidades">
        <Users size={14} /> Ver leads
        <span className="tab-count">{contextLeads.length}</span>
      </button>
      {viewMode === 'table' && editColumns && (
        <>
          <ColumnPicker hidden={hiddenColumns} onAdd={addColumn} />
          <button type="button" className="colpicker-done" onClick={() => setEditColumns(false)}>Concluir</button>
        </>
      )}
    </div>
  );

  return (
    <div className={`crm-scope crm-fs-${settings.fontSize} opp-page`}>
      <header className="header animate-header" style={{ padding: '32px 40px 16px', borderBottom: 'none', position: 'relative', zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
          <button className="mobile-menu-btn" onClick={openMenu} aria-label="Abrir menu"><Menu size={24} /></button>

          <button
            onClick={() => setIsContextOpen(!isContextOpen)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px', marginLeft: '-8px', borderRadius: '6px' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <FolderGit2 size={18} className="text-muted" />
            <span className="text-base font-bold">{selectedContext}</span>
            <ChevronDown size={16} className="text-muted" />
          </button>

          <button type="button" className="icon-btn bare" onClick={() => navigate('/oportunidades/pipelines')} title="Configurações das pipelines" aria-label="Configurações das pipelines">
            <Settings size={16} />
          </button>

          <span className="text-xs text-muted hide-on-mobile">
            {contextOpportunities.length} {contextOpportunities.length === 1 ? 'oportunidade' : 'oportunidades'}
            {showLeads && ` · ${contextLeads.length} ${contextLeads.length === 1 ? 'lead' : 'leads'}`}
          </span>

          {isContextOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 100 }} onClick={() => setIsContextOpen(false)} />
              <div style={{ position: 'absolute', top: '44px', left: '0', width: '280px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', boxShadow: 'var(--shadow-modal)', zIndex: 101, display: 'flex', flexDirection: 'column', padding: '8px' }}>
                <button className="ctx-item" onClick={() => { setSelectedContext(ALL); setIsContextOpen(false); }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Globe size={16} className="text-muted" />
                    <span className="font-medium text-sm">Visão Geral (Todas)</span>
                  </div>
                  {selectedContext === ALL && <Check size={14} />}
                </button>
                <div style={{ margin: '8px 0', borderTop: '1px solid var(--border-subtle)' }} />
                <div style={{ padding: '4px 12px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>Suas Pipelines</div>
                {pipelines.map((p) => (
                  <button key={p.id} className="ctx-item" onClick={() => { setSelectedContext(p.name); setIsContextOpen(false); }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                      <span className="font-medium text-sm">{p.name}</span>
                      <span className="text-xs text-muted">{p.offer}</span>
                    </div>
                    {selectedContext === p.name && <Check size={14} />}
                  </button>
                ))}
                <div style={{ margin: '8px 0', borderTop: '1px solid var(--border-subtle)' }} />
                <button className="ctx-item" onClick={() => navigate('/oportunidades/pipelines')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Settings size={16} className="text-muted" />
                    <span className="font-medium text-sm">Configurações das pipelines</span>
                  </div>
                </button>
                <button className="ctx-item" onClick={() => navigate('/oportunidades/pipelines/nova')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Plus size={16} className="text-muted" />
                    <span className="font-medium text-sm">Criar nova Pipeline</span>
                  </div>
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
            onToggleEditColumns={() => setEditColumns((v) => !v)}
          />
          <div className="view-toggle" style={{ display: 'flex' }}>
            <button className={`view-toggle-btn ${viewMode === 'kanban' ? 'active' : ''}`} onClick={() => { setViewMode('kanban'); setEditColumns(false); }}>
              <Kanban size={14} /> <span className="hide-on-mobile">Kanban</span>
            </button>
            <button className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`} onClick={() => setViewMode('table')}>
              <LayoutList size={14} /> <span className="hide-on-mobile">Lista</span>
            </button>
          </div>
          <button className="btn-primary" onClick={createOpportunity}>
            <Plus size={16} strokeWidth={3} /> <span className="hide-on-mobile" style={{ marginLeft: '4px' }}>Nova Oportunidade</span>
          </button>
        </div>
      </header>

      {error && <div className="opp-error" role="alert">{error}</div>}

      {viewMode === 'kanban' ? (
        <div className="animate-board opp-board-wrap">
          <div className="opp-toolbar-wrap">{toolbar}</div>
          <div className="board">
            {showLeads && LEAD_COLUMNS.map((col) => {
              const items = contextLeads.filter((l) => l.stageId.endsWith(`:${col.key}`) && (!search.trim() || [l.name, l.sourceName, ...l.tags].some((v) => v.toLowerCase().includes(search.trim().toLowerCase()))));
              return (
                <div key={col.key} className="column lead-column">
                  <div className="column-header" style={{ '--pipe-color': 'var(--border-focus)' } as React.CSSProperties}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Users size={16} className="text-muted" />
                      <span className="text-sm font-semibold">{col.title}</span>
                      <span className="tag" style={{ marginLeft: '4px', border: 'none', background: 'var(--bg-app)' }}>{items.length}</span>
                    </div>
                    <div className="text-xs text-muted" style={{ marginTop: '4px' }}>{col.hint} · leads não entram no valor</div>
                  </div>
                  {items.map(renderLeadCard)}
                </div>
              );
            })}
            {KANBAN_COLUMNS.map(stageColumn)}
          </div>
        </div>
      ) : (
        <div className="table-container animate-board" style={{ padding: '0 32px 32px 32px' }}>
          <div className={`data-table-wrapper ${editColumns ? 'editing' : ''}`} style={{ background: 'var(--bg-surface)' }}>
            <div style={{ padding: '16px 16px 0 16px' }}>
              {toolbar}
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
                    {visibleColumns.map((col) => (
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
                  {paged.rows.map((opp) => (
                    <tr
                      key={opp.id}
                      onClick={() => (opp.isLead ? navigate('/leads') : setSelectedOpp(opp))}
                      className={`${opp.isLead ? 'lead-row' : ''} ${selectedOpp?.id === opp.id ? 'selected' : ''}`}
                      style={{ cursor: 'pointer' }}
                    >
                      {visibleColumns.map((col) => (
                        <td key={col.id}>{col.render(opp)}</td>
                      ))}
                      <td>
                        <button style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: '4px' }} aria-label="Mais ações">
                          <MoreHorizontal size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!loading && tableRows.length === 0 && (
                    <tr>
                      <td colSpan={visibleColumns.length + 1}>
                        <EmptyState title="Nenhuma oportunidade encontrada">
                          {search || stageFilter ? 'Ajuste a busca ou o filtro.' : 'Clique em "Nova Oportunidade" para começar.'}
                        </EmptyState>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={paged.page} pageSize={paged.pageSize} total={paged.total} onPage={paged.setPage} onPageSize={paged.setPageSize} />
          </div>
        </div>
      )}

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
            onToggleEditColumns={() => setEditColumns((v) => !v)}
          />
        </OpportunityPeek>
      )}
    </div>
  );
}
