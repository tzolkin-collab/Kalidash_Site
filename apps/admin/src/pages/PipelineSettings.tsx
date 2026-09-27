import { useEffect, useMemo, useState } from 'react';
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Bell, ExternalLink, Link2, Plus, Sparkles, Trash2, X } from 'lucide-react';
import type { CustomField, CustomFieldType, Pipeline, Requirement, RequirementGate, Source, SourceType, Stage, StageKind, Step } from '../domain';
import { setArchived } from '../lib/edit';
import { newId, useStore } from '../lib/store';
import { useShell } from '../lib/shell';
import { applyDiff, diffWithTemplate } from '../lib/pipelineTemplate';
import type { StepDiff } from '../lib/pipelineTemplate';
import { EVENTS, automationsStore } from '../mocks/automations';
import type { AutomationRow } from '../mocks/automations';
import { contactTagsStore } from '../mocks/people';
import { pipelinesStore } from '../mocks/pipelines';
import { projectsStore } from '../mocks/projects';
import { templatesStore } from '../mocks/templates';
import StepsEditor from '../components/StepsEditor';
import { Badge, EmptyState, Field, Page, PageHeader, SampleBanner, SidePanel, Switch, Tabs } from '../components/ui';
import { CustomSelect } from '../components/ui';

type Tab = 'general' | 'stages' | 'sources' | 'tasks' | 'lifecycle' | 'fields' | 'tags';
type Patch = (fn: (p: Pipeline) => Pipeline) => void;

const KIND_LABEL: Record<StageKind, string> = { LEAD: 'Lead', OPEN: 'Aberta', WON: 'Ganha', LOST: 'Perdida' };
const GATE_LABEL: Record<RequirementGate, string> = { NONE: 'Só pendência', ENTER: 'Impede entrar', EXIT: 'Impede sair' };
const SOURCE_TYPE_LABEL: Record<SourceType, string> = { FORM: 'Formulário conectado', MANUAL: 'Cadastro manual', IMPORT: 'Importação de planilha', API: 'API' };
const FIELD_TYPE_LABEL: Record<CustomFieldType, string> = { text: 'Texto', number: 'Número', date: 'Data', select: 'Lista de opções', boolean: 'Sim ou não' };

/** Campos do cadastro que dá para marcar como tarefa. */
const SYSTEM_FIELDS = ['Nome do contato', 'E-mail', 'Telefone', 'CPF ou CNPJ', 'Empresa', 'Valor da oportunidade', 'Prioridade', 'Dono da oportunidade'];

const slugify = (label: string) => label.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export default function PipelineSettings({ pipelineId }: { pipelineId?: string }) {
  const { navigate } = useShell();
  const [pipelines, setPipelines] = useStore(pipelinesStore);
  const [tab, setTab] = useState<Tab>('general');
  const [showArchived, setShowArchived] = useState(false);
  /** Campo que veio de "Tornar obrigatório" em Campos personalizados — abre Tarefas já com ele escolhido. */
  const [presetField, setPresetField] = useState<string | undefined>(undefined);

  const visible = useMemo(() => pipelines.filter((p) => showArchived || !p.archivedAt || p.id === pipelineId), [pipelines, showArchived, pipelineId]);
  const pipeline = pipelines.find((p) => p.id === pipelineId) ?? visible[0];
  const patch: Patch = (fn) => setPipelines((prev) => prev.map((p) => (p.id === pipeline?.id ? fn(p) : p)));

  const tabs: { id: Tab; label: string; count?: number }[] = pipeline
    ? [
        { id: 'general', label: 'Geral' },
        { id: 'stages', label: 'Etapas', count: pipeline.stages.length },
        { id: 'sources', label: 'Fontes', count: pipeline.sources.length },
        { id: 'tasks', label: 'Tarefas', count: pipeline.requirements.length },
        { id: 'lifecycle', label: 'Passos automáticos', count: pipeline.steps.length },
        { id: 'fields', label: 'Campos personalizados', count: pipeline.customFields.length },
        { id: 'tags', label: 'Tags' },
      ]
    : [];

  return (
    <Page>
      <PageHeader
        back={{ label: 'Oportunidades', to: '/oportunidades' }}
        title="Configurações das pipelines"
        subtitle="Ver, editar, arquivar e criar pipelines. Cada pipeline é um funil, ligado a uma oferta."
        actions={<button type="button" className="btn btn-solid" onClick={() => navigate('/oportunidades/pipelines/nova')}><Plus size={14} /> Nova pipeline</button>}
      />
      <SampleBanner phase={1}>As pipelines ainda vivem no código do front. As mudanças abaixo valem até recarregar a página.</SampleBanner>

      <div className="settings-layout">
        <nav className="pipe-list" aria-label="Pipelines">
          {visible.map((p) => {
            const total = Object.values(p.counts).reduce((a, b) => a + b, 0);
            return (
              <button key={p.id} type="button" className={`pipe-item ${p.id === pipeline?.id ? 'active' : ''} ${p.archivedAt ? 'is-archived' : ''}`} onClick={() => { navigate(`/oportunidades/pipelines/${p.id}`); setTab('general'); }}>
                <span className="cell-primary">{p.name}{p.archivedAt && <Badge tone="danger">Arquivada</Badge>}</span>
                <span className="text-xs text-muted">{p.offer} · {total} registros</span>
              </button>
            );
          })}
          <label className="check-inline" style={{ padding: '6px 4px' }}>
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Mostrar arquivadas
          </label>
        </nav>

        {!pipeline ? (
          <EmptyState title="Nenhuma pipeline">Crie a primeira com "Nova pipeline".</EmptyState>
        ) : (
          <section className="settings-detail" key={pipeline.id}>
            <Tabs tabs={tabs} value={tab} onChange={setTab} />
            {tab === 'general' && <GeneralTab pipeline={pipeline} patch={patch} onArchived={() => navigate('/oportunidades/pipelines')} />}
            {tab === 'stages' && <StagesTab pipeline={pipeline} patch={patch} />}
            {tab === 'sources' && <SourcesTab pipeline={pipeline} patch={patch} />}
            {tab === 'tasks' && <TasksTab pipeline={pipeline} patch={patch} presetField={presetField} onConsumePreset={() => setPresetField(undefined)} />}
            {tab === 'lifecycle' && <LifecycleTab pipeline={pipeline} patch={patch} />}
            {tab === 'fields' && <FieldsTab pipeline={pipeline} patch={patch} onMarkRequired={(fieldLabel) => { setPresetField(fieldLabel); setTab('tasks'); }} />}
            {tab === 'tags' && <TagsTab pipeline={pipeline} patch={patch} />}
          </section>
        )}
      </div>
    </Page>
  );
}

/* ------------------------------ Geral ------------------------------ */

function GeneralTab({ pipeline, patch, onArchived }: { pipeline: Pipeline; patch: Patch; onArchived: () => void }) {
  const byKind = (kinds: StageKind[]) => pipeline.stages.filter((s) => kinds.includes(s.kind)).reduce((a, s) => a + (pipeline.counts[s.id] ?? 0), 0);
  const opportunities = byKind(['OPEN', 'WON', 'LOST']);
  const leads = byKind(['LEAD']);

  return (
    <div className="form-stack settings-pane">
      <div className="form-grid">
        <Field label="Nome da pipeline"><input className="input" value={pipeline.name} onChange={(e) => patch((p) => ({ ...p, name: e.target.value }))} /></Field>
        <Field label="Oferta" hint="Uma pipeline é um funil, e cada funil vende uma oferta."><input className="input" value={pipeline.offer} onChange={(e) => patch((p) => ({ ...p, offer: e.target.value }))} /></Field>
      </div>

      <div className="danger-zone">
        <div>
          <strong>{pipeline.archivedAt ? 'Pipeline arquivada' : 'Arquivar pipeline'}</strong>
          <p className="text-sm text-muted" style={{ margin: '4px 0 0' }}>
            {pipeline.archivedAt
              ? 'Some do seletor e de Nova Oportunidade. Os registros continuam existindo.'
              : opportunities > 0 || leads > 0
                ? `Tem ${opportunities} ${opportunities === 1 ? 'oportunidade' : 'oportunidades'} e ${leads} ${leads === 1 ? 'lead' : 'leads'}. Arquivar não mexe neles, só tira a pipeline do seletor.`
                : 'Nada está em andamento nesta pipeline.'}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => { setArchived(pipelinesStore, 'pipeline', pipeline.id, pipeline.name, !pipeline.archivedAt); if (!pipeline.archivedAt) onArchived(); }}
        >
          {pipeline.archivedAt ? <><ArchiveRestore size={14} /> Restaurar</> : <><Archive size={14} /> Arquivar</>}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------ Etapas ------------------------------ */

function StagesTab({ pipeline, patch }: { pipeline: Pipeline; patch: Patch }) {
  const setStage = (id: string, change: Partial<Stage>) => patch((p) => ({ ...p, stages: p.stages.map((s) => (s.id === id ? { ...s, ...change } : s)) }));

  const move = (index: number, delta: number) =>
    patch((p) => {
      const target = index + delta;
      if (target < 0 || target >= p.stages.length) return p;
      const stages = [...p.stages];
      [stages[index], stages[target]] = [stages[target], stages[index]];
      return { ...p, stages };
    });

  const add = () =>
    patch((p) => {
      const stage: Stage = { id: `${p.id}:${newId('st')}`, name: 'Nova etapa', kind: 'OPEN', color: '#64748b', probability: 50, alertDays: 7 };
      const at = p.stages.findIndex((s) => s.kind === 'WON' || s.kind === 'LOST');
      const stages = [...p.stages];
      stages.splice(at === -1 ? stages.length : at, 0, stage);
      return { ...p, stages, counts: { ...p.counts, [stage.id]: 0 } };
    });

  const remove = (stage: Stage) => patch((p) => ({ ...p, stages: p.stages.filter((s) => s.id !== stage.id), requirements: p.requirements.filter((r) => r.stageId !== stage.id) }));

  const countKind = (k: StageKind) => pipeline.stages.filter((s) => s.kind === k).length;

  return (
    <div className="settings-pane">
      <p className="section-sub">As etapas seguem esta ordem no funil. Etapas do tipo Lead formam as colunas de leads.</p>
      <div className="table-card">
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th style={{ width: '70px' }}>Ordem</th><th>Nome</th><th>Tipo</th><th>Cor</th><th>Probabilidade</th><th>Alerta (dias)</th><th>Registros</th><th style={{ width: '48px' }}></th></tr></thead>
            <tbody>
              {pipeline.stages.map((s, i) => {
                const count = pipeline.counts[s.id] ?? 0;
                const lastOfKind = (s.kind === 'WON' || s.kind === 'LOST') && countKind(s.kind) <= 1;
                const open = s.kind === 'OPEN';
                return (
                  <tr key={s.id}>
                    <td>
                      <div className="row-actions" style={{ justifyContent: 'flex-start' }}>
                        <button type="button" className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Subir ${s.name}`}><ArrowUp size={13} /></button>
                        <button type="button" className="icon-btn" disabled={i === pipeline.stages.length - 1} onClick={() => move(i, 1)} aria-label={`Descer ${s.name}`}><ArrowDown size={13} /></button>
                      </div>
                    </td>
                    <td><input className="input" value={s.name} onChange={(e) => setStage(s.id, { name: e.target.value })} aria-label="Nome da etapa" /></td>
                    <td>
                      <CustomSelect className="select" value={s.kind} onChange={(e) => setStage(s.id, { kind: e.target.value as StageKind })} aria-label="Tipo da etapa">
                        {(Object.keys(KIND_LABEL) as StageKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                      </CustomSelect>
                    </td>
                    <td><input type="color" className="color-input" value={s.color} onChange={(e) => setStage(s.id, { color: e.target.value })} aria-label="Cor da etapa" /></td>
                    <td>
                      {open ? (
                        <div className="prob-cell" title="Chance de ganhar a oportunidade enquanto ela está nesta etapa. Ajuda o time a decidir onde focar.">
                          <div className="prob-input-wrap">
                            <input className="input input-narrow" type="number" min={0} max={100} value={s.probability ?? 0} onChange={(e) => setStage(s.id, { probability: Math.min(100, Math.max(0, Number(e.target.value))) })} aria-label="Probabilidade de ganhar, em %" />
                            <span className="prob-suffix">%</span>
                          </div>
                          <div className="prob-bar" aria-hidden="true"><div className="prob-bar-fill" style={{ width: `${Math.min(100, Math.max(0, s.probability ?? 0))}%` }} /></div>
                        </div>
                      ) : <span className="text-muted">—</span>}
                    </td>
                    <td>{open ? <input className="input input-narrow" type="number" min={1} value={s.alertDays ?? ''} onChange={(e) => setStage(s.id, { alertDays: e.target.value === '' ? undefined : Math.max(1, Number(e.target.value)) })} aria-label="Dias para alerta" /> : <span className="text-muted">—</span>}</td>
                    <td className="text-muted">{count}</td>
                    <td>
                      <button type="button" className="icon-btn bare" disabled={count > 0 || lastOfKind} onClick={() => remove(s)} title={count > 0 ? 'Mova os registros antes de excluir a etapa' : lastOfKind ? 'A pipeline precisa de uma etapa Ganha e uma Perdida' : 'Excluir etapa'} aria-label={`Excluir ${s.name}`}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <button type="button" className="btn" style={{ marginTop: '12px' }} onClick={add}><Plus size={14} /> Adicionar etapa</button>
    </div>
  );
}

/* ------------------------------ Fontes ------------------------------ */

function SourcesTab({ pipeline, patch }: { pipeline: Pipeline; patch: Patch }) {
  const [, setAutomations] = useStore(automationsStore);
  const [connecting, setConnecting] = useState(false);

  const managedBy = (s: Source) => `Conectar fonte: ${s.name}`;
  const remove = (s: Source) => {
    patch((p) => ({ ...p, sources: p.sources.filter((x) => x.id !== s.id) }));
    setAutomations((prev) => prev.filter((a) => a.managedBy !== managedBy(s)));
  };
  const setActive = (s: Source, active: boolean) => patch((p) => ({ ...p, sources: p.sources.map((x) => (x.id === s.id ? { ...x, active } : x)) }));

  return (
    <div className="settings-pane">
      <div className="pane-head">
        <p className="section-sub" style={{ margin: 0 }}>De onde chegam os leads deste funil. Uma pipeline pode ter várias fontes; cada formulário alimenta uma só pipeline.</p>
        <button type="button" className="btn btn-solid" onClick={() => setConnecting(true)}><Link2 size={14} /> Conectar fonte</button>
      </div>

      {pipeline.sources.length === 0 ? (
        <EmptyState title="Este funil está sem fonte">Sem fonte nenhum lead chega sozinho. Conecte um formulário ou cadastre leads à mão.</EmptyState>
      ) : (
        <ul className="row-list">
          {pipeline.sources.map((s) => (
            <li key={s.id} className="row-item">
              <div className="cell-stack">
                <span className="cell-primary">{s.name}</span>
                <span className="text-xs text-muted">{SOURCE_TYPE_LABEL[s.type]}{s.project ? ` · ${s.project}` : ''}</span>
              </div>
              {s.type !== 'MANUAL' && <Badge tone="accent" title="Cria uma automação gerenciada em Automações"><Link2 size={10} /> Automação</Badge>}
              <Switch checked={s.active} onChange={(v) => setActive(s, v)} label={`Fonte ${s.name} ativa`} />
              <button type="button" className="icon-btn bare" onClick={() => remove(s)} aria-label={`Remover ${s.name}`}><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
      )}

      {connecting && <ConnectSourcePanel pipeline={pipeline} onClose={() => setConnecting(false)} onConnect={(s) => { patch((p) => ({ ...p, sources: [...p.sources, s] })); setConnecting(false); }} />}
    </div>
  );
}

function ConnectSourcePanel({ pipeline, onClose, onConnect }: { pipeline: Pipeline; onClose: () => void; onConnect: (s: Source) => void }) {
  const [projects] = useStore(projectsStore);
  const [pipelines] = useStore(pipelinesStore);
  const [, setAutomations] = useStore(automationsStore);
  const [type, setType] = useState<SourceType>('FORM');
  const [formId, setFormId] = useState('');
  const [name, setName] = useState('');

  const forms = useMemo(() => projects.flatMap((pr) => pr.forms.map((f) => ({ form: f, project: pr }))), [projects]);
  const usedBy = (id: string) => pipelines.find((p) => p.sources.some((s) => s.formId === id));
  const picked = forms.find((f) => f.form.id === formId);
  const formModule = picked?.project.modules.find((m) => m.name === 'Formulário');

  const valid = type === 'FORM' ? formId !== '' && !usedBy(formId) : name.trim() !== '';

  const connect = () => {
    const source: Source = type === 'FORM' && picked
      ? { id: newId('src'), name: name.trim() || picked.form.name, type, project: picked.project.name, formId: picked.form.id, active: true }
      : { id: newId('src'), name: name.trim(), type, active: true };
    if (type !== 'MANUAL') {
      setAutomations((prev) => [{
        id: newId('au'), name: `Criar lead a partir de "${source.name}"`, category: 'Fontes', trigger: 'Formulário enviado', action: 'Criar lead',
        triggerId: 'formulario.enviado', actionId: 'lead.criar', detail: `Pipeline ${pipeline.name}, etapa Novos`, pipeline: pipeline.name,
        origin: 'MANAGED', managedBy: `Conectar fonte: ${source.name}`, active: true, runs: 0,
      }, ...prev]);
    }
    onConnect(source);
  };

  return (
    <SidePanel
      title="Conectar fonte"
      subtitle={`Alimenta a pipeline ${pipeline.name}. Uma automação simples de criação de leads nasce por trás dos panos.`}
      onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="button" className="btn btn-solid" disabled={!valid} onClick={connect}>Conectar</button></>}
    >
      <div className="form-stack">
        <Field label="Tipo de fonte">
          <CustomSelect className="select" value={type} onChange={(e) => { setType(e.target.value as SourceType); setFormId(''); }}>
            {(Object.keys(SOURCE_TYPE_LABEL) as SourceType[]).map((t) => <option key={t} value={t}>{SOURCE_TYPE_LABEL[t]}</option>)}
          </CustomSelect>
        </Field>
        {type === 'FORM' ? (
          <>
            <Field label="Formulário rastreado" hint="Vem dos projetos conectados. O formulário passa a criar leads nesta pipeline.">
              <CustomSelect className="select" value={formId} onChange={(e) => setFormId(e.target.value)}>
                <option value="">Escolha um formulário…</option>
                {forms.map(({ form, project }) => {
                  const other = usedBy(form.id);
                  return <option key={form.id} value={form.id} disabled={Boolean(other)}>{project.name} › {form.name}{other ? ` (já alimenta ${other.name})` : ''}</option>;
                })}
              </CustomSelect>
            </Field>
            {formModule && formModule.status !== 'ACTIVE' && (
              <div className="task-callout" role="status"><span>O módulo Formulário deste projeto está {formModule.status === 'PENDING' ? 'pendente' : 'com erro'}. A fonte vai valer quando ele ficar ativo.</span></div>
            )}
            <Field label="Nome da fonte" hint="Opcional. Sem nome, usa o do formulário."><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <a className="link-inline" href="#/projetos"><ExternalLink size={12} /> Ainda não conectou o formulário? Vá em Projetos conectados</a>
          </>
        ) : (
          <Field label="Nome da fonte"><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
        )}
      </div>
    </SidePanel>
  );
}

/* ------------------------------ Tarefas (D9: caminho simples e avançado) ------------------------------ */

function TasksTab({ pipeline, patch, presetField, onConsumePreset }: { pipeline: Pipeline; patch: Patch; presetField?: string; onConsumePreset?: () => void }) {
  const { navigate } = useShell();
  const [automations, setAutomations] = useStore(automationsStore);
  const [marking, setMarking] = useState(false);
  const [markField, setMarkField] = useState<string | undefined>(undefined);
  const stageName = (id: string) => pipeline.stages.find((s) => s.id === id)?.name ?? '—';

  // Veio de "Tornar obrigatório" em Campos personalizados: abre o painel já com o campo escolhido.
  useEffect(() => {
    if (!presetField) return;
    setMarkField(presetField);
    setMarking(true);
    onConsumePreset?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetField]);

  const remove = (r: Requirement) => {
    patch((p) => ({ ...p, requirements: p.requirements.filter((x) => x.id !== r.id) }));
    if (r.linkedAutomationId) setAutomations((prev) => prev.filter((a) => a.id !== r.linkedAutomationId));
  };

  const linkAutomation = (requirementId: string, automationId: string) => patch((p) => ({ ...p, requirements: p.requirements.map((r) => (r.id === requirementId ? { ...r, linkedAutomationId: automationId } : r)) }));

  return (
    <div className="settings-pane">
      <div className="pane-head">
        <p className="section-sub" style={{ margin: 0 }}>Requisitos de cada etapa. Todo funil nasce com o template padrão (CNPJ e fonte); dá para marcar qualquer campo como tarefa. Tarefa não é automação (D9) — ela só oferece criar uma, já pronta.</p>
        <div className="row-actions">
          <button type="button" className="btn" onClick={() => navigate(`/tarefas/${pipeline.id}`)}><ExternalLink size={14} /> Ver no workflow</button>
          <button type="button" className="btn btn-solid" onClick={() => setMarking(true)}><Plus size={14} /> Marcar campo como tarefa</button>
        </div>
      </div>
      <div className="table-card">
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Tarefa</th><th>Etapa</th><th>Tag</th><th>Efeito</th><th>Responsável</th><th>Prazo</th><th>Avisos</th><th style={{ width: '48px' }}></th></tr></thead>
            <tbody>
              {pipeline.requirements.map((r) => {
                const linked = automations.find((a) => a.id === r.linkedAutomationId);
                return (
                  <tr key={r.id}>
                    <td><span className="cell-primary">{r.label}</span><div className="text-xs text-muted">{r.kind === 'FIELD' ? 'Campo do cadastro' : 'Ação'}</div></td>
                    <td>{stageName(r.stageId)}</td>
                    <td><Badge tone="accent">{r.tag}</Badge></td>
                    <td><Badge tone={r.gate === 'NONE' ? 'neutral' : 'warning'}>{GATE_LABEL[r.gate]}</Badge></td>
                    <td>{r.assignee ?? <span className="text-muted">—</span>}</td>
                    <td>{r.dueDays !== undefined ? `${r.dueDays} d` : <span className="text-muted">—</span>}</td>
                    <td>
                      <div className="tag-row">
                        {r.notifyAssignee && <Badge tone="info" title="Notifica o responsável por push quando a tarefa nasce"><Bell size={10} /> Push</Badge>}
                        {linked && <Badge tone="accent" title={linked.trigger}><Link2 size={10} /> Automação</Badge>}
                      </div>
                    </td>
                    <td><button type="button" className="icon-btn bare" onClick={() => remove(r)} aria-label={`Excluir ${r.label}`}><Trash2 size={14} /></button></td>
                  </tr>
                );
              })}
              {pipeline.requirements.length === 0 && <tr><td colSpan={8}><EmptyState title="Sem tarefas">Marque um campo como tarefa para começar.</EmptyState></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {marking && (
        <MarkTaskPanel
          pipeline={pipeline}
          initialField={markField}
          onClose={() => setMarking(false)}
          onSave={(r) => { patch((p) => ({ ...p, requirements: [...p.requirements, r] })); }}
          onAutomationCreated={linkAutomation}
        />
      )}
    </div>
  );
}

/** Eventos que fazem sentido para UMA tarefa específica: os dela, nada mais. */
const taskEvents = (hasDueDays: boolean) => EVENTS.filter((e) => ['tarefa.criada', 'tarefa.atrasada', 'tarefa.concluida'].includes(e.id) && (e.id !== 'tarefa.atrasada' || hasDueDays));

function MarkTaskPanel({ pipeline, initialField, onClose, onSave, onAutomationCreated }: { pipeline: Pipeline; initialField?: string; onClose: () => void; onSave: (r: Requirement) => void; onAutomationCreated: (requirementId: string, automationId: string) => void }) {
  const [, setAutomations] = useStore(automationsStore);
  const stages = pipeline.stages.filter((s) => s.kind === 'LEAD' || s.kind === 'OPEN');
  const [screen, setScreen] = useState<'form' | 'offer'>('form');
  const [saved, setSaved] = useState<Requirement | null>(null);

  const [field, setField] = useState(initialField ?? '');
  // Travar a 1ª etapa é inútil: o lead já nasce nela, o ENTER nunca é avaliado. "Tornar obrigatório"
  // por isso mira a 2ª — a 1ª transição real que passa pelo gate.
  const [stageId, setStageId] = useState((initialField ? stages[1] ?? stages[0] : stages[0])?.id ?? '');
  // Veio de "Tornar obrigatório": o motivo de vir aqui é travar a etapa, então já nasce como gate.
  const [gate, setGate] = useState<RequirementGate>(initialField ? 'ENTER' : 'NONE');
  const [tag, setTag] = useState(pipeline.taskTags[0] ?? 'Geral');
  const [assignee, setAssignee] = useState('');
  const [dueDays, setDueDays] = useState('');
  const [notifyAssignee, setNotifyAssignee] = useState(false);

  const [event, setEvent] = useState('tarefa.criada');
  const events = taskEvents(dueDays !== '');

  const confirm = () => {
    const req: Requirement = {
      id: newId('req'), stageId, label: `Informar ${field}`, tag, kind: 'FIELD', gate,
      assignee: assignee.trim() || undefined, dueDays: dueDays === '' ? undefined : Math.max(0, Number(dueDays)),
      notifyAssignee: notifyAssignee && assignee.trim() !== '', blocked: 0, overdue: 0,
    };
    onSave(req);
    setSaved(req);
    setScreen('offer');
  };

  const createAutomation = () => {
    if (!saved) return;
    const ev = events.find((e) => e.id === event) ?? events[0];
    const automation: AutomationRow = {
      id: newId('au'), name: `${saved.label}: notificar quando ${ev.label.toLowerCase()}`, category: 'Pendências',
      trigger: ev.label, action: 'Notificar alguém da equipe', triggerId: ev.id, actionId: 'notificar.equipe',
      detail: saved.assignee || 'Responsável pela tarefa', pipeline: pipeline.name,
      origin: 'MANAGED', managedBy: `Tarefa: ${saved.label}`, active: true, runs: 0,
    };
    setAutomations((prev) => [automation, ...prev]);
    onAutomationCreated(saved.id, automation.id);
    onClose();
  };

  if (screen === 'offer' && saved) {
    return (
      <SidePanel
        title="Quer avisar alguém?"
        subtitle={`A tarefa "${saved.label}" foi criada. O caminho simples já está pronto; o avançado cria uma automação de verdade.`}
        onClose={onClose}
        footer={<><button type="button" className="btn" onClick={onClose}>Não, só a tarefa</button><button type="button" className="btn btn-solid" onClick={createAutomation}><Sparkles size={14} /> Criar automação</button></>}
      >
        <div className="form-stack">
          {saved.notifyAssignee && (
            <div className="task-callout" role="status">
              <Bell size={16} />
              <div><strong>Caminho simples já ligado.</strong><div className="text-xs">{saved.assignee} recebe um push quando esta tarefa nascer. Não precisa configurar nada aqui.</div></div>
            </div>
          )}
          <p className="text-sm text-muted" style={{ margin: 0 }}>Caminho avançado: escolha o evento — a ação (notificar {saved.assignee || 'o responsável'}) já vem pronta.</p>
          <div className="vs-seg" role="radiogroup" aria-label="Evento">
            {events.map((e) => (
              <button key={e.id} type="button" role="radio" aria-checked={event === e.id} className={`vs-seg-btn ${event === e.id ? 'active' : ''}`} onClick={() => setEvent(e.id)}>{e.label}</button>
            ))}
          </div>
        </div>
      </SidePanel>
    );
  }

  return (
    <SidePanel
      title="Marcar campo como tarefa"
      subtitle="Escolha um campo do cadastro. Quem estiver na etapa precisa preenchê-lo, e a tarefa aparece no workflow."
      onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="button" className="btn btn-solid" disabled={!field || !stageId} onClick={confirm}>Marcar</button></>}
    >
      <div className="form-stack">
        <Field label="Campo">
          <CustomSelect className="select" value={field} onChange={(e) => setField(e.target.value)}>
            <option value="">Escolha um campo…</option>
            <optgroup label="Campos do sistema">{SYSTEM_FIELDS.map((f) => <option key={f}>{f}</option>)}</optgroup>
            {pipeline.customFields.length > 0 && <optgroup label="Campos personalizados">{pipeline.customFields.map((f) => <option key={f.id}>{f.label}</option>)}</optgroup>}
          </CustomSelect>
        </Field>
        <Field label="Etapa" hint={stageId === stages[0]?.id && gate === 'ENTER' ? 'Cuidado: "Impede entrar" na 1ª etapa não trava nada — o lead já nasce nela.' : undefined}>
          <CustomSelect className="select" value={stageId} onChange={(e) => setStageId(e.target.value)}>{stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</CustomSelect>
        </Field>
        <Field label="Efeito na etapa" hint="Impede entrar: o registro não chega aqui sem a tarefa concluída. Impede sair: não sai daqui sem ela.">
          <CustomSelect className="select" value={gate} onChange={(e) => setGate(e.target.value as RequirementGate)}>{(Object.keys(GATE_LABEL) as RequirementGate[]).map((g) => <option key={g} value={g}>{GATE_LABEL[g]}</option>)}</CustomSelect>
        </Field>
        <div className="form-grid">
          <Field label="Tag"><CustomSelect className="select" value={tag} onChange={(e) => setTag(e.target.value)}>{pipeline.taskTags.map((t) => <option key={t}>{t}</option>)}</CustomSelect></Field>
          <Field label="Prazo (dias)"><input className="input" type="number" min={0} value={dueDays} onChange={(e) => setDueDays(e.target.value)} /></Field>
        </div>
        <Field label="Responsável"><input className="input" value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Nome ou função" /></Field>
        <label className="check-row">
          <input type="checkbox" checked={notifyAssignee} disabled={assignee.trim() === ''} onChange={(e) => setNotifyAssignee(e.target.checked)} />
          <span>
            <strong>Notificar por push quando esta tarefa for criada</strong>
            <span className="text-xs text-muted" style={{ display: 'block' }}>{assignee.trim() === '' ? 'Defina um responsável para ligar isto.' : `Avisa ${assignee} assim que a tarefa nascer. Não usa Automações.`}</span>
          </span>
        </label>
      </div>
    </SidePanel>
  );
}

/* ------------------------------ Ciclo de vida ------------------------------ */

function LifecycleTab({ pipeline, patch }: { pipeline: Pipeline; patch: Patch }) {
  const [templates] = useStore(templatesStore);
  const [picked, setPicked] = useState<StepDiff[]>([]);
  const stageOptions = pipeline.stages.map((s) => ({ value: s.id, label: s.name }));

  const saleTpl = templates.find((t) => t.id === pipeline.templateId);
  const postTpl = templates.find((t) => t.id === pipeline.postSaleTemplateId);
  const diffs = useMemo(() => [...(saleTpl ? diffWithTemplate(pipeline.steps, saleTpl) : []), ...(postTpl ? diffWithTemplate(pipeline.steps, postTpl) : [])], [pipeline.steps, saleTpl, postTpl]);

  const toggle = (d: StepDiff) => setPicked((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const apply = () => {
    patch((p) => ({ ...p, steps: applyDiff(p.steps, picked, p.stages) }));
    setPicked([]);
  };

  return (
    <div className="settings-pane">
      <p className="section-sub">Automações que só valem para esta pipeline: quando o evento escolhido acontece (lead criado, mudou de etapa, campo preenchido...), o passo faz as ações em ordem — sem precisar configurar nada na página Automações. Podem notificar, mandar e-mail, mudar o ciclo de vida do lead, criar ou concluir tarefa. Vieram do template como cópia — editar aqui não muda o template.</p>

      {(saleTpl || postTpl) && (
        <div className="tag-row" style={{ marginBottom: '16px' }}>
          {saleTpl && <Badge tone="info">Venda: {saleTpl.name} (v{saleTpl.version})</Badge>}
          {postTpl && <Badge tone="accent">Pós-venda: {postTpl.name} (v{postTpl.version})</Badge>}
        </div>
      )}

      {diffs.length > 0 && (
        <div className="task-callout" role="status" style={{ marginBottom: '16px', alignItems: 'flex-start' }}>
          <Sparkles size={16} />
          <div style={{ flex: 1 }}>
            <strong>O template mudou desde que esta pipeline nasceu ({diffs.length} {diffs.length === 1 ? 'diferença' : 'diferenças'}).</strong>
            <ul className="diff-list">
              {diffs.map((d, i) => (
                <li key={i}>
                  <label className="check-row" style={{ padding: '6px 8px' }}>
                    <input type="checkbox" checked={picked.includes(d)} onChange={() => toggle(d)} />
                    <span className="text-sm">{d.kind === 'added' ? 'Novo passo' : 'Passo mudou'}: <strong>{d.template.name}</strong></span>
                  </label>
                </li>
              ))}
            </ul>
            <button type="button" className="btn btn-sm btn-solid" disabled={picked.length === 0} onClick={apply}>Aplicar {picked.length > 0 ? `(${picked.length})` : ''}</button>
          </div>
        </div>
      )}

      <StepsEditor steps={pipeline.steps} onChange={(steps: Step[]) => patch((p) => ({ ...p, steps }))} stageOptions={stageOptions} phases={['sale', 'post-sale']} />
    </div>
  );
}

/* ------------------------------ Campos personalizados ------------------------------ */

function FieldsTab({ pipeline, patch, onMarkRequired }: { pipeline: Pipeline; patch: Patch; onMarkRequired: (fieldLabel: string) => void }) {
  const [label, setLabel] = useState('');
  const [type, setType] = useState<CustomFieldType>('text');
  const [options, setOptions] = useState('');

  const key = slugify(label);
  const duplicate = pipeline.customFields.some((f) => f.key === key);
  const valid = label.trim() !== '' && key !== '' && !duplicate && (type !== 'select' || options.trim() !== '');

  const add = () => {
    const field: CustomField = { id: newId('cf'), key, label: label.trim(), type, options: type === 'select' ? options.split(',').map((o) => o.trim()).filter(Boolean) : undefined };
    patch((p) => ({ ...p, customFields: [...p.customFields, field] }));
    setLabel('');
    setOptions('');
    setType('text');
  };

  // Um campo vira obrigatório de verdade quando alguém o marca como tarefa na aba Tarefas — sem
  // dado paralelo aqui, é o mesmo requisito que trava etapa (D9: tarefa é requisito, não invente outro).
  const requirementFor = (f: CustomField) => pipeline.requirements.find((r) => r.label === `Informar ${f.label}`);
  const stageName = (id: string) => pipeline.stages.find((s) => s.id === id)?.name ?? '—';

  return (
    <div className="settings-pane">
      <p className="section-sub">Perguntas extras só desta pipeline (ex.: um dado que só o funil de Parcerias B2B precisa). Aparecem na seção "Campos personalizados" da ficha de cada lead deste funil, junto dos campos que valem para todo o CRM. Por padrão são opcionais — para travar a etapa até alguém preencher, use "Tornar obrigatório".</p>
      {pipeline.customFields.length === 0 ? (
        <EmptyState title="Nenhum campo personalizado">Crie o primeiro abaixo.</EmptyState>
      ) : (
        <ul className="row-list">
          {pipeline.customFields.map((f) => {
            const req = requirementFor(f);
            return (
              <li key={f.id} className="row-item">
                <div className="cell-stack">
                  <span className="cell-primary">{f.label}</span>
                  <span className="text-xs text-muted"><code className="mono">{f.key}</code>{f.options ? ` · ${f.options.join(', ')}` : ''}</span>
                </div>
                <Badge>{FIELD_TYPE_LABEL[f.type]}</Badge>
                {req ? (
                  <Badge tone={req.gate === 'NONE' ? 'neutral' : 'warning'} title={`Requisito da etapa ${stageName(req.stageId)}${req.assignee ? ` · ${req.assignee}` : ''}`}>
                    {req.gate === 'NONE' ? 'Vira tarefa' : `Trava em ${stageName(req.stageId)}`}
                  </Badge>
                ) : (
                  <button type="button" className="btn btn-sm" onClick={() => onMarkRequired(f.label)}>Tornar obrigatório</button>
                )}
                <button type="button" className="icon-btn bare" onClick={() => patch((p) => ({ ...p, customFields: p.customFields.filter((x) => x.id !== f.id) }))} aria-label={`Excluir ${f.label}`}><Trash2 size={14} /></button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="panel-card add-box">
        <h3 className="section-title">Novo campo</h3>
        <div className="form-grid">
          <Field label="Nome" hint={key ? `Chave no jsonb: ${key}${duplicate ? ' (já existe)' : ''}` : undefined}><input className="input" value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
          <Field label="Tipo"><CustomSelect className="select" value={type} onChange={(e) => setType(e.target.value as CustomFieldType)}>{(Object.keys(FIELD_TYPE_LABEL) as CustomFieldType[]).map((t) => <option key={t} value={t}>{FIELD_TYPE_LABEL[t]}</option>)}</CustomSelect></Field>
        </div>
        {type === 'select' && <div style={{ marginTop: '12px' }}><Field label="Opções" hint="Separe por vírgula."><input className="input" value={options} onChange={(e) => setOptions(e.target.value)} /></Field></div>}
        <button type="button" className="btn btn-solid" style={{ marginTop: '12px' }} disabled={!valid} onClick={add}><Plus size={14} /> Adicionar campo</button>
      </div>
    </div>
  );
}

/* ------------------------------ Tags ------------------------------ */

function TagsTab({ pipeline, patch }: { pipeline: Pipeline; patch: Patch }) {
  const [contactTags, setContactTags] = useStore(contactTagsStore);
  const usedTags = new Set(pipeline.requirements.map((r) => r.tag));

  return (
    <div className="settings-pane form-stack">
      <TagList
        title="Tags de tarefa"
        hint="Classificam as tarefas deste funil (ex.: adicionar detalhes do cliente, coletar dados da empresa)."
        tags={pipeline.taskTags}
        locked={usedTags}
        lockedHint="Em uso por uma tarefa"
        onChange={(tags) => patch((p) => ({ ...p, taskTags: tags }))}
      />
      <TagList
        title="Tags de contato"
        hint="Criadas pelo time, cada uma com a função da pessoa (valem para todas as pipelines)."
        tags={contactTags}
        onChange={setContactTags}
      />
    </div>
  );
}

function TagList({ title, hint, tags, locked, lockedHint, onChange }: { title: string; hint: string; tags: string[]; locked?: Set<string>; lockedHint?: string; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const t = draft.trim();
    if (t && !tags.some((x) => x.toLowerCase() === t.toLowerCase())) onChange([...tags, t]);
    setDraft('');
  };
  return (
    <div className="panel-card">
      <h3 className="section-title">{title}</h3>
      <p className="section-sub">{hint}</p>
      <div className="tag-row" style={{ marginBottom: '12px' }}>
        {tags.map((t) => (
          <span key={t} className="tag tag-removable">
            {t}
            <button type="button" disabled={locked?.has(t)} title={locked?.has(t) ? lockedHint : `Remover ${t}`} onClick={() => onChange(tags.filter((x) => x !== t))} aria-label={`Remover ${t}`}><X size={11} /></button>
          </span>
        ))}
      </div>
      <div className="row-actions" style={{ justifyContent: 'flex-start' }}>
        <input className="input" style={{ maxWidth: '260px' }} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} placeholder="Nova tag" />
        <button type="button" className="btn" onClick={add} disabled={!draft.trim()}><Plus size={14} /> Adicionar</button>
      </div>
    </div>
  );
}
