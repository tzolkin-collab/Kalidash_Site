import { useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, CircleDot, FileInput, Lock, Pencil, Plug, Plus, Trash2, Upload, X } from 'lucide-react';
import type { Pipeline, Requirement, Source, SourceType, Stage, StageKind } from '../domain';
import { Badge, Switch } from './ui';

// Estrutura do funil, na lateral do workflow: lista os três tipos de nó (fontes, etapas e tarefas), deixa ver o
// que cada um tem, criar e remover direto daqui, e levar a tela até o nó. É o painel que fica aberto enquanto se
// arrasta e dá zoom no canvas.

const SOURCE_ICON: Record<SourceType, ReactNode> = {
  FORM: <Plug size={13} />,
  MANUAL: <Pencil size={13} />,
  IMPORT: <Upload size={13} />,
  API: <Plug size={13} />,
};
const SOURCE_TYPE: Record<SourceType, string> = { FORM: 'Formulário', MANUAL: 'Cadastro manual', IMPORT: 'Importação', API: 'API' };
const STAGE_KIND: Record<StageKind, string> = { LEAD: 'Lead', OPEN: 'Aberta', WON: 'Ganha', LOST: 'Perdida' };
const GATE_SHORT = { NONE: '', ENTER: 'Impede entrar', EXIT: 'Impede sair' } as const;

export type InspectorSelection = { stageId?: string; reqId?: string; sourceId?: string };

export type InspectorProps = {
  pipeline: Pipeline;
  selection: InspectorSelection;
  onFocusNode: (nodeId: string) => void;
  onNewSource: () => void;
  onOpenSource: (s: Source) => void;
  onToggleSource: (s: Source, active: boolean) => void;
  onRemoveSource: (s: Source) => void;
  onNewStage: () => void;
  onOpenStage: (s: Stage) => void;
  onMoveStage: (id: string, delta: number) => void;
  onRemoveStage: (s: Stage) => void;
  onNewRequirement: (s: Stage) => void;
  onOpenRequirement: (r: Requirement) => void;
  onRemoveRequirement: (r: Requirement) => void;
};

/** Lixeira com confirmação na própria linha: um clique pergunta, o segundo remove. */
function TrashButton({ label, warning, disabled, disabledHint, onConfirm }: { label: string; warning?: string; disabled?: boolean; disabledHint?: string; onConfirm: () => void }) {
  const [asking, setAsking] = useState(false);
  if (asking) {
    return (
      <span className="insp-confirm" role="group" aria-label={`Confirmar remoção de ${label}`}>
        <button type="button" className="btn btn-sm btn-danger" title={warning} onClick={() => { setAsking(false); onConfirm(); }}>Remover</button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setAsking(false)} aria-label="Cancelar"><X size={12} /></button>
      </span>
    );
  }
  return (
    <button type="button" className="icon-btn bare" disabled={disabled} title={disabled ? disabledHint : `Remover ${label}`} aria-label={`Remover ${label}`} onClick={() => setAsking(true)}>
      <Trash2 size={13} />
    </button>
  );
}

function Section({ title, count, onAdd, addLabel, children, defaultOpen = true }: { title: string; count: number; onAdd?: () => void; addLabel?: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="insp-section">
      <header className="insp-section-head">
        <button type="button" className="insp-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span>{title}</span>
          <span className="tab-count">{count}</span>
        </button>
        {onAdd && <button type="button" className="btn btn-sm" onClick={onAdd}><Plus size={12} /> {addLabel ?? 'Adicionar'}</button>}
      </header>
      {open && <div className="insp-section-body">{children}</div>}
    </section>
  );
}

export default function WorkflowInspector(p: InspectorProps) {
  const { pipeline, selection } = p;
  const lastOf = (k: StageKind) => pipeline.stages.filter((s) => s.kind === k).length <= 1;
  const reqsOf = (stageId: string) => pipeline.requirements.filter((r) => r.stageId === stageId);

  return (
    <div className="insp">
      <Section title="Fontes" count={pipeline.sources.length} onAdd={p.onNewSource} addLabel="Nova fonte">
        {pipeline.sources.length === 0 && <p className="insp-empty">Sem fonte, nenhum lead chega sozinho. Conecte um formulário ou cadastre à mão.</p>}
        {pipeline.sources.map((s) => (
          <div key={s.id} className={`insp-row ${selection.sourceId === s.id ? 'is-selected' : ''}`}>
            <button type="button" className="insp-main" onClick={() => { p.onFocusNode(`src-${s.id}`); p.onOpenSource(s); }}>
              <span className="insp-icon">{SOURCE_ICON[s.type]}</span>
              <span className="insp-text">
                <span className="insp-title">{s.name}</span>
                <span className="insp-meta">{SOURCE_TYPE[s.type]}{s.project ? ` · ${s.project}` : ''}</span>
              </span>
            </button>
            <Switch checked={s.active} onChange={(v) => p.onToggleSource(s, v)} label={`Fonte ${s.name} ativa`} />
            <TrashButton label={s.name} warning="A automação criada por esta fonte também é removida." onConfirm={() => p.onRemoveSource(s)} />
          </div>
        ))}
      </Section>

      <Section title="Etapas" count={pipeline.stages.length} onAdd={p.onNewStage} addLabel="Nova etapa">
        {pipeline.stages.map((st, i) => {
          const records = pipeline.counts[st.id] ?? 0;
          const blocked = records > 0 ? 'Mova os registros antes de excluir a etapa' : (st.kind === 'WON' || st.kind === 'LOST') && lastOf(st.kind) ? 'O funil precisa de ao menos uma etapa Ganha e uma Perdida' : undefined;
          return (
            <div key={st.id} className={`insp-row ${selection.stageId === st.id && !selection.reqId ? 'is-selected' : ''}`}>
              <button type="button" className="insp-main" onClick={() => { p.onFocusNode(st.id); p.onOpenStage(st); }}>
                <span className="mini-dot" style={{ background: st.color }} />
                <span className="insp-text">
                  <span className="insp-title">{st.name}</span>
                  <span className="insp-meta">{STAGE_KIND[st.kind]} · {records} {records === 1 ? 'registro' : 'registros'} · {reqsOf(st.id).length} {reqsOf(st.id).length === 1 ? 'tarefa' : 'tarefas'}</span>
                </span>
              </button>
              <span className="insp-order">
                <button type="button" className="icon-btn bare" disabled={i === 0} onClick={() => p.onMoveStage(st.id, -1)} aria-label={`Subir ${st.name}`}><ArrowUp size={12} /></button>
                <button type="button" className="icon-btn bare" disabled={i === pipeline.stages.length - 1} onClick={() => p.onMoveStage(st.id, 1)} aria-label={`Descer ${st.name}`}><ArrowDown size={12} /></button>
              </span>
              <TrashButton label={st.name} warning="As tarefas desta etapa também são removidas." disabled={Boolean(blocked)} disabledHint={blocked} onConfirm={() => p.onRemoveStage(st)} />
            </div>
          );
        })}
      </Section>

      <Section title="Tarefas" count={pipeline.requirements.length}>
        {pipeline.stages.map((st) => {
          const list = reqsOf(st.id);
          const canAdd = st.kind === 'LEAD' || st.kind === 'OPEN';
          if (list.length === 0 && !canAdd) return null;
          return (
            <div key={st.id} className="insp-group">
              <div className="insp-group-head">
                <span className="mini-dot" style={{ background: st.color }} />
                <span className="insp-group-name">{st.name}</span>
                {canAdd && <button type="button" className="btn btn-sm btn-ghost" onClick={() => p.onNewRequirement(st)}><Plus size={12} /> Tarefa</button>}
              </div>
              {list.length === 0 && <p className="insp-empty">Nenhuma tarefa nesta etapa.</p>}
              {list.map((r) => (
                <div key={r.id} className={`insp-row ${selection.reqId === r.id ? 'is-selected' : ''}`}>
                  <button type="button" className="insp-main" onClick={() => { p.onFocusNode(st.id); p.onOpenRequirement(r); }}>
                    <span className="insp-icon">{r.kind === 'FIELD' ? <FileInput size={13} /> : <CircleDot size={13} />}</span>
                    <span className="insp-text">
                      <span className="insp-title">{r.label}</span>
                      <span className="insp-meta">
                        {r.tag}{r.assignee ? ` · ${r.assignee}` : ''}{r.dueDays !== undefined ? ` · ${r.dueDays} d` : ''}
                      </span>
                    </span>
                  </button>
                  {r.gate !== 'NONE' && <Badge tone="warning" title={GATE_SHORT[r.gate]}><Lock size={10} /> {r.gate === 'ENTER' ? 'Entrar' : 'Sair'}</Badge>}
                  <TrashButton label={r.label} warning={r.linkedAutomationId ? 'A automação ligada a esta tarefa também é removida.' : undefined} onConfirm={() => p.onRemoveRequirement(r)} />
                </div>
              ))}
            </div>
          );
        })}
      </Section>
    </div>
  );
}
