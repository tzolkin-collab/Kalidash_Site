import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ExternalLink, Link2, Plus, Trash2, X } from 'lucide-react';
import type { CustomField, CustomFieldType, Pipeline, Requirement, RequirementGate, Source, SourceType, Stage, StageKind } from '../domain';
import { newId, useStore } from '../lib/store';
import { useShell } from '../lib/shell';
import { automationsStore } from '../mocks/automations';
import { contactTagsStore } from '../mocks/people';
import { pipelinesStore } from '../mocks/pipelines';
import { projectsStore } from '../mocks/projects';
import { Badge, EmptyState, Field, Page, PageHeader, SampleBanner, SidePanel, Switch, Tabs } from '../components/ui';

type Tab = 'general' | 'stages' | 'sources' | 'tasks' | 'fields' | 'tags';
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

  const pipeline = pipelines.find((p) => p.id === pipelineId) ?? pipelines[0];
  const patch: Patch = (fn) => setPipelines((prev) => prev.map((p) => (p.id === pipeline?.id ? fn(p) : p)));

  const tabs: { id: Tab; label: string; count?: number }[] = pipeline
    ? [
        { id: 'general', label: 'Geral' },
        { id: 'stages', label: 'Etapas', count: pipeline.stages.length },
        { id: 'sources', label: 'Fontes', count: pipeline.sources.length },
        { id: 'tasks', label: 'Tarefas', count: pipeline.requirements.length },
        { id: 'fields', label: 'Campos personalizados', count: pipeline.customFields.length },
        { id: 'tags', label: 'Tags' },
      ]
    : [];

  return (
    <Page>
      <PageHeader
        back={{ label: 'Oportunidades', to: '/oportunidades' }}
        title="Configurações das pipelines"
        subtitle="Ver, editar, excluir e criar pipelines. Cada pipeline é um funil, ligado a uma oferta."
        actions={<button type="button" className="btn btn-solid" onClick={() => navigate('/oportunidades/pipelines/nova')}><Plus size={14} /> Nova pipeline</button>}
      />
      <SampleBanner phase={1}>As pipelines ainda vivem no código do front. As mudanças abaixo valem até recarregar a página.</SampleBanner>

      <div className="settings-layout">
        <nav className="pipe-list" aria-label="Pipelines">
          {pipelines.map((p) => {
            const total = Object.values(p.counts).reduce((a, b) => a + b, 0);
            return (
              <button key={p.id} type="button" className={`pipe-item ${p.id === pipeline?.id ? 'active' : ''}`} onClick={() => { navigate(`/oportunidades/pipelines/${p.id}`); setTab('general'); }}>
                <span className="cell-primary">{p.name}</span>
                <span className="text-xs text-muted">{p.offer} · {total} registros</span>
              </button>
            );
          })}
        </nav>

        {!pipeline ? (
          <EmptyState title="Nenhuma pipeline">Crie a primeira com "Nova pipeline".</EmptyState>
        ) : (
          <section className="settings-detail" key={pipeline.id}>
            <Tabs tabs={tabs} value={tab} onChange={setTab} />
            {tab === 'general' && <GeneralTab pipeline={pipeline} patch={patch} onDeleted={() => navigate('/oportunidades/pipelines')} />}
            {tab === 'stages' && <StagesTab pipeline={pipeline} patch={patch} />}
            {tab === 'sources' && <SourcesTab pipeline={pipeline} patch={patch} />}
            {tab === 'tasks' && <TasksTab pipeline={pipeline} patch={patch} />}
            {tab === 'fields' && <FieldsTab pipeline={pipeline} patch={patch} />}
            {tab === 'tags' && <TagsTab pipeline={pipeline} patch={patch} />}
          </section>
        )}
      </div>
    </Page>
  );
}

/* ------------------------------ Geral ------------------------------ */

function GeneralTab({ pipeline, patch, onDeleted }: { pipeline: Pipeline; patch: Patch; onDeleted: () => void }) {
  const [, setPipelines] = useStore(pipelinesStore);
  const [confirming, setConfirming] = useState(false);
  const byKind = (kinds: StageKind[]) => pipeline.stages.filter((s) => kinds.includes(s.kind)).reduce((a, s) => a + (pipeline.counts[s.id] ?? 0), 0);
  const opportunities = byKind(['OPEN', 'WON', 'LOST']);
  const leads = byKind(['LEAD']);

  const remove = () => {
    setPipelines((prev) => prev.filter((p) => p.id !== pipeline.id));
    onDeleted();
  };

  return (
    <div className="form-stack settings-pane">
      <div className="form-grid">
        <Field label="Nome da pipeline"><input className="input" value={pipeline.name} onChange={(e) => patch((p) => ({ ...p, name: e.target.value }))} /></Field>
        <Field label="Oferta" hint="Uma pipeline é um funil, e cada funil vende uma oferta."><input className="input" value={pipeline.offer} onChange={(e) => patch((p) => ({ ...p, offer: e.target.value }))} /></Field>
      </div>

      <div className="danger-zone">
        <div>
          <strong>Excluir pipeline</strong>
          <p className="text-sm text-muted" style={{ margin: '4px 0 0' }}>
            {opportunities > 0
              ? `Esta pipeline tem ${opportunities} ${opportunities === 1 ? 'oportunidade' : 'oportunidades'}. Mova-as para outra pipeline antes de excluir.`
              : leads > 0 ? `Os ${leads} leads desta pipeline serão descartados junto.` : 'Nada está em andamento nesta pipeline.'}
          </p>
        </div>
        {confirming ? (
          <div className="row-actions">
            <button type="button" className="btn" onClick={() => setConfirming(false)}>Cancelar</button>
            <button type="button" className="btn btn-danger" onClick={remove}>Confirmar exclusão</button>
          </div>
        ) : (
          <button type="button" className="btn btn-danger" disabled={opportunities > 0} onClick={() => setConfirming(true)}><Trash2 size={14} /> Excluir</button>
        )}
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
                      <select className="select" value={s.kind} onChange={(e) => setStage(s.id, { kind: e.target.value as StageKind })} aria-label="Tipo da etapa">
                        {(Object.keys(KIND_LABEL) as StageKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                      </select>
                    </td>
                    <td><input type="color" className="color-input" value={s.color} onChange={(e) => setStage(s.id, { color: e.target.value })} aria-label="Cor da etapa" /></td>
                    <td>{open ? <input className="input input-narrow" type="number" min={0} max={100} value={s.probability ?? 0} onChange={(e) => setStage(s.id, { probability: Math.min(100, Math.max(0, Number(e.target.value))) })} aria-label="Probabilidade" /> : <span className="text-muted">—</span>}</td>
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
          <select className="select" value={type} onChange={(e) => { setType(e.target.value as SourceType); setFormId(''); }}>
            {(Object.keys(SOURCE_TYPE_LABEL) as SourceType[]).map((t) => <option key={t} value={t}>{SOURCE_TYPE_LABEL[t]}</option>)}
          </select>
        </Field>
        {type === 'FORM' ? (
          <>
            <Field label="Formulário rastreado" hint="Vem dos projetos conectados. O formulário passa a criar leads nesta pipeline.">
              <select className="select" value={formId} onChange={(e) => setFormId(e.target.value)}>
                <option value="">Escolha um formulário…</option>
                {forms.map(({ form, project }) => {
                  const other = usedBy(form.id);
                  return <option key={form.id} value={form.id} disabled={Boolean(other)}>{project.name} › {form.name}{other ? ` (já alimenta ${other.name})` : ''}</option>;
                })}
              </select>
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

/* ------------------------------ Tarefas ------------------------------ */

function TasksTab({ pipeline, patch }: { pipeline: Pipeline; patch: Patch }) {
  const { navigate } = useShell();
  const [, setAutomations] = useStore(automationsStore);
  const [marking, setMarking] = useState(false);
  const stageName = (id: string) => pipeline.stages.find((s) => s.id === id)?.name ?? '—';

  const remove = (r: Requirement) => {
    patch((p) => ({ ...p, requirements: p.requirements.filter((x) => x.id !== r.id) }));
    if (r.kind === 'FIELD') setAutomations((prev) => prev.filter((a) => a.managedBy !== `Marcar como tarefa: ${r.label.replace(/^Informar /, '')}`));
  };

  return (
    <div className="settings-pane">
      <div className="pane-head">
        <p className="section-sub" style={{ margin: 0 }}>Requisitos de cada etapa. Todo funil nasce com o template padrão (CNPJ e fonte); dá para marcar qualquer campo como tarefa.</p>
        <div className="row-actions">
          <button type="button" className="btn" onClick={() => navigate(`/tarefas/${pipeline.id}`)}><ExternalLink size={14} /> Ver no workflow</button>
          <button type="button" className="btn btn-solid" onClick={() => setMarking(true)}><Plus size={14} /> Marcar campo como tarefa</button>
        </div>
      </div>
      <div className="table-card">
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Tarefa</th><th>Etapa</th><th>Tag</th><th>Efeito</th><th>Responsável</th><th>Prazo</th><th style={{ width: '48px' }}></th></tr></thead>
            <tbody>
              {pipeline.requirements.map((r) => (
                <tr key={r.id}>
                  <td><span className="cell-primary">{r.label}</span><div className="text-xs text-muted">{r.kind === 'FIELD' ? 'Campo do cadastro' : 'Ação'}</div></td>
                  <td>{stageName(r.stageId)}</td>
                  <td><Badge tone="accent">{r.tag}</Badge></td>
                  <td><Badge tone={r.gate === 'NONE' ? 'neutral' : 'warning'}>{GATE_LABEL[r.gate]}</Badge></td>
                  <td>{r.assignee ?? <span className="text-muted">—</span>}</td>
                  <td>{r.dueDays !== undefined ? `${r.dueDays} d` : <span className="text-muted">—</span>}</td>
                  <td><button type="button" className="icon-btn bare" onClick={() => remove(r)} aria-label={`Excluir ${r.label}`}><Trash2 size={14} /></button></td>
                </tr>
              ))}
              {pipeline.requirements.length === 0 && <tr><td colSpan={7}><EmptyState title="Sem tarefas">Marque um campo como tarefa para começar.</EmptyState></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {marking && <MarkTaskPanel pipeline={pipeline} onClose={() => setMarking(false)} onSave={(r, field) => {
        patch((p) => ({ ...p, requirements: [...p.requirements, r] }));
        setAutomations((prev) => [{
          id: newId('au'), name: `Tarefa "${r.label}" ao chegar em ${stageName(r.stageId)}`, category: 'Pendências', trigger: 'Oportunidade mudou de etapa', action: 'Criar tarefa',
          triggerId: 'oportunidade.mudou_de_etapa', actionId: 'tarefa.criar', detail: `Tag ${r.tag}${r.dueDays !== undefined ? `, prazo de ${r.dueDays} dias` : ''}`, pipeline: pipeline.name,
          origin: 'MANAGED', managedBy: `Marcar como tarefa: ${field}`, active: true, runs: 0,
        }, ...prev]);
        setMarking(false);
      }} />}
    </div>
  );
}

function MarkTaskPanel({ pipeline, onClose, onSave }: { pipeline: Pipeline; onClose: () => void; onSave: (r: Requirement, field: string) => void }) {
  const stages = pipeline.stages.filter((s) => s.kind === 'LEAD' || s.kind === 'OPEN');
  const [field, setField] = useState('');
  const [stageId, setStageId] = useState(stages[0]?.id ?? '');
  const [gate, setGate] = useState<RequirementGate>('NONE');
  const [tag, setTag] = useState(pipeline.taskTags[0] ?? 'Geral');
  const [assignee, setAssignee] = useState('');
  const [dueDays, setDueDays] = useState('');

  const save = () => onSave({ id: newId('req'), stageId, label: `Informar ${field}`, tag, kind: 'FIELD', gate, assignee: assignee.trim() || undefined, dueDays: dueDays === '' ? undefined : Math.max(0, Number(dueDays)), blocked: 0, overdue: 0 }, field);

  return (
    <SidePanel
      title="Marcar campo como tarefa"
      subtitle="Escolha um campo do cadastro. Quem estiver na etapa precisa preenchê-lo, e a tarefa aparece no workflow."
      onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="button" className="btn btn-solid" disabled={!field || !stageId} onClick={save}>Marcar</button></>}
    >
      <div className="form-stack">
        <Field label="Campo">
          <select className="select" value={field} onChange={(e) => setField(e.target.value)}>
            <option value="">Escolha um campo…</option>
            <optgroup label="Campos do sistema">{SYSTEM_FIELDS.map((f) => <option key={f}>{f}</option>)}</optgroup>
            {pipeline.customFields.length > 0 && <optgroup label="Campos personalizados">{pipeline.customFields.map((f) => <option key={f.id}>{f.label}</option>)}</optgroup>}
          </select>
        </Field>
        <Field label="Etapa"><select className="select" value={stageId} onChange={(e) => setStageId(e.target.value)}>{stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="Efeito na etapa">
          <select className="select" value={gate} onChange={(e) => setGate(e.target.value as RequirementGate)}>{(Object.keys(GATE_LABEL) as RequirementGate[]).map((g) => <option key={g} value={g}>{GATE_LABEL[g]}</option>)}</select>
        </Field>
        <div className="form-grid">
          <Field label="Tag"><select className="select" value={tag} onChange={(e) => setTag(e.target.value)}>{pipeline.taskTags.map((t) => <option key={t}>{t}</option>)}</select></Field>
          <Field label="Prazo (dias)"><input className="input" type="number" min={0} value={dueDays} onChange={(e) => setDueDays(e.target.value)} /></Field>
        </div>
        <Field label="Responsável"><input className="input" value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Nome ou função" /></Field>
      </div>
    </SidePanel>
  );
}

/* ------------------------------ Campos personalizados ------------------------------ */

function FieldsTab({ pipeline, patch }: { pipeline: Pipeline; patch: Patch }) {
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

  return (
    <div className="settings-pane">
      <p className="section-sub">Campos extras da oportunidade. Ficam guardados em <code className="mono">customData</code> (jsonb), então não exigem mudança no banco, e viram colunas em Oportunidades.</p>
      {pipeline.customFields.length === 0 ? (
        <EmptyState title="Nenhum campo personalizado">Crie o primeiro abaixo.</EmptyState>
      ) : (
        <ul className="row-list">
          {pipeline.customFields.map((f) => (
            <li key={f.id} className="row-item">
              <div className="cell-stack">
                <span className="cell-primary">{f.label}</span>
                <span className="text-xs text-muted"><code className="mono">{f.key}</code>{f.options ? ` · ${f.options.join(', ')}` : ''}</span>
              </div>
              <Badge>{FIELD_TYPE_LABEL[f.type]}</Badge>
              <button type="button" className="icon-btn bare" onClick={() => patch((p) => ({ ...p, customFields: p.customFields.filter((x) => x.id !== f.id) }))} aria-label={`Excluir ${f.label}`}><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="panel-card add-box">
        <h3 className="section-title">Novo campo</h3>
        <div className="form-grid">
          <Field label="Nome" hint={key ? `Chave no jsonb: ${key}${duplicate ? ' (já existe)' : ''}` : undefined}><input className="input" value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
          <Field label="Tipo"><select className="select" value={type} onChange={(e) => setType(e.target.value as CustomFieldType)}>{(Object.keys(FIELD_TYPE_LABEL) as CustomFieldType[]).map((t) => <option key={t} value={t}>{FIELD_TYPE_LABEL[t]}</option>)}</select></Field>
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
