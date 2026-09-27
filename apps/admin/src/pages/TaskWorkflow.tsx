import { useMemo, useState } from 'react';
import { Background, Controls, Handle, MarkerType, Position, ReactFlow, MiniMap } from '@xyflow/react';
import type { Edge, Node, NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Check, CircleDot, FileInput, Lock, Pencil, Plug, Plus, Settings, Trash2, TriangleAlert, Upload, User } from 'lucide-react';
import type { Pipeline, Requirement, RequirementGate, RequirementKind, Source, Stage } from '../domain';
import { newId, useStore } from '../lib/store';
import { useShell } from '../lib/shell';
import { pipelinesStore } from '../mocks/pipelines';
import { trackedRecords } from '../mocks/records';
import type { TrackedRecord } from '../mocks/records';
import { Badge, EmptyState, Field, Page, PageHeader, SidePanel } from '../components/ui';
import { CustomSelect } from '../components/ui';

// Workflow do funil, da esquerda para a direita (docs/dominio.md §11): fontes entram, cada etapa é
// um nó com seus requisitos, e Ganho e Perdido ficam no fim. Feito com React Flow (MIT).

type ReqState = 'done' | 'pending' | 'blocking' | 'todo';
type StageState = 'done' | 'current' | 'todo';

type StageData = {
  stage: Stage;
  requirements: Requirement[];
  records: number;
  blocked: number;
  state: StageState | null;
  reqState: (r: Requirement) => ReqState | null;
  onOpen: (r: Requirement) => void;
  onAdd: (stage: Stage) => void;
};

type SourceData = { source: Source | null };

type StageNodeType = Node<StageData, 'stage'>;
type SourceNodeType = Node<SourceData, 'source'>;

const GATE_TEXT: Record<RequirementGate, string> = { NONE: 'Só pendência', ENTER: 'Impede entrar', EXIT: 'Impede sair' };
const KIND_TEXT: Record<RequirementKind, string> = { FIELD: 'Campo do cadastro', ACTION: 'Ação' };
const STAGE_KIND_TEXT = { LEAD: 'Lead', OPEN: 'Aberta', WON: 'Ganha', LOST: 'Perdida' } as const;

const STAGE_W = 300;
const GAP = 90;

function StageNode({ data }: NodeProps<StageNodeType>) {
  const { stage, requirements, records, blocked, state, reqState, onOpen, onAdd } = data;
  const canAdd = stage.kind === 'LEAD' || stage.kind === 'OPEN';
  return (
    <div className={`wf-node wf-stage ${state ? `is-${state}` : ''}`} style={{ width: STAGE_W }}>
      <Handle type="target" position={Position.Left} />
      <div className="wf-head" style={{ borderTopColor: stage.color }}>
        <div className="wf-title">
          <span className="mini-dot" style={{ background: stage.color }} />
          <strong>{stage.name}</strong>
          {state === 'done' && <Check size={14} className="wf-check" />}
        </div>
        <span className="text-xs text-muted">{STAGE_KIND_TEXT[stage.kind]}{stage.alertDays ? ` · alerta em ${stage.alertDays} dias` : ''}</span>
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
            <button key={r.id} type="button" className={`wf-req nodrag nopan ${rs ? `is-${rs}` : ''}`} onClick={() => onOpen(r)}>
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
          <button type="button" className="wf-add nodrag nopan" onClick={() => onAdd(stage)}><Plus size={12} /> Adicionar tarefa</button>
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function SourceNode({ data }: NodeProps<SourceNodeType>) {
  const { source } = data;
  return (
    <div className={`wf-node wf-source ${source ? '' : 'is-missing'}`} style={{ width: 220 }}>
      <div className="wf-source-icon">{source?.type === 'IMPORT' ? <Upload size={14} /> : source?.type === 'MANUAL' ? <Pencil size={14} /> : <Plug size={14} />}</div>
      <div className="cell-stack">
        <strong>{source ? source.name : 'Sem fonte conectada'}</strong>
        <span className="text-xs text-muted">
          {source ? (source.project ? `Projeto: ${source.project}` : source.type === 'MANUAL' ? 'Cadastro manual' : source.type === 'IMPORT' ? 'Importação' : 'API') : 'Conecte um formulário nas configurações'}
        </span>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

// Fora do componente: o React Flow exige referência estável.
export const nodeTypes = { stage: StageNode, source: SourceNode };

type PanelState = { mode: 'edit'; requirement: Requirement } | { mode: 'new'; stage: Stage } | null;

export default function TaskWorkflow({ pipelineId }: { pipelineId: string }) {
  const { navigate, dark } = useShell();
  const [pipelines, setPipelines] = useStore(pipelinesStore);
  const pipeline = pipelines.find((p) => p.id === pipelineId);
  const [followId, setFollowId] = useState('');
  const [panel, setPanel] = useState<PanelState>(null);

  const records = useMemo(() => trackedRecords.filter((r) => r.pipelineId === pipelineId), [pipelineId]);
  const followed = records.find((r) => r.id === followId) ?? null;

  const updatePipeline = (fn: (p: Pipeline) => Pipeline) => setPipelines((prev) => prev.map((p) => (p.id === pipelineId ? fn(p) : p)));

  const { nodes, edges } = useMemo(() => (pipeline ? buildGraph(pipeline, followed, setPanel) : { nodes: [], edges: [] }), [pipeline, followed]);

  if (!pipeline) {
    return (
      <Page>
        <PageHeader title="Funil não encontrado" back={{ label: 'Tarefas', to: '/tarefas' }} />
        <EmptyState title="Não existe um funil com este endereço">Volte para a galeria e escolha um dos funis.</EmptyState>
      </Page>
    );
  }

  const saveRequirement = (req: Requirement) => {
    updatePipeline((p) => ({ ...p, requirements: p.requirements.some((r) => r.id === req.id) ? p.requirements.map((r) => (r.id === req.id ? req : r)) : [...p.requirements, req] }));
    setPanel(null);
  };

  const removeRequirement = (id: string) => {
    updatePipeline((p) => ({ ...p, requirements: p.requirements.filter((r) => r.id !== id) }));
    setPanel(null);
  };

  return (
    <div className="wf-fullscreen">
      <div className="wf-toolbar" style={{ padding: '0 24px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-app)', flex: 'none', zIndex: 10 }}>
        <style>{`.wf-toolbar .page-header { padding: 12px 0; }`}</style>
        <PageHeader
          back={{ label: 'Tarefas', to: '/tarefas' }}
          title={pipeline.name}
          actions={
            <>
              <label className="follow">
                <span className="text-xs text-muted">Seguir um registro:</span>
                <CustomSelect className="select select-sm" value={followId} onChange={(e) => setFollowId(e.target.value)}>
                  <option value="">Nenhum</option>
                  {records.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.kind === 'lead' ? 'lead' : 'oportunidade'})</option>)}
                </CustomSelect>
              </label>
              <button type="button" className="btn" onClick={() => navigate(`/oportunidades/pipelines/${pipeline.id}`)}><Settings size={14} /> Configurar</button>
            </>
          }
        />
      </div>

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
              margin: '16px'
            }}
          />
        </ReactFlow>
      </div>

      {panel && (
        <RequirementPanel
          pipeline={pipeline}
          panel={panel}
          onClose={() => setPanel(null)}
          onSave={saveRequirement}
          onDelete={removeRequirement}
        />
      )}
    </div>
  );
}

export function buildGraph(pipeline: Pipeline, followed: TrackedRecord | null, setPanel: (p: PanelState) => void) {
  const nodes: (StageNodeType | SourceNodeType)[] = [];
  const edges: Edge[] = [];

  const stageIndex = (id: string) => pipeline.stages.findIndex((s) => s.id === id);
  const currentIdx = followed ? stageIndex(followed.stageId) : -1;

  const reqStateFor = (r: Requirement): ReqState | null => {
    if (!followed) return null;
    const idx = stageIndex(r.stageId);
    if (idx < currentIdx) return 'done';
    if (idx === currentIdx) {
      if (followed.done.includes(r.id)) return 'done';
      return r.gate === 'EXIT' ? 'blocking' : 'pending';
    }
    if (idx === currentIdx + 1 && r.gate === 'ENTER' && !followed.done.includes(r.id)) return 'blocking';
    return 'todo';
  };

  const sources: (Source | null)[] = pipeline.sources.length ? pipeline.sources : [null];
  sources.forEach((s, i) => {
    nodes.push({ id: `src-${s?.id ?? 'none'}`, type: 'source', position: { x: 0, y: i * 110 }, data: { source: s }, draggable: false });
  });

  const main = pipeline.stages.filter((s) => s.kind === 'LEAD' || s.kind === 'OPEN');
  const won = pipeline.stages.find((s) => s.kind === 'WON');
  const lost = pipeline.stages.find((s) => s.kind === 'LOST');
  const firstX = 220 + GAP;

  const stageNode = (stage: Stage, x: number, y: number): StageNodeType => {
    const idx = stageIndex(stage.id);
    const reqs = pipeline.requirements.filter((r) => r.stageId === stage.id);
    const state: StageState | null = followed ? (idx < currentIdx ? 'done' : idx === currentIdx ? 'current' : 'todo') : null;
    return {
      id: stage.id, type: 'stage', position: { x, y }, draggable: false,
      data: {
        stage, requirements: reqs, records: pipeline.counts[stage.id] ?? 0, blocked: reqs.reduce((a, r) => a + r.blocked, 0), state,
        reqState: reqStateFor,
        onOpen: (requirement) => setPanel({ mode: 'edit', requirement }),
        onAdd: (st) => setPanel({ mode: 'new', stage: st }),
      },
    };
  };

  main.forEach((s, i) => nodes.push(stageNode(s, firstX + i * (STAGE_W + GAP), 0)));
  const endX = firstX + main.length * (STAGE_W + GAP);
  if (won) nodes.push(stageNode(won, endX, 0));
  if (lost) nodes.push(stageNode(lost, endX, 190));

  const passed = (stageId: string) => followed !== null && stageIndex(stageId) <= currentIdx;
  const edge = (id: string, source: string, target: string, opts: Partial<Edge> = {}, active = false): Edge => ({
    id, source, target, type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed },
    className: active ? 'wf-edge-active' : undefined,
    animated: active,
    ...opts,
  });

  if (main[0]) sources.forEach((s) => edges.push(edge(`e-src-${s?.id ?? 'none'}`, `src-${s?.id ?? 'none'}`, main[0].id, s ? {} : { style: { strokeDasharray: '5 5' } })));
  main.forEach((s, i) => {
    const next = main[i + 1] ?? won;
    if (next) edges.push(edge(`e-${s.id}`, s.id, next.id, {}, passed(next.id)));
  });
  const lastOpen = main[main.length - 1];
  if (lastOpen && lost) edges.push(edge('e-lost', lastOpen.id, lost.id, { style: { strokeDasharray: '5 5' } }));

  return { nodes, edges };
}

function RequirementPanel({ pipeline, panel, onClose, onSave, onDelete }: { pipeline: Pipeline; panel: NonNullable<PanelState>; onClose: () => void; onSave: (r: Requirement) => void; onDelete: (id: string) => void }) {
  const [base] = useState<Requirement>(() =>
    panel.mode === 'edit'
      ? panel.requirement
      : { id: newId('req'), stageId: panel.stage.id, label: '', tag: pipeline.taskTags[0] ?? 'Geral', kind: 'ACTION', gate: 'NONE', blocked: 0, overdue: 0 },
  );
  const stage = pipeline.stages.find((s) => s.id === base.stageId);

  const [label, setLabel] = useState(base.label);
  const [tag, setTag] = useState(base.tag);
  const [kind, setKind] = useState<RequirementKind>(base.kind);
  const [gate, setGate] = useState<RequirementGate>(base.gate);
  const [assignee, setAssignee] = useState(base.assignee ?? '');
  const [dueDays, setDueDays] = useState(base.dueDays === undefined ? '' : String(base.dueDays));

  const valid = label.trim() !== '';
  const tagOptions = pipeline.taskTags.includes(tag) ? pipeline.taskTags : [...pipeline.taskTags, tag];

  return (
    <SidePanel
      title={panel.mode === 'edit' ? 'Requisito da etapa' : 'Nova tarefa'}
      subtitle={`${pipeline.name} · ${stage?.name ?? ''}`}
      onClose={onClose}
      footer={
        <>
          {panel.mode === 'edit' && <button type="button" className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={() => onDelete(base.id)}><Trash2 size={14} /> Excluir</button>}
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn btn-solid" disabled={!valid} onClick={() => onSave({ ...base, label: label.trim(), tag, kind, gate, assignee: assignee.trim() || undefined, dueDays: dueDays === '' ? undefined : Math.max(0, Number(dueDays)) })}>Salvar</button>
        </>
      }
    >
      <div className="form-stack">
        <Field label="Tarefa"><input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex.: Informar CNPJ" autoFocus /></Field>
        <div className="form-grid">
          <Field label="Tag"><CustomSelect className="select" value={tag} onChange={(e) => setTag(e.target.value)}>{tagOptions.map((t) => <option key={t}>{t}</option>)}</CustomSelect></Field>
          <Field label="Tipo"><CustomSelect className="select" value={kind} onChange={(e) => setKind(e.target.value as RequirementKind)}>{(Object.keys(KIND_TEXT) as RequirementKind[]).map((k) => <option key={k} value={k}>{KIND_TEXT[k]}</option>)}</CustomSelect></Field>
        </div>
        <Field label="Efeito na etapa" hint="Impede entrar: o registro não chega a esta etapa sem cumprir a tarefa. Impede sair: não sai daqui sem cumprir.">
          <CustomSelect className="select" value={gate} onChange={(e) => setGate(e.target.value as RequirementGate)}>{(Object.keys(GATE_TEXT) as RequirementGate[]).map((g) => <option key={g} value={g}>{GATE_TEXT[g]}</option>)}</CustomSelect>
        </Field>
        <div className="form-grid">
          <Field label="Responsável"><input className="input" value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Nome ou função" /></Field>
          <Field label="Prazo (dias)"><input className="input" type="number" min={0} value={dueDays} onChange={(e) => setDueDays(e.target.value)} /></Field>
        </div>
      </div>
    </SidePanel>
  );
}
