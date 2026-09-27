import { useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Lifecycle, Step, StepAction, StepPhase } from '../domain';
import { LIFECYCLE_LABEL, actionText } from '../lib/steps';
import { newId, useStore } from '../lib/store';
import { ACTIONS, CATEGORIES, EVENTS } from '../mocks/automations';
import { teamStore } from '../mocks/team';
import { Badge, EmptyState, Field, SidePanel, Switch } from './ui';
import { CustomSelect } from '../components/ui';

// Editor de passos do ciclo de vida. Serve à pipeline (a cópia que roda) e ao template (a receita).
// Um passo liga um evento a uma lista de ações, com condição simples. Sem ramificação.

const PHASE_LABEL: Record<StepPhase, string> = { sale: 'Venda', 'post-sale': 'Pós-venda' };
const FIELD_OPTIONS = [
  { value: 'cnpj', label: 'CNPJ' }, { value: 'cpf', label: 'CPF' }, { value: 'email', label: 'E-mail' },
  { value: 'telefone', label: 'Telefone' }, { value: 'segmento', label: 'Segmento' }, { value: 'valor', label: 'Valor' },
];
const EMAIL_TEMPLATES = ['Boas-vindas (Inbound)', 'Follow-up Reunião', 'Boas-vindas ao cliente'];
const CREATED_EVENTS = ['empresa.criada', 'pessoa.criada'];

const eventLabel = (id: string) => EVENTS.find((e) => e.id === id)?.label ?? id;

type Props = {
  steps: Step[];
  onChange: (steps: Step[]) => void;
  /** Etapas para a condição do passo. Vazio = sem opção de etapa. */
  stageOptions: { value: string; label: string }[];
  /** Quais fases mostrar (o template de pós-venda só tem a segunda). */
  phases: StepPhase[];
  /** Quantos registros já existentes o passo alcançaria. Se dado, pergunta se aplica a eles. */
  existingCount?: (step: Step) => number;
  onApplyExisting?: (step: Step, count: number) => void;
  readOnly?: boolean;
};

export default function StepsEditor({ steps, onChange, stageOptions, phases, existingCount, onApplyExisting, readOnly }: Props) {
  const [editing, setEditing] = useState<{ step: Step; isNew: boolean } | null>(null);
  const [pending, setPending] = useState<{ step: Step; count: number } | null>(null);
  const stageName = (id?: string) => stageOptions.find((o) => o.value === id)?.label ?? id;

  const blank = (phase: StepPhase): Step => ({ id: newId('step'), key: newId('key'), phase, name: '', triggerId: EVENTS[0].id, actions: [{ id: newId('sa'), actionId: 'tarefa.criar', detail: '', delayDays: 0 }], enabled: true });

  const move = (id: string, delta: number) => {
    const i = steps.findIndex((s) => s.id === id);
    const target = i + delta;
    if (i < 0 || target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[i], next[target]] = [next[target], next[i]];
    onChange(next);
  };

  const duplicate = (s: Step) => onChange([...steps, { ...s, id: newId('step'), key: newId('key'), name: `${s.name} (cópia)`, actions: s.actions.map((a) => ({ ...a, id: newId('sa') })) }]);

  const save = (step: Step, isNew: boolean) => {
    onChange(isNew ? [...steps, step] : steps.map((s) => (s.id === step.id ? step : s)));
    setEditing(null);
    const count = existingCount?.(step) ?? 0;
    if (count > 0 && step.enabled) setPending({ step, count });
  };

  return (
    <div>
      {phases.map((phase) => {
        const list = steps.filter((s) => s.phase === phase);
        return (
          <section key={phase} className="steps-phase">
            <div className="pane-head" style={{ marginBottom: '8px' }}>
              <h3 className="section-title" style={{ margin: 0 }}>{PHASE_LABEL[phase]} <span className="tab-count">{list.length}</span></h3>
              {!readOnly && <button type="button" className="btn btn-sm" onClick={() => setEditing({ step: blank(phase), isNew: true })}><Plus size={12} /> Adicionar passo</button>}
            </div>
            {list.length === 0 && <EmptyState title="Nenhum passo">{phase === 'sale' ? 'Sem passos, nada acontece sozinho no funil.' : 'Sem pós-venda encadeado ao ganho.'}</EmptyState>}
            <ul className="step-list">
              {list.map((s) => (
                <li key={s.id} className={`step-card ${s.enabled ? '' : 'is-off'}`}>
                  <div className="step-head">
                    <strong>{s.name || 'Sem nome'}</strong>
                    <div className="step-controls">
                      <Switch checked={s.enabled} onChange={(v) => onChange(steps.map((x) => (x.id === s.id ? { ...x, enabled: v } : x)))} label={`Passo ${s.name} ativo`} />
                      {!readOnly && (
                        <>
                          <button type="button" className="icon-btn bare" onClick={() => move(s.id, -1)} aria-label="Subir"><ArrowUp size={13} /></button>
                          <button type="button" className="icon-btn bare" onClick={() => move(s.id, 1)} aria-label="Descer"><ArrowDown size={13} /></button>
                          <button type="button" className="icon-btn bare" onClick={() => duplicate(s)} aria-label="Duplicar"><Copy size={13} /></button>
                          <button type="button" className="icon-btn bare" onClick={() => setEditing({ step: s, isNew: false })} aria-label="Editar"><Pencil size={13} /></button>
                          <button type="button" className="icon-btn bare" onClick={() => onChange(steps.filter((x) => x.id !== s.id))} aria-label="Excluir"><Trash2 size={13} /></button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="step-when">
                    <span className="step-label">Quando</span>
                    <Badge tone="info">{eventLabel(s.triggerId)}</Badge>
                    {s.stageId && <span className="text-xs text-muted">na etapa <strong>{stageName(s.stageId)}</strong></span>}
                    {s.fieldKey && <span className="text-xs text-muted">campo <strong>{FIELD_OPTIONS.find((f) => f.value === s.fieldKey)?.label ?? s.fieldKey}</strong>{s.onlyIfEmpty ? ' vazio' : ''}</span>}
                  </div>
                  <ul className="step-actions">
                    {s.actions.map((a) => <li key={a.id}><ArrowRight size={12} className="text-muted" /> {actionText(a)}</li>)}
                    {s.actions.length === 0 && <li className="text-muted">Sem ações</li>}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {editing && <StepPanel key={editing.step.id} initial={editing.step} isNew={editing.isNew} phases={phases} stageOptions={stageOptions} onClose={() => setEditing(null)} onSave={(s) => save(s, editing.isNew)} />}

      {pending && (
        <SidePanel
          title="Aplicar aos registros que já existem?"
          subtitle={`O passo "${pending.step.name}" alcança ${pending.count} ${pending.count === 1 ? 'registro' : 'registros'} que já estão no funil.`}
          onClose={() => setPending(null)}
          footer={
            <>
              <button type="button" className="btn" onClick={() => setPending(null)}>Só para os novos</button>
              <button type="button" className="btn btn-solid" onClick={() => { onApplyExisting?.(pending.step, pending.count); setPending(null); }}>Aplicar aos {pending.count}</button>
            </>
          }
        >
          <p className="text-sm">Sem isto, o passo só vale para o que entrar de agora em diante. Aplicando, as ações rodam uma vez para cada registro atual e ficam no registro de execuções.</p>
        </SidePanel>
      )}
    </div>
  );
}

/* ------------------------------ painel do passo ------------------------------ */

function ActionDetail({ action, onChange }: { action: StepAction; onChange: (detail: string) => void }) {
  const [team] = useStore(teamStore);
  switch (action.actionId) {
    case 'ciclo.definir':
      return <CustomSelect className="select" value={action.detail || 'LEAD'} onChange={(e) => onChange(e.target.value)} aria-label="Ciclo de vida">{(Object.keys(LIFECYCLE_LABEL) as Lifecycle[]).map((k) => <option key={k} value={k}>{LIFECYCLE_LABEL[k]}</option>)}</CustomSelect>;
    case 'email.enviar':
      return <CustomSelect className="select" value={action.detail} onChange={(e) => onChange(e.target.value)} aria-label="Modelo"><option value="">Escolha um modelo…</option>{EMAIL_TEMPLATES.map((t) => <option key={t} value={`Modelo: ${t}`}>{t}</option>)}</CustomSelect>;
    case 'responsavel.atribuir':
      return <CustomSelect className="select" value={action.detail} onChange={(e) => onChange(e.target.value)} aria-label="Responsável"><option value="">Escolha…</option>{team.map((m) => <option key={m.id}>{m.name}</option>)}</CustomSelect>;
    case 'tarefa.criar':
      return <input className="input" value={action.detail} onChange={(e) => onChange(e.target.value)} placeholder="Título|Tag  (ex.: Enviar contrato|Comercial)" aria-label="Tarefa" />;
    case 'tarefa.concluir':
      return <input className="input" value={action.detail} onChange={(e) => onChange(e.target.value)} placeholder="Título da tarefa aberta" aria-label="Tarefa" />;
    default:
      return <input className="input" value={action.detail} onChange={(e) => onChange(e.target.value)} placeholder="Detalhe (tag, pessoa a notificar…)" aria-label="Detalhe" />;
  }
}

function StepPanel({ initial, isNew, phases, stageOptions, onClose, onSave }: { initial: Step; isNew: boolean; phases: StepPhase[]; stageOptions: { value: string; label: string }[]; onClose: () => void; onSave: (s: Step) => void }) {
  const [step, setStep] = useState<Step>(initial);
  const patch = (p: Partial<Step>) => setStep((prev) => ({ ...prev, ...p }));
  const setAction = (id: string, change: Partial<StepAction>) => patch({ actions: step.actions.map((a) => (a.id === id ? { ...a, ...change } : a)) });
  const moveAction = (i: number, d: number) => {
    const t = i + d;
    if (t < 0 || t >= step.actions.length) return;
    const next = [...step.actions];
    [next[i], next[t]] = [next[t], next[i]];
    patch({ actions: next });
  };

  const trigger = EVENTS.find((e) => e.id === step.triggerId);
  const needsField = step.triggerId === 'campo.mudou' || CREATED_EVENTS.includes(step.triggerId);
  const valid = step.name.trim() !== '' && step.actions.length > 0 && (step.triggerId !== 'campo.mudou' || Boolean(step.fieldKey));
  const missingDetail = step.actions.some((a) => a.actionId !== 'notificar.equipe' && a.detail.trim() === '');

  return (
    <SidePanel
      title={isNew ? 'Novo passo' : 'Editar passo'}
      subtitle="Quando um evento acontece, o sistema faz estas ações, em ordem."
      onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="button" className="btn btn-solid" disabled={!valid || missingDetail} onClick={() => onSave({ ...step, name: step.name.trim(), fieldKey: needsField ? step.fieldKey : undefined, onlyIfEmpty: needsField && step.triggerId !== 'campo.mudou' ? step.onlyIfEmpty : undefined })}>Salvar passo</button></>}
    >
      <div className="form-stack">
        <Field label="Nome do passo"><input className="input" value={step.name} onChange={(e) => patch({ name: e.target.value })} autoFocus placeholder="Ex.: Follow-up depois da proposta" /></Field>
        {phases.length > 1 && (
          <Field label="Fase"><CustomSelect className="select" value={step.phase} onChange={(e) => patch({ phase: e.target.value as StepPhase })}>{phases.map((p) => <option key={p} value={p}>{PHASE_LABEL[p]}</option>)}</CustomSelect></Field>
        )}
        <Field label="Quando isto acontecer" hint={trigger?.detail}>
          <CustomSelect className="select" value={step.triggerId} onChange={(e) => patch({ triggerId: e.target.value })}>
            {CATEGORIES.map((c) => {
              const items = EVENTS.filter((e) => e.category === c);
              return items.length ? <optgroup key={c} label={c}>{items.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}</optgroup> : null;
            })}
          </CustomSelect>
        </Field>
        {stageOptions.length > 0 && (
          <Field label="Só na etapa" hint="Opcional. Sem escolha, vale em qualquer etapa.">
            <CustomSelect className="select" value={step.stageId ?? ''} onChange={(e) => patch({ stageId: e.target.value || undefined })}><option value="">Qualquer etapa</option>{stageOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</CustomSelect>
          </Field>
        )}
        {needsField && (
          <>
            <Field label="Campo"><CustomSelect className="select" value={step.fieldKey ?? ''} onChange={(e) => patch({ fieldKey: e.target.value || undefined })}><option value="">{step.triggerId === 'campo.mudou' ? 'Escolha o campo…' : 'Qualquer'}</option>{FIELD_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</CustomSelect></Field>
            {step.triggerId !== 'campo.mudou' && step.fieldKey && (
              <label className="check-row"><input type="checkbox" checked={Boolean(step.onlyIfEmpty)} onChange={(e) => patch({ onlyIfEmpty: e.target.checked })} /><span>Só se o campo estiver vazio na criação</span></label>
            )}
          </>
        )}

        <div>
          <div className="pane-head" style={{ marginBottom: '8px' }}>
            <span className="field-label">Então faça (em ordem)</span>
            <button type="button" className="btn btn-sm" onClick={() => patch({ actions: [...step.actions, { id: newId('sa'), actionId: 'notificar.equipe', detail: '', delayDays: 0 }] })}><Plus size={12} /> Ação</button>
          </div>
          <ul className="action-editor">
            {step.actions.map((a, i) => (
              <li key={a.id} className="action-row">
                <div className="action-row-head">
                  <span className="action-index">Ação {i + 1}</span>
                  <div className="row-actions">
                    <button type="button" className="icon-btn bare" disabled={i === 0} onClick={() => moveAction(i, -1)} aria-label="Subir ação"><ArrowUp size={13} /></button>
                    <button type="button" className="icon-btn bare" disabled={i === step.actions.length - 1} onClick={() => moveAction(i, 1)} aria-label="Descer ação"><ArrowDown size={13} /></button>
                    <button type="button" className="icon-btn bare" onClick={() => patch({ actions: step.actions.filter((x) => x.id !== a.id) })} aria-label="Remover ação"><Trash2 size={13} /></button>
                  </div>
                </div>
                <div className="action-row-grid">
                  <Field label="Ação">
                    <CustomSelect className="select" value={a.actionId} onChange={(e) => setAction(a.id, { actionId: e.target.value, detail: e.target.value === 'ciclo.definir' ? 'LEAD' : '' })} aria-label="Ação">
                      {CATEGORIES.map((c) => {
                        const items = ACTIONS.filter((x) => x.category === c);
                        return items.length ? <optgroup key={c} label={c}>{items.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</optgroup> : null;
                      })}
                    </CustomSelect>
                  </Field>
                  <Field label="Detalhe">
                    <ActionDetail action={a} onChange={(detail) => setAction(a.id, { detail })} />
                  </Field>
                </div>
                <label className="action-delay" title={a.actionId === 'tarefa.criar' ? 'Prazo da tarefa, em dias' : 'Espera antes de executar, em dias'}>
                  <span className="text-xs text-muted">{a.actionId === 'tarefa.criar' ? 'Prazo da tarefa' : 'Espera antes de rodar'}</span>
                  <input className="input" type="number" min={0} value={a.delayDays} onChange={(e) => setAction(a.id, { delayDays: Math.max(0, Number(e.target.value)) })} aria-label="Dias" />
                  <span className="text-xs text-muted">{a.delayDays === 1 ? 'dia' : 'dias'}</span>
                </label>
              </li>
            ))}
          </ul>
          {step.actions.length === 0 && <p className="text-xs text-muted">Inclua ao menos uma ação.</p>}
          {missingDetail && <p className="text-xs" style={{ color: '#d97706' }}>Preencha o detalhe de cada ação.</p>}
        </div>
      </div>
    </SidePanel>
  );
}
