import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Background, Controls, Handle, MarkerType, Position, ReactFlow, MiniMap } from '@xyflow/react';
import type { Edge, Node, NodeProps, ReactFlowInstance } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleDot,
  FileInput,
  Lock,
  Pencil,
  PanelRightClose,
  PanelRightOpen,
  Plug,
  Plus,
  Search,
  Settings,
  Trash2,
  TriangleAlert,
  Upload,
  User,
  X,
} from 'lucide-react';
import type { Pipeline, Requirement, RequirementGate, RequirementKind, Source, Stage, StageKind, TaskItem } from '../domain';
import { newId, useStore } from '../lib/store';
import { useShell } from '../lib/shell';
import { useOpportunities } from '../lib/useOpportunities';
import { leadsStore } from '../mocks/leads';
import { pipelinesStore } from '../mocks/pipelines';
import { tasksStore } from '../mocks/tasks';
import { resolveStage } from '../lib/stages';
import { formatCurrency } from '../lib/format';
import { pushAviso, pushNotificacao } from '../lib/notify';
import { Badge, CustomSelect, DockContext, EmptyState, Field, Page, PageHeader, SidePanel } from '../components/ui';
import WorkflowInspector from '../components/WorkflowInspector';
import type { InspectorSelection } from '../components/WorkflowInspector';
import { ConnectSourcePanel, RequirementPanel, SourceDetailPanel } from '../components/PipelineEditors';
import { automationsStore } from '../mocks/automations';
import { toggleRequirementTask } from '../lib/taskActions';

// Workflow do funil, da esquerda para a direita (docs/dominio.md §11): fontes entram pela esquerda,
// cada etapa é um nó com seus requisitos, e Ganho e Perdido ficam no fim. Feito com React Flow.

export type ReqState = 'done' | 'pending' | 'blocking' | 'todo';
export type StageState = 'done' | 'current' | 'todo';

export type StageData = {
  stage: Stage;
  requirements: Requirement[];
  records: number;
  blocked: number;
  state: StageState | null;
  reqState: (r: Requirement) => ReqState | null;
  onOpen: (r: Requirement) => void;
  onAdd: (stage: Stage) => void;
  onEditStage: (stage: Stage) => void;
};

export type SourceData = {
  source: Source | null;
  onEditSource: (source: Source | null) => void;
};

export type StageNodeType = Node<StageData, 'stage'>;
export type SourceNodeType = Node<SourceData, 'source'>;

export const GATE_TEXT: Record<RequirementGate, string> = { NONE: 'Só pendência', ENTER: 'Impede entrar', EXIT: 'Impede sair' };
export const KIND_TEXT: Record<RequirementKind, string> = { FIELD: 'Campo do cadastro', ACTION: 'Ação' };
export const STAGE_KIND_TEXT: Record<StageKind, string> = { LEAD: 'Lead', OPEN: 'Aberta', WON: 'Ganha', LOST: 'Perdida' };

const PRESET_COLORS = ['#94a3b8', '#64748b', '#f59e0b', '#8b5cf6', '#3b82f6', '#0ea5e9', '#10b981', '#ef4444', '#ec4899'];

/** O que está aberto no painel lateral, para destacar no canvas. */
const SelectionContext = createContext<InspectorSelection>({});

const STAGE_W = 300;
const GAP = 90;

function StageNode({ data }: NodeProps<StageNodeType>) {
  const { stage, requirements, records, blocked, state, reqState, onOpen, onAdd } = data;
  const canAdd = stage.kind === 'LEAD' || stage.kind === 'OPEN';
  const sel = useContext(SelectionContext);
  return (
    <div className={`wf-node wf-stage ${state ? `is-${state}` : ''} ${sel.stageId === stage.id && !sel.reqId ? 'is-selected' : ''}`} style={{ width: STAGE_W }}>
      <Handle type="target" position={Position.Left} />
      <div className="wf-head" style={{ borderTopColor: stage.color, cursor: 'pointer' }} onClick={() => data.onEditStage(stage)}>
        <div className="wf-title" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="mini-dot" style={{ background: stage.color }} />
            <strong>{stage.name}</strong>
            {state === 'done' && <Check size={14} className="wf-check" />}
          </div>
          <span className="text-xs text-muted" style={{ fontWeight: 'normal', opacity: 0.8 }}>
            <Settings size={12} style={{ display: 'inline', verticalAlign: '-1px' }} />
          </span>
        </div>
        <span className="text-xs text-muted">
          {STAGE_KIND_TEXT[stage.kind]}
          {stage.probability !== undefined ? ` · ${stage.probability}%` : ''}
          {stage.alertDays ? ` · alerta em ${stage.alertDays}d` : ''}
        </span>
        <div className="wf-counts">
          <Badge>{records} {records === 1 ? 'registro' : 'registros'}</Badge>
          {blocked > 0 && <Badge tone="danger"><Lock size={10} /> {blocked} parado{blocked > 1 ? 's' : ''}</Badge>}
        </div>
      </div>
      <div className="wf-body">
        {requirements.length === 0 && <div className="wf-empty">Nenhuma tarefa nesta etapa.</div>}
        {requirements.map((r) => {
          const rs = reqState(r);
          return (
            <button key={r.id} type="button" className={`wf-req nodrag nopan ${rs ? `is-${rs}` : ''} ${sel.reqId === r.id ? 'is-selected' : ''}`} onClick={() => onOpen(r)}>
              <span className="wf-req-icon">
                {rs === 'done' ? <Check size={13} /> : rs === 'blocking' ? <TriangleAlert size={13} /> : r.kind === 'FIELD' ? <FileInput size={13} /> : <CircleDot size={13} />}
              </span>
              <span className="wf-req-main">
                <span className="wf-req-label">{r.label}</span>
                <span className="wf-req-meta">
                  <Badge tone="accent">{r.tag}</Badge>
                  {r.assignee && <span className="wf-assignee"><User size={10} /> {r.assignee}</span>}
                  {r.dueDays !== undefined && <span>{r.dueDays} d</span>}
                </span>
              </span>
              {r.gate !== 'NONE' && (
                <span className="wf-lock" title={GATE_TEXT[r.gate]}>
                  <Lock size={12} />
                  <span>{r.gate === 'ENTER' ? 'Entrar' : 'Sair'}</span>
                </span>
              )}
              {(r.blocked > 0 || r.overdue > 0) && (
                <span className="wf-req-nums">
                  {r.blocked > 0 && <span className="is-danger" title="Registros parados por esta tarefa">{r.blocked}</span>}
                  {r.overdue > 0 && <span className="is-warn" title="Atrasadas">{r.overdue}</span>}
                </span>
              )}
            </button>
          );
        })}
        {canAdd && (
          <button type="button" className="wf-add nodrag nopan" onClick={() => onAdd(stage)}>
            <Plus size={12} /> Adicionar tarefa
          </button>
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function SourceNode({ data }: NodeProps<SourceNodeType>) {
  const { source, onEditSource } = data;
  const sel = useContext(SelectionContext);
  return (
    <div className={`wf-node wf-source ${source ? '' : 'is-missing'} ${source && sel.sourceId === source.id ? 'is-selected' : ''}`} style={{ width: 220, cursor: 'pointer' }} onClick={() => onEditSource(source)}>
      <div className="wf-source-icon">
        {source?.type === 'IMPORT' ? <Upload size={14} /> : source?.type === 'MANUAL' ? <Pencil size={14} /> : <Plug size={14} />}
      </div>
      <div className="cell-stack">
        <strong>{source ? source.name : 'Sem fonte conectada'}</strong>
        <span className="text-xs text-muted">
          {source
            ? (source.project ? `Projeto: ${source.project}` : source.type === 'MANUAL' ? 'Cadastro manual' : source.type === 'IMPORT' ? 'Importação' : 'API')
            : 'Clique para conectar uma fonte'}
        </span>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export const nodeTypes = { stage: StageNode, source: SourceNode };

export type PanelState =
  | { mode: 'edit_req'; requirement: Requirement }
  | { mode: 'new_req'; stage: Stage }
  | { mode: 'record_task'; requirement: Requirement }
  | { mode: 'config_pipeline' }
  | { mode: 'config_stage'; stage: Stage }
  | { mode: 'new_stage' }
  | { mode: 'config_source'; source: Source | null }
  | null;

export type FollowedItem = {
  id: string;
  name: string;
  kind: 'opportunity' | 'lead';
  stageId: string;
  subtext?: string;
};

export default function TaskWorkflow({ pipelineId }: { pipelineId: string }) {
  const { dark, navigate } = useShell();
  const [, setAutomations] = useStore(automationsStore);
  const [pipelines, setPipelines] = useStore(pipelinesStore);
  const [leads] = useStore(leadsStore);
  const [tasks] = useStore(tasksStore);
  const { opportunities } = useOpportunities();

  const pipeline = pipelines.find((p) => p.id === pipelineId);
  const [followId, setFollowId] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [panel, setPanel] = useState<PanelState>(null);

  // Painel lateral fixo: os painéis de edição se encaixam aqui (DockContext) em vez de cobrir a tela, e o canvas segue arrastável.
  const [dockEl, setDockEl] = useState<HTMLElement | null>(null);
  const [dockOpen, setDockOpen] = useState(() => {
    try { return localStorage.getItem('kalidash.wf-dock') !== '0'; } catch { return true; }
  });
  const toggleDock = () => setDockOpen((v) => {
    try { localStorage.setItem('kalidash.wf-dock', v ? '0' : '1'); } catch { /* sem storage: vale só nesta visita */ }
    return !v;
  });
  const [rf, setRf] = useState<ReactFlowInstance | null>(null);

  // Abrir um painel (ou o seletor de registro) abre o lado e tira o outro da frente: só um conteúdo por vez no painel.
  useEffect(() => { if (panel) { setDockOpen(true); setSearchOpen(false); } }, [panel]);
  useEffect(() => { if (searchOpen) { setDockOpen(true); setPanel(null); } }, [searchOpen]);

  const [newStageName, setNewStageName] = useState('');
  const [newStageKind, setNewStageKind] = useState<StageKind>('OPEN');
  const [newStageColor, setNewStageColor] = useState('#3b82f6');
  const [newStagePosition, setNewStagePosition] = useState<'start' | 'end'>('end');

  const updatePipeline = (fn: (p: Pipeline) => Pipeline) =>
    setPipelines((prev) => prev.map((p) => (p.id === pipelineId ? fn(p) : p)));

  // Registros reais disponíveis para seguir (oportunidades da API e leads)
  const availableRecords = useMemo<FollowedItem[]>(() => {
    if (!pipeline) return [];
    const list: FollowedItem[] = [];

    // Oportunidades desta pipeline
    opportunities.forEach((opp) => {
      const resolved = resolveStage(opp, pipelines);
      if (resolved.pipeline?.id === pipelineId && resolved.stage) {
        list.push({
          id: opp.id,
          name: opp.title,
          kind: 'opportunity',
          stageId: resolved.stage.id,
          subtext: `${resolved.stage.name}${opp.value ? ` · ${formatCurrency(opp.value)}` : ''}${opp.companyName ? ` · ${opp.companyName}` : ''}`,
        });
      }
    });

    // Leads desta pipeline
    leads.forEach((ld) => {
      if (ld.pipelineId === pipelineId) {
        const stage = pipeline.stages.find((s) => s.id === ld.stageId);
        list.push({
          id: ld.id,
          name: ld.name,
          kind: 'lead',
          stageId: ld.stageId,
          subtext: `${stage?.name ?? 'Lead'}${ld.sourceName ? ` · Fonte: ${ld.sourceName}` : ''}`,
        });
      }
    });

    return list;
  }, [opportunities, leads, pipelines, pipeline, pipelineId]);

  const followed = useMemo(
    () => availableRecords.find((r) => r.id === followId) ?? null,
    [availableRecords, followId]
  );

  // IDs dos requisitos cumpridos para o registro seguido (a partir de tasksStore)
  const completedReqIds = useMemo(() => {
    if (!followed) return new Set<string>();
    const set = new Set<string>();
    tasks.forEach((t) => {
      if (t.entityId === followed.id && t.done && t.requirementId) {
        set.add(t.requirementId);
      }
    });
    return set;
  }, [followed, tasks]);

  const onOpenRequirement = (r: Requirement) => {
    if (followed) {
      setPanel({ mode: 'record_task', requirement: r });
    } else {
      setPanel({ mode: 'edit_req', requirement: r });
    }
  };

  const { nodes, edges } = useMemo(
    () =>
      pipeline
        ? buildGraph(pipeline, followed, setPanel, completedReqIds, onOpenRequirement)
        : { nodes: [], edges: [] },
    [pipeline, followed, completedReqIds]
  );

  const selection = useMemo<InspectorSelection>(() => {
    if (!panel) return {};
    if (panel.mode === 'edit_req' || panel.mode === 'record_task') return { reqId: panel.requirement.id, stageId: panel.requirement.stageId };
    if (panel.mode === 'new_req' || panel.mode === 'config_stage') return { stageId: panel.stage.id };
    if (panel.mode === 'config_source' && panel.source) return { sourceId: panel.source.id };
    return {};
  }, [panel]);

  const focusNode = useCallback((id: string) => {
    const n = rf?.getNode(id);
    if (!rf || !n) return;
    const w = n.measured?.width ?? STAGE_W;
    const h = n.measured?.height ?? 200;
    void rf.setCenter(n.position.x + w / 2, n.position.y + Math.min(h, 360) / 2, { zoom: Math.max(rf.getZoom(), 0.85), duration: 350 });
  }, [rf]);

  if (!pipeline) {
    return (
      <Page>
        <PageHeader title="Funil não encontrado" back={{ label: 'Tarefas', to: '/tarefas' }} />
        <EmptyState title="Não existe um funil com este endereço">Volte para a galeria e escolha um dos funis.</EmptyState>
      </Page>
    );
  }

  // Ações de requisitos
  const saveRequirement = (req: Requirement) => {
    updatePipeline((p) => ({
      ...p,
      requirements: p.requirements.some((r) => r.id === req.id) ? p.requirements.map((r) => (r.id === req.id ? req : r)) : [...p.requirements, req],
    }));
  };

  const linkAutomation = (requirementId: string, automationId: string) =>
    updatePipeline((p) => ({ ...p, requirements: p.requirements.map((r) => (r.id === requirementId ? { ...r, linkedAutomationId: automationId } : r)) }));

  const removeRequirement = (req: Requirement) => {
    updatePipeline((p) => ({ ...p, requirements: p.requirements.filter((r) => r.id !== req.id) }));
    // A automação criada a partir da tarefa é gerenciada: some junto.
    if (req.linkedAutomationId) setAutomations((prev) => prev.filter((a) => a.id !== req.linkedAutomationId));
    setPanel((cur) => (cur && (cur.mode === 'edit_req' || cur.mode === 'record_task') && cur.requirement.id === req.id ? null : cur));
  };

  // Alternar conclusão de tarefa no registro seguido
  const handleToggleRecordTask = (requirement: Requirement) => {
    if (!followed) return;
    toggleRequirementTask(requirement, pipeline, { kind: followed.kind, id: followed.id, name: followed.name });
  };

  // Ações de etapas
  const handleUpdateStage = (stageId: string, change: Partial<Stage>) => {
    updatePipeline((p) => ({
      ...p,
      stages: p.stages.map((s) => (s.id === stageId ? { ...s, ...change } : s)),
    }));
  };

  const handleMoveStage = (stageId: string, delta: number) => {
    updatePipeline((p) => {
      const idx = p.stages.findIndex((s) => s.id === stageId);
      if (idx === -1) return p;
      const target = idx + delta;
      if (target < 0 || target >= p.stages.length) return p;
      const next = [...p.stages];
      [next[idx], next[target]] = [next[target], next[idx]];
      return { ...p, stages: next };
    });
  };

  const handleDeleteStage = (stageId: string) => {
    const stage = pipeline.stages.find((s) => s.id === stageId);
    if (!stage) return;
    const recCount = pipeline.counts[stageId] ?? 0;
    if (recCount > 0) {
      pushAviso('Não é possível excluir', `Existem ${recCount} registros nesta etapa. Mova-os antes de excluir.`);
      return;
    }
    if ((stage.kind === 'WON' || stage.kind === 'LOST') && pipeline.stages.filter((s) => s.kind === stage.kind).length <= 1) {
      pushAviso('Não é possível excluir', 'O funil precisa manter ao menos uma etapa Ganha e uma Perdida.');
      return;
    }
    // As tarefas da etapa vão com ela, e as automações criadas a partir delas também.
    const gone = new Set(pipeline.requirements.filter((r) => r.stageId === stageId).flatMap((r) => (r.linkedAutomationId ? [r.linkedAutomationId] : [])));
    if (gone.size > 0) setAutomations((prev) => prev.filter((a) => !gone.has(a.id)));
    updatePipeline((p) => ({
      ...p,
      stages: p.stages.filter((s) => s.id !== stageId),
      requirements: p.requirements.filter((r) => r.stageId !== stageId),
    }));
    pushNotificacao('Etapa removida', `A etapa "${stage.name}" foi removida do funil.`);
    setPanel((cur) => (cur?.mode === 'config_stage' && cur.stage.id === stageId ? null : cur));
  };

  const handleCreateStage = () => {
    if (!newStageName.trim()) return;
    const newStage: Stage = {
      id: `${pipelineId}:${newId('st')}`,
      name: newStageName.trim(),
      kind: newStageKind,
      color: newStageColor,
      probability: newStageKind === 'OPEN' ? 50 : undefined,
      alertDays: newStageKind === 'OPEN' ? 7 : undefined,
    };
    updatePipeline((p) => {
      const current = [...p.stages];
      if (newStagePosition === 'start') {
        const firstOpen = current.findIndex((s) => s.kind === 'OPEN');
        if (firstOpen !== -1) current.splice(firstOpen, 0, newStage);
        else current.unshift(newStage);
      } else {
        const wonLostIdx = current.findIndex((s) => s.kind === 'WON' || s.kind === 'LOST');
        if (wonLostIdx !== -1) current.splice(wonLostIdx, 0, newStage);
        else current.push(newStage);
      }
      return { ...p, stages: current };
    });
    pushNotificacao('Etapa criada', `A etapa "${newStageName}" foi adicionada.`);
    setNewStageName('');
    setPanel(null);
  };

  // Ações de fontes: as mesmas das Configurações (formulário real, automação gerenciada que vai e vem com a fonte)
  const handleConnectSource = (source: Source) => {
    updatePipeline((p) => ({ ...p, sources: [...p.sources, source] }));
    setPanel(null);
  };

  const handleChangeSource = (source: Source) =>
    updatePipeline((p) => ({ ...p, sources: p.sources.map((s) => (s.id === source.id ? source : s)) }));

  const handleRemoveSource = (source: Source) => {
    updatePipeline((p) => ({ ...p, sources: p.sources.filter((s) => s.id !== source.id) }));
    setAutomations((prev) => prev.filter((a) => a.managedBy !== `Conectar fonte: ${source.name}`));
    setPanel((cur) => (cur?.mode === 'config_source' && cur.source?.id === source.id ? null : cur));
  };

  const cur = panel?.mode === 'config_stage' ? pipeline.stages.find((s) => s.id === panel.stage.id) : undefined;
  const followedStage = pipeline.stages.find((s) => s.id === followed?.stageId);

  return (
    <SelectionContext.Provider value={selection}>
    <DockContext.Provider value={dockEl}>
    <div className="wf-fullscreen">
      <div className="wf-toolbar" style={{ width: '100%', boxSizing: 'border-box', padding: '0 24px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-app)', flex: 'none', zIndex: 10 }}>
        <style>{`.wf-toolbar .page-header { padding: 12px 0; }`}</style>
        <PageHeader
          back={{ label: 'Tarefas', to: '/tarefas' }}
          title={pipeline.name}
          subtitle={pipeline.offer || undefined}
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div className="follow" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span className="text-xs text-muted">Seguir registro:</span>
                <button
                  type="button"
                  className={`btn btn-sm ${followed ? 'btn-solid' : ''}`}
                  onClick={() => setSearchOpen(true)}
                  style={{ gap: '6px' }}
                >
                  <Search size={13} />
                  {followed ? (
                    <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {followed.name}
                    </span>
                  ) : (
                    'Escolher'
                  )}
                </button>
                {followed && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    title="Parar de seguir"
                    onClick={() => setFollowId('')}
                    style={{ padding: '4px 6px' }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <button type="button" className="btn btn-sm" onClick={() => setPanel({ mode: 'new_stage' })}>
                <Plus size={13} /> Nova etapa
              </button>
              <button type="button" className="btn btn-sm" onClick={() => setPanel({ mode: 'config_source', source: null })}>
                <Plus size={13} /> Nova fonte
              </button>
              <button type="button" className="btn btn-sm" onClick={() => setPanel({ mode: 'config_pipeline' })}>
                <Settings size={13} /> Configurar
              </button>
              <button type="button" className="btn btn-sm" onClick={toggleDock} aria-pressed={dockOpen} title={dockOpen ? 'Recolher o painel lateral' : 'Abrir o painel lateral'}>
                {dockOpen ? <PanelRightClose size={13} /> : <PanelRightOpen size={13} />} Painel
              </button>
            </div>
          }
        />
      </div>

      {followed && (
        <div style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', padding: '6px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1.5s infinite' }} />
            <span>
              Seguindo <strong>{followed.name}</strong> ({followed.kind === 'opportunity' ? 'Oportunidade' : 'Lead'}) · Etapa atual: <strong>{followedStage?.name ?? '—'}</strong>
            </span>
          </div>
          <button type="button" className="link-inline" onClick={() => setFollowId('')} style={{ fontSize: '12px', border: 'none', background: 'transparent', cursor: 'pointer' }}>
            Limpar destaque
          </button>
        </div>
      )}

      <div className="wf-main">
      <div className="wf-canvas" role="region" aria-label={`Workflow de ${pipeline.name}`}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          defaultViewport={{ x: 24, y: 24, zoom: 0.85 }}
          minZoom={0.25}
          maxZoom={1.4}
          panOnScroll
          proOptions={{ hideAttribution: true }}
          colorMode={dark ? 'dark' : 'light'}
          onInit={setRf}
        >
          <Background gap={20} />
          <Controls showInteractive={false} />
          <MiniMap
            position="bottom-right"
            nodeColor="#ffffff"
            nodeStrokeColor="#94a3b8"
            nodeStrokeWidth={2}
            maskColor="rgba(0,0,0,0.05)"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
              margin: '16px',
            }}
          />
        </ReactFlow>
      </div>

      <aside className={`wf-dock ${dockOpen ? 'open' : ''}`} aria-label="Painel do funil" aria-hidden={!dockOpen}>
        <div className="dock-slot" ref={setDockEl} />
        {!panel && !searchOpen && (
          <>
            <header className="panel-head">
              <div>
                <h2 className="panel-title">Estrutura do funil</h2>
                <p className="panel-subtitle">Fontes, etapas e tarefas. Clique para ver e editar, e crie ou remova daqui. O painel fica aberto enquanto você arrasta e dá zoom.</p>
              </div>
            </header>
            <div className="panel-body">
              <WorkflowInspector
                pipeline={pipeline}
                selection={selection}
                onFocusNode={focusNode}
                onNewSource={() => setPanel({ mode: 'config_source', source: null })}
                onOpenSource={(s) => setPanel({ mode: 'config_source', source: s })}
                onToggleSource={(s, active) => handleChangeSource({ ...s, active })}
                onRemoveSource={handleRemoveSource}
                onNewStage={() => setPanel({ mode: 'new_stage' })}
                onOpenStage={(s) => setPanel({ mode: 'config_stage', stage: s })}
                onMoveStage={handleMoveStage}
                onRemoveStage={(s) => handleDeleteStage(s.id)}
                onNewRequirement={(s) => setPanel({ mode: 'new_req', stage: s })}
                onOpenRequirement={(r) => setPanel({ mode: 'edit_req', requirement: r })}
                onRemoveRequirement={removeRequirement}
              />
            </div>
          </>
        )}
      </aside>
      </div>

      {searchOpen && (
        <SidePanel
          title="Seguir um registro no funil"
          subtitle="Selecione um lead ou oportunidade para ver o caminho percorrido e o status das suas tarefas."
          onClose={() => { setSearchOpen(false); setSearchQuery(''); }}
        >
          <div className="p-4" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input
              className="input"
              placeholder="Pesquisar por nome ou empresa…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', flex: 1 }}>
              <button
                type="button"
                className={`btn ${followId === '' ? 'btn-solid' : ''}`}
                style={{ justifyContent: 'center' }}
                onClick={() => { setFollowId(''); setSearchOpen(false); setSearchQuery(''); }}
              >
                Nenhum (visão geral do funil)
              </button>
              {availableRecords
                .filter((r) => r.name.toLowerCase().includes(searchQuery.toLowerCase()) || (r.subtext && r.subtext.toLowerCase().includes(searchQuery.toLowerCase())))
                .map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className={`btn ${followId === r.id ? 'btn-solid' : ''}`}
                    style={{ justifyContent: 'space-between', padding: '10px 12px', textAlign: 'left' }}
                    onClick={() => { setFollowId(r.id); setSearchOpen(false); setSearchQuery(''); }}
                  >
                    <div className="cell-stack">
                      <strong>{r.name}</strong>
                      <span className="text-xs text-muted">{r.subtext}</span>
                    </div>
                    <Badge tone={r.kind === 'opportunity' ? 'accent' : 'warning'}>
                      {r.kind === 'opportunity' ? 'Oportunidade' : 'Lead'}
                    </Badge>
                  </button>
                ))}
              {availableRecords.length === 0 && (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  Nenhum registro encontrado neste funil ainda. Crie uma oportunidade ou aguarde a entrada de leads.
                </div>
              )}
            </div>
          </div>
        </SidePanel>
      )}

      {/* Painel de execução de tarefa para o registro seguido */}
      {panel?.mode === 'record_task' && followed && (
        <RecordTaskPanel
          record={followed}
          requirement={panel.requirement}
          pipeline={pipeline}
          task={tasks.find((t) => t.requirementId === panel.requirement.id && t.entityId === followed.id)}
          isDone={completedReqIds.has(panel.requirement.id)}
          isBlocking={
            !completedReqIds.has(panel.requirement.id) &&
            ((panel.requirement.gate === 'EXIT' && panel.requirement.stageId === followed.stageId) ||
             (panel.requirement.gate === 'ENTER' && pipeline.stages.findIndex((s) => s.id === panel.requirement.stageId) === pipeline.stages.findIndex((s) => s.id === followed.stageId) + 1))
          }
          onToggleTask={() => handleToggleRecordTask(panel.requirement)}
          onEditRequirement={() => setPanel({ mode: 'edit_req', requirement: panel.requirement })}
          onClose={() => setPanel(null)}
        />
      )}

      {/* Painel de edição de regra do requisito */}
      {(panel?.mode === 'edit_req' || panel?.mode === 'new_req') && (
        <RequirementPanel
          key={panel.mode === 'edit_req' ? panel.requirement.id : `new:${panel.stage.id}`}
          pipeline={pipeline}
          requirement={panel.mode === 'edit_req' ? pipeline.requirements.find((r) => r.id === panel.requirement.id) ?? panel.requirement : undefined}
          stageId={panel.mode === 'new_req' ? panel.stage.id : undefined}
          onClose={() => setPanel(null)}
          onSave={saveRequirement}
          onDelete={removeRequirement}
          onAutomationCreated={linkAutomation}
        />
      )}

      {/* Painel de configuração geral do funil */}
      {panel?.mode === 'config_pipeline' && (
        <SidePanel title="Configurações do Funil" subtitle={pipeline.name} onClose={() => setPanel(null)}>
          <div className="form-stack p-4">
            <Field label="Nome do funil">
              <input className="input" value={pipeline.name} onChange={(e) => updatePipeline((p) => ({ ...p, name: e.target.value }))} />
            </Field>
            <Field label="Oferta associada" hint="Nome do produto ou serviço correspondente a esta pipeline">
              <input className="input" value={pipeline.offer} onChange={(e) => updatePipeline((p) => ({ ...p, offer: e.target.value }))} placeholder="Ex.: Consultoria Enterprise" />
            </Field>
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
              <button type="button" className="btn" onClick={() => navigate(`/oportunidades/pipelines/${pipeline.id}`)}>
                <Settings size={14} /> Passos automáticos, campos, tags e arquivar
              </button>
              <p className="text-xs text-muted" style={{ margin: '8px 0 16px' }}>O restante da configuração do funil fica nas Configurações das pipelines.</p>
              <span className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                Tags de tarefa do funil
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                {pipeline.taskTags.map((tg) => (
                  <Badge key={tg} tone="accent">
                    {tg}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </SidePanel>
      )}

      {/* Painel de configuração da etapa */}
      {panel?.mode === 'config_stage' && cur && (
        <SidePanel
          title="Configurar Etapa"
          subtitle={`${cur.name} · ${pipeline.name}`}
          onClose={() => setPanel(null)}
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => handleDeleteStage(cur.id)}
              >
                <Trash2 size={14} /> Excluir etapa
              </button>
              <button type="button" className="btn btn-solid" onClick={() => setPanel(null)}>
                Pronto
              </button>
            </div>
          }
        >
          <div className="form-stack p-4">
            <Field label="Nome da etapa">
              <input className="input" value={cur.name} onChange={(e) => handleUpdateStage(cur.id, { name: e.target.value })} />
            </Field>
            <div className="form-grid">
              <Field label="Tipo da etapa">
                <CustomSelect className="select" value={cur.kind} onChange={(e) => handleUpdateStage(cur.id, { kind: e.target.value as StageKind })}>
                  <option value="LEAD">Lead (pré-qualificação)</option>
                  <option value="OPEN">Aberta (em andamento)</option>
                  <option value="WON">Ganha (fechamento)</option>
                  <option value="LOST">Perdida (descarte)</option>
                </CustomSelect>
              </Field>
              <Field label="Cor de destaque">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="color" className="color-input" value={cur.color} onChange={(e) => handleUpdateStage(cur.id, { color: e.target.value })} />
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => handleUpdateStage(cur.id, { color: c })}
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: c,
                          border: cur.color === c ? '2px solid var(--text-primary)' : '1px solid transparent',
                          cursor: 'pointer',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </Field>
            </div>
            {cur.kind === 'OPEN' && (
              <div className="form-grid">
                <Field label="Probabilidade estimada (%)">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="input"
                    value={cur.probability ?? ''}
                    onChange={(e) => handleUpdateStage(cur.id, { probability: e.target.value === '' ? undefined : Number(e.target.value) })}
                    placeholder="Ex: 50"
                  />
                </Field>
                <Field label="Alerta de inatividade (dias)">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    className="input"
                    value={cur.alertDays ?? ''}
                    onChange={(e) => handleUpdateStage(cur.id, { alertDays: e.target.value === '' ? undefined : Number(e.target.value) })}
                    placeholder="Ex: 7"
                  />
                </Field>
              </div>
            )}
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
              <span className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                Posição da etapa no funil
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn"
                  disabled={pipeline.stages[0]?.id === cur.id}
                  onClick={() => handleMoveStage(cur.id, -1)}
                >
                  <ArrowLeft size={14} /> Mover para esquerda
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={pipeline.stages[pipeline.stages.length - 1]?.id === cur.id}
                  onClick={() => handleMoveStage(cur.id, 1)}
                >
                  Mover para direita <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </SidePanel>
      )}

      {/* Painel de criação de nova etapa */}
      {panel?.mode === 'new_stage' && (
        <SidePanel
          title="Nova Etapa no Funil"
          subtitle={pipeline.name}
          onClose={() => setPanel(null)}
          footer={
            <>
              <button type="button" className="btn" onClick={() => setPanel(null)}>Cancelar</button>
              <button type="button" className="btn btn-solid" disabled={!newStageName.trim()} onClick={handleCreateStage}>
                Criar etapa
              </button>
            </>
          }
        >
          <div className="form-stack p-4">
            <Field label="Nome da etapa">
              <input className="input" placeholder="Ex: Demonstração, Proposta Técnica..." value={newStageName} onChange={(e) => setNewStageName(e.target.value)} autoFocus />
            </Field>
            <div className="form-grid">
              <Field label="Tipo da etapa">
                <CustomSelect className="select" value={newStageKind} onChange={(e) => setNewStageKind(e.target.value as StageKind)}>
                  <option value="OPEN">Aberta (em andamento)</option>
                  <option value="LEAD">Lead (pré-qualificação)</option>
                </CustomSelect>
              </Field>
              <Field label="Cor">
                <input type="color" className="color-input" value={newStageColor} onChange={(e) => setNewStageColor(e.target.value)} />
              </Field>
            </div>
            <Field label="Posição no funil">
              <CustomSelect className="select" value={newStagePosition} onChange={(e) => setNewStagePosition(e.target.value as 'start' | 'end')}>
                <option value="end">Antes de Ganho/Perdido</option>
                <option value="start">No início das etapas abertas</option>
              </CustomSelect>
            </Field>
          </div>
        </SidePanel>
      )}

      {/* Fontes: conectar uma nova (formulário real) ou ajustar a existente */}
      {panel?.mode === 'config_source' && !panel.source && (
        <ConnectSourcePanel pipeline={pipeline} onClose={() => setPanel(null)} onConnect={handleConnectSource} />
      )}
      {panel?.mode === 'config_source' && panel.source && (
        <SourceDetailPanel
          key={panel.source.id}
          pipeline={pipeline}
          source={pipeline.sources.find((s) => s.id === panel.source!.id) ?? panel.source}
          onClose={() => setPanel(null)}
          onChange={handleChangeSource}
          onRemove={handleRemoveSource}
        />
      )}
    </div>
    </DockContext.Provider>
    </SelectionContext.Provider>
  );
}

export function buildGraph(
  pipeline: Pipeline,
  followed: { id: string; stageId: string; done?: string[] } | null,
  setPanel: (p: PanelState) => void,
  completedReqIds?: Set<string>,
  onOpenReq?: (r: Requirement) => void
) {
  const nodes: (StageNodeType | SourceNodeType)[] = [];
  const edges: Edge[] = [];

  const stageIndex = (id: string) => pipeline.stages.findIndex((s) => s.id === id);
  const currentIdx = followed ? stageIndex(followed.stageId) : -1;

  const reqStateFor = (r: Requirement): ReqState | null => {
    if (!followed) return null;
    const idx = stageIndex(r.stageId);
    if (idx < currentIdx) return 'done';
    const isDone = completedReqIds ? completedReqIds.has(r.id) : (followed.done?.includes(r.id) ?? false);
    if (idx === currentIdx) {
      if (isDone) return 'done';
      return r.gate === 'EXIT' ? 'blocking' : 'pending';
    }
    if (idx === currentIdx + 1 && r.gate === 'ENTER' && !isDone) return 'blocking';
    return 'todo';
  };

  const sources: (Source | null)[] = pipeline.sources.length ? pipeline.sources : [null];
  sources.forEach((s, i) => {
    nodes.push({
      id: `src-${s?.id ?? 'none'}`,
      type: 'source',
      position: { x: 0, y: i * 110 },
      data: {
        source: s,
        onEditSource: (src) => setPanel({ mode: 'config_source', source: src }),
      },
      draggable: false,
    });
  });

  const main = pipeline.stages.filter((s) => s.kind === 'LEAD' || s.kind === 'OPEN');
  const won = pipeline.stages.find((s) => s.kind === 'WON');
  const lost = pipeline.stages.find((s) => s.kind === 'LOST');
  const firstX = 220 + GAP;

  const stageNode = (stage: Stage, x: number, y: number): StageNodeType => {
    const idx = stageIndex(stage.id);
    const reqs = pipeline.requirements.filter((r) => r.stageId === stage.id);
    const state: StageState | null = followed
      ? idx < currentIdx
        ? 'done'
        : idx === currentIdx
          ? 'current'
          : 'todo'
      : null;
    return {
      id: stage.id,
      type: 'stage',
      position: { x, y },
      draggable: false,
      data: {
        stage,
        requirements: reqs,
        records: pipeline.counts[stage.id] ?? 0,
        blocked: reqs.reduce((a, r) => a + r.blocked, 0),
        state,
        reqState: reqStateFor,
        onOpen: (requirement) => {
          if (onOpenReq) onOpenReq(requirement);
          else setPanel({ mode: 'edit_req', requirement });
        },
        onAdd: (st) => setPanel({ mode: 'new_req', stage: st }),
        onEditStage: (st) => setPanel({ mode: 'config_stage', stage: st }),
      },
    };
  };

  main.forEach((s, i) => nodes.push(stageNode(s, firstX + i * (STAGE_W + GAP), 0)));
  const endX = firstX + main.length * (STAGE_W + GAP);
  if (won) nodes.push(stageNode(won, endX, 0));
  if (lost) nodes.push(stageNode(lost, endX, 190));

  const passed = (stageId: string) => followed !== null && stageIndex(stageId) <= currentIdx;
  const edge = (id: string, source: string, target: string, opts: Partial<Edge> = {}, active = false): Edge => ({
    id,
    source,
    target,
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed },
    className: active ? 'wf-edge-active' : undefined,
    animated: active,
    ...opts,
  });

  if (main[0]) {
    sources.forEach((s) =>
      edges.push(
        edge(`e-src-${s?.id ?? 'none'}`, `src-${s?.id ?? 'none'}`, main[0].id, s ? {} : { style: { strokeDasharray: '5 5' } })
      )
    );
  }
  main.forEach((s, i) => {
    const next = main[i + 1] ?? won;
    if (next) edges.push(edge(`e-${s.id}`, s.id, next.id, {}, passed(next.id)));
  });
  const lastOpen = main[main.length - 1];
  if (lastOpen && lost) edges.push(edge('e-lost', lastOpen.id, lost.id, { style: { strokeDasharray: '5 5' } }));

  return { nodes, edges };
}

function RecordTaskPanel({
  record,
  requirement,
  pipeline,
  task,
  isDone,
  isBlocking,
  onToggleTask,
  onEditRequirement,
  onClose,
}: {
  record: FollowedItem;
  requirement: Requirement;
  pipeline: Pipeline;
  task?: TaskItem;
  isDone: boolean;
  isBlocking: boolean;
  onToggleTask: () => void;
  onEditRequirement: () => void;
  onClose: () => void;
}) {
  const stage = pipeline.stages.find((s) => s.id === requirement.stageId);

  return (
    <SidePanel
      title="Tarefa do Registro"
      subtitle={`${record.name} (${record.kind === 'opportunity' ? 'Oportunidade' : 'Lead'})`}
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <button type="button" className="btn" onClick={onEditRequirement}>
            <Settings size={14} /> Regra no funil
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn" onClick={onClose}>Fechar</button>
            <button
              type="button"
              className={`btn ${isDone ? '' : 'btn-solid'}`}
              style={!isDone ? { background: '#10b981', borderColor: '#10b981', color: '#fff' } : undefined}
              onClick={onToggleTask}
            >
              {isDone ? <><X size={14} /> Reabrir tarefa</> : <><Check size={14} /> Concluir tarefa</>}
            </button>
          </div>
        </div>
      }
    >
      <div className="form-stack p-4">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 14px',
            borderRadius: '10px',
            background: isDone ? 'rgba(16, 185, 129, 0.1)' : isBlocking ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-surface-hover)',
            border: `1px solid ${isDone ? 'rgba(16, 185, 129, 0.3)' : isBlocking ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-subtle)'}`,
          }}
        >
          {isDone ? <Check size={20} color="#10b981" /> : isBlocking ? <TriangleAlert size={20} color="#ef4444" /> : <CircleDot size={20} color="var(--accent)" />}
          <div>
            <strong style={{ display: 'block', fontSize: '14px', color: isDone ? '#10b981' : isBlocking ? '#ef4444' : 'inherit' }}>
              {isDone ? 'Tarefa Concluída' : isBlocking ? 'Bloqueando Movimentação' : 'Tarefa Pendente'}
            </strong>
            <span className="text-xs text-muted">
              {isDone
                ? (task?.doneAt ? `Cumprida em ${new Date(task.doneAt).toLocaleDateString('pt-BR')}` : 'Cumprida para este registro')
                : isBlocking
                  ? (requirement.gate === 'EXIT' ? 'Impede o registro de avançar para fora desta etapa' : 'Impede o registro de entrar na próxima etapa')
                  : 'Necessária para o processo, sem bloqueio rígido'}
            </span>
          </div>
        </div>

        <div className="cell-stack" style={{ gap: '14px', marginTop: '12px' }}>
          <div>
            <span className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase' }}>Tarefa</span>
            <div style={{ fontSize: '16px', fontWeight: 600, marginTop: '2px' }}>{requirement.label}</div>
          </div>

          <div className="form-grid">
            <div>
              <span className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase' }}>Etapa</span>
              <div style={{ marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="mini-dot" style={{ background: stage?.color ?? '#94a3b8' }} />
                <strong>{stage?.name ?? '—'}</strong>
              </div>
            </div>
            <div>
              <span className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase' }}>Tag</span>
              <div style={{ marginTop: '2px' }}>
                <Badge tone="accent">{requirement.tag}</Badge>
              </div>
            </div>
          </div>

          <div className="form-grid">
            <div>
              <span className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase' }}>Responsável</span>
              <div style={{ marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <User size={13} className="text-muted" />
                <span>{requirement.assignee || 'Qualquer responsável'}</span>
              </div>
            </div>
            <div>
              <span className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase' }}>Prazo</span>
              <div style={{ marginTop: '2px' }}>
                <span>{requirement.dueDays !== undefined ? `${requirement.dueDays} dias após entrada` : 'Sem prazo fixo'}</span>
              </div>
            </div>
          </div>

          <div>
            <span className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase' }}>Efeito de Trava</span>
            <div style={{ marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lock size={13} className="text-muted" />
              <span>{GATE_TEXT[requirement.gate]}</span>
            </div>
          </div>
        </div>
      </div>
    </SidePanel>
  );
}
