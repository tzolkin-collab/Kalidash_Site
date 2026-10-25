import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Copy, FlaskConical, Link2, Plus, Trash2 } from 'lucide-react';
import type { AutomationCategory, LifecycleTemplate, Pipeline, Step } from '../domain';
import { useShell } from '../lib/shell';
import { actionText } from '../lib/steps';
import { newId, useStore } from '../lib/store';
import { ACTIONS, CATEGORIES, EVENTS, actionLabel, automationsStore, runsStore } from '../mocks/automations';
import type { AutomationRow } from '../mocks/automations';
import { pipelinesStore } from '../mocks/pipelines';
import { templatesStore } from '../mocks/templates';
import StepsEditor from '../components/StepsEditor';
import { Badge, EmptyState, Field, Page, PageHeader, PopupDialog, SampleBanner, SearchBox, SidePanel, Switch, Tabs } from '../components/ui';
import { CustomSelect } from '../components/ui';

type Tab = 'automations' | 'templates' | 'catalog' | 'runs';

/** Uma linha da lista: automação solta ou passo do ciclo de vida de uma pipeline. */
type Row = AutomationRow & { stepOf?: { pipelineId: string; stepId: string } };

/** Selo de toda automação: nada roda no servidor (D34, B-16). */
const NOT_ON_SERVER = 'Exemplo, não roda no servidor';
const TEMPLATE_NAMES = ['Boas-vindas (Inbound)', 'Follow-up Reunião', 'Boas-vindas ao cliente'];
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const categoryOf = (triggerId: string): AutomationCategory => EVENTS.find((e) => e.id === triggerId)?.category ?? 'Oportunidades';
const eventName = (id: string) => EVENTS.find((e) => e.id === id)?.label ?? id;

function stepRow(p: Pipeline, s: Step, runs: { automation: string; at: string }[]): Row {
  const mine = runs.filter((r) => r.automation === s.name);
  const first = s.actions[0];
  return {
    id: `step-${s.id}`, name: s.name, category: categoryOf(s.triggerId), trigger: eventName(s.triggerId),
    action: first ? actionLabel(first.actionId) + (s.actions.length > 1 ? ` +${s.actions.length - 1}` : '') : 'Sem ações',
    triggerId: s.triggerId, actionId: first?.actionId ?? '', detail: s.actions.map(actionText).join(' · '), pipeline: p.name,
    origin: 'MANAGED', managedBy: `Ciclo de vida: ${p.name}`, active: s.enabled, lastRun: mine[0]?.at, runs: mine.length,
    stepOf: { pipelineId: p.id, stepId: s.id },
  };
}

export default function Automations() {
  const { navigate } = useShell();
  const [automations, setAutomations] = useStore(automationsStore);
  const [pipelines, setPipelines] = useStore(pipelinesStore);
  const [templates] = useStore(templatesStore);
  const [runs] = useStore(runsStore);
  const [tab, setTab] = useState<Tab>('automations');
  const [category, setCategory] = useState<'' | AutomationCategory>('');
  const [origin, setOrigin] = useState<'' | 'MANUAL' | 'MANAGED'>('');
  const [funnel, setFunnel] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Row | 'new' | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);

  const rows = useMemo<Row[]>(() => [
    ...pipelines.filter((p) => !p.archivedAt).flatMap((p) => p.steps.map((s) => stepRow(p, s, runs))),
    ...automations,
  ], [pipelines, automations, runs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((a) => (!category || a.category === category) && (!origin || a.origin === origin) && (!funnel || a.pipeline === funnel) && (!q || `${a.name} ${a.trigger} ${a.action} ${a.pipeline}`.toLowerCase().includes(q)));
  }, [rows, category, origin, funnel, search]);
  const funnels = useMemo(() => [...new Set(rows.map((a) => a.pipeline))], [rows]);

  const toggle = (row: Row, active: boolean) => {
    if (row.stepOf) {
      const { pipelineId, stepId } = row.stepOf;
      setPipelines((prev) => prev.map((p) => (p.id === pipelineId ? { ...p, steps: p.steps.map((s) => (s.id === stepId ? { ...s, enabled: active } : s)) } : p)));
    } else setAutomations((prev) => prev.map((a) => (a.id === row.id ? { ...a, active } : a)));
  };
  const remove = (id: string) => { setAutomations((prev) => prev.filter((a) => a.id !== id)); setEditing(null); };
  const save = (row: AutomationRow) => {
    setAutomations((prev) => (prev.some((a) => a.id === row.id) ? prev.map((a) => (a.id === row.id ? row : a)) : [row, ...prev]));
    setEditing(null);
  };

  const editingTemplate = templates.find((t) => t.id === templateId);
  if (editingTemplate) return <TemplateEditor template={editingTemplate} onBack={() => setTemplateId(null)} />;

  const managedCount = rows.filter((a) => a.origin === 'MANAGED').length;

  return (
    <Page>
      <PageHeader
        title="Automações"
        subtitle="Os passos de ciclo de vida de cada funil e as automações avulsas, por assunto. Hoje todas rodam só neste navegador, com o admin aberto: nenhuma roda no servidor. Os passos nascem ao copiar um template de ciclo de vida para o funil."
        actions={<button type="button" className="btn btn-solid" onClick={() => setEditing('new')}><Plus size={14} /> Nova automação</button>}
      />
      <SampleBanner>Nenhuma automação roda no servidor: elas só executam neste navegador, enquanto o admin está aberto, e o que chega por formulário no site não dispara nenhuma. As automações de exemplo somem ao recarregar e não há histórico de execuções do servidor.</SampleBanner>

      <Tabs
        tabs={[{ id: 'automations' as Tab, label: 'Automações', count: rows.length }, { id: 'templates' as Tab, label: 'Templates de ciclo de vida', count: templates.length }, { id: 'catalog' as Tab, label: 'Catálogo' }, { id: 'runs' as Tab, label: 'Execuções', count: runs.length }]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'automations' && (
        <>
          <div className="chip-row" role="group" aria-label="Filtrar por assunto">
            <button type="button" className={`chip ${category === '' ? 'active' : ''}`} onClick={() => setCategory('')}>Todas <span className="tab-count">{rows.length}</span></button>
            {CATEGORIES.map((c) => (
              <button key={c} type="button" className={`chip ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>
                {c} <span className="tab-count">{rows.filter((a) => a.category === c).length}</span>
              </button>
            ))}
          </div>
          <div className="toolbar">
            <SearchBox value={search} onChange={setSearch} placeholder="Buscar automação, gatilho ou ação…" />
            <CustomSelect className="select select-sm" value={origin} onChange={(e) => setOrigin(e.target.value as '' | 'MANUAL' | 'MANAGED')} aria-label="Filtrar por origem">
              <option value="">Manuais e gerenciadas</option>
              <option value="MANUAL">Manuais</option>
              <option value="MANAGED">Gerenciadas ({managedCount})</option>
            </CustomSelect>
            <CustomSelect className="select select-sm" value={funnel} onChange={(e) => setFunnel(e.target.value)} aria-label="Filtrar por funil">
              <option value="">Todos os funis</option>
              {funnels.map((n) => <option key={n} value={n}>{n}</option>)}
            </CustomSelect>
          </div>

          <div className="table-card">
            <div className="table-scroll">
              <table className="data-table data-table-cards">
                <thead><tr><th>Automação</th><th>Quando → Então</th><th>Última execução (nesta aba)</th><th>Execuções (nesta aba)</th><th style={{ width: '70px' }}>Ativa</th></tr></thead>
                <tbody>
                  {filtered.map((a) => (
                    <tr key={a.id} className="clickable" onClick={() => setEditing(a)} style={{ opacity: a.active ? 1 : 0.6 }}>
                      <td className="cell-block" data-label="Automação">
                        <div className="cell-stack">
                          <span className="cell-primary">{a.name}</span>
                          <span className="tag-row" style={{ marginTop: '4px' }}>
                            <Badge tone={a.origin === 'MANAGED' ? 'accent' : 'neutral'} title={a.managedBy}>{a.origin === 'MANAGED' ? <><Link2 size={10} /> {a.stepOf ? 'Passo do ciclo de vida' : 'Gerenciada'}</> : 'Manual'}</Badge>
                            <Badge>{a.category}</Badge>
                            <Badge title="Funil a que a automação pertence">{a.pipeline === 'Todas' ? 'Todos os funis' : a.pipeline}</Badge>
                            <Badge tone="warning" title="Roda só neste navegador, com o admin aberto. O servidor não executa automações."><FlaskConical size={10} /> {NOT_ON_SERVER}</Badge>
                          </span>
                        </div>
                      </td>
                      <td className="cell-block" data-label="Quando → Então">
                        <div className="flow-line"><span>{a.trigger}</span><ArrowRight size={13} className="text-muted" /><span>{a.action}</span></div>
                        <div className="text-xs text-muted">{a.detail}</div>
                      </td>
                      <td className="text-muted" data-label="Última execução">{when(a.lastRun)}</td>
                      <td data-label="Execuções (nesta aba)">{a.runs > 0 ? a.runs : '—'}</td>
                      <td data-label="Ativa" onClick={(e) => e.stopPropagation()}><Switch checked={a.active} onChange={(v) => toggle(a, v)} label={`Ativar ${a.name}`} /></td>
                    </tr>
                  ))}
                  {filtered.length === 0 && <tr><td colSpan={5}><EmptyState title="Nenhuma automação aqui">Ajuste os filtros ou crie uma nova.</EmptyState></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'templates' && <TemplatesTab onEdit={setTemplateId} />}

      {tab === 'catalog' && (
        <div className="catalog">
          {CATEGORIES.map((c) => (
            <section key={c} className="panel-card">
              <h2 className="section-title">{c}</h2>
              <div className="catalog-cols">
                <div>
                  <div className="catalog-head">Quando (eventos)</div>
                  <ul className="catalog-list">
                    {EVENTS.filter((e) => e.category === c).map((e) => (
                      <li key={e.id}><strong>{e.label}</strong><span className="text-xs text-muted">{e.detail}</span><code className="mono text-muted">{e.id}</code></li>
                    ))}
                    {EVENTS.every((e) => e.category !== c) && <li className="text-xs text-muted">Sem eventos próprios.</li>}
                  </ul>
                </div>
                <div>
                  <div className="catalog-head">Então (ações)</div>
                  <ul className="catalog-list">
                    {ACTIONS.filter((a) => a.category === c).map((a) => (
                      <li key={a.id}><strong>{a.label}</strong><span className="text-xs text-muted">{a.detail}</span><code className="mono text-muted">{a.id}</code></li>
                    ))}
                    {ACTIONS.every((a) => a.category !== c) && <li className="text-xs text-muted">Sem ações próprias.</li>}
                  </ul>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}

      {tab === 'runs' && (
        <div className="table-card">
          <div className="table-scroll">
            <table className="data-table data-table-cards">
              <thead><tr><th>Quando</th><th>Automação</th><th>Evento</th><th>Resultado</th><th>Detalhe</th></tr></thead>
              <tbody>
                {runs.length === 0 && <tr><td colSpan={5}><EmptyState title="Nenhuma execução nesta aba">As automações só rodam neste navegador, com o admin aberto, e o registro some ao recarregar. O servidor não guarda histórico de execuções.</EmptyState></td></tr>}
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td className="text-muted" data-label="Quando">{when(r.at)}</td>
                    <td data-label="Automação">{r.automation}</td>
                    <td data-label="Evento"><code className="mono">{r.event}</code></td>
                    <td data-label="Resultado"><Badge tone={r.result === 'OK' ? 'success' : r.result === 'SCHEDULED' ? 'info' : 'danger'}>{r.result === 'OK' ? 'Executada' : r.result === 'SCHEDULED' ? 'Agendada' : 'Falhou'}</Badge></td>
                    <td className="text-muted" data-label="Detalhe">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <AutomationPanel
          key={editing === 'new' ? 'new' : editing.id}
          automation={editing === 'new' ? null : editing}
          pipelineNames={pipelines.filter((p) => !p.archivedAt).map((p) => p.name)}
          onClose={() => setEditing(null)}
          onSave={save}
          onDelete={remove}
          onOpenPipeline={(id) => navigate(`/oportunidades/pipelines/${id}?tab=lifecycle`)}
        />
      )}
    </Page>
  );
}

/* ------------------------------ templates ------------------------------ */

function TemplatesTab({ onEdit }: { onEdit: (id: string) => void }) {
  const [templates, setTemplates] = useStore(templatesStore);
  const [pipelines] = useStore(pipelinesStore);
  const [creating, setCreating] = useState(false);
  const usedBy = (id: string) => pipelines.filter((p) => !p.archivedAt && (p.templateId === id || p.postSaleTemplateId === id)).length;

  const duplicate = (t: LifecycleTemplate) => setTemplates((prev) => [...prev, {
    ...t, id: newId('tpl'), name: `${t.name} (cópia)`, builtIn: false, version: 1,
    steps: t.steps.map((s) => ({ ...s, id: newId('tplstep'), actions: s.actions.map((a) => ({ ...a, id: newId('sa') })) })),
  }]);

  return (
    <>
      <div className="pane-head">
        <p className="section-sub" style={{ margin: 0 }}>Receitas prontas de ciclo de vida: etapas, requisitos e passos. Ao criar uma pipeline, o template é <strong>copiado</strong>; editar a cópia não muda o template, e editar o template não muda as pipelines que já saíram dele.</p>
        <button type="button" className="btn btn-solid" onClick={() => setCreating(true)}><Plus size={14} /> Novo template</button>
      </div>
      <div className="template-grid">
        {templates.map((t) => (
          <article key={t.id} className="template-card static">
            <div className="template-info">
              <div className="tag-row"><Badge tone={t.kind === 'SALE' ? 'info' : 'accent'}>{t.kind === 'SALE' ? 'Venda' : 'Pós-venda'}</Badge>{t.builtIn && <Badge>Pronto</Badge>}<Badge>v{t.version}</Badge></div>
              <h3 className="template-name">{t.name}</h3>
              <p className="text-sm text-muted" style={{ margin: 0 }}>{t.description}</p>
              <p className="text-xs text-muted" style={{ margin: 0 }}>{t.steps.length} passos{t.stages.length > 0 && ` · ${t.stages.length} etapas · ${t.requirements.length} requisitos`} · usado por {usedBy(t.id)} {usedBy(t.id) === 1 ? 'pipeline' : 'pipelines'}</p>
              <div className="row-actions" style={{ justifyContent: 'flex-start', marginTop: '6px' }}>
                <button type="button" className="btn btn-sm" onClick={() => onEdit(t.id)}>Editar passos</button>
                <button type="button" className="btn btn-sm" onClick={() => duplicate(t)}><Copy size={12} /> Duplicar</button>
                {!t.builtIn && usedBy(t.id) === 0 && <button type="button" className="icon-btn bare" onClick={() => setTemplates((prev) => prev.filter((x) => x.id !== t.id))} aria-label={`Excluir ${t.name}`}><Trash2 size={14} /></button>}
              </div>
            </div>
          </article>
        ))}
      </div>
      {creating && <NewTemplatePanel onClose={() => setCreating(false)} onCreate={(t) => { setTemplates((prev) => [...prev, t]); setCreating(false); onEdit(t.id); }} />}
    </>
  );
}

function NewTemplatePanel({ onClose, onCreate }: { onClose: () => void; onCreate: (t: LifecycleTemplate) => void }) {
  const [templates] = useStore(templatesStore);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [copyFrom, setCopyFrom] = useState('');

  const create = () => {
    const base = templates.find((t) => t.id === copyFrom);
    onCreate({
      id: newId('tpl'), name: name.trim(), description: description.trim(), kind: base?.kind ?? 'SALE', builtIn: false, version: 1,
      stages: base?.stages ?? [{ name: 'Novos', kind: 'LEAD', color: '#94a3b8' }, { name: 'Qualificação', kind: 'OPEN', color: '#f59e0b' }, { name: 'Ganho', kind: 'WON', color: '#10b981' }, { name: 'Perdido', kind: 'LOST', color: '#ef4444' }],
      requirements: base?.requirements ?? [],
      steps: (base?.steps ?? []).map((s) => ({ ...s, id: newId('tplstep'), actions: s.actions.map((a) => ({ ...a, id: newId('sa') })) })),
    });
  };

  return (
    <SidePanel
      title="Novo template"
      subtitle="Comece do zero ou de uma cópia de um template pronto."
      onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="button" className="btn btn-solid" disabled={!name.trim()} onClick={create}>Criar e editar</button></>}
    >
      <div className="form-stack">
        <Field label="Nome"><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
        <Field label="Descrição"><textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <Field label="Copiar de" hint="Copiar traz etapas, requisitos e passos. Em branco começa só com as etapas básicas.">
          <CustomSelect className="select" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}><option value="">Em branco</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</CustomSelect>
        </Field>
      </div>
    </SidePanel>
  );
}

/** Edita os passos de um template. As mudanças só valem ao salvar, e cada salvamento sobe a versão. */
function TemplateEditor({ template, onBack }: { template: LifecycleTemplate; onBack: () => void }) {
  const [, setTemplates] = useStore(templatesStore);
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description);
  // O template guarda o nome da etapa; o editor usa o campo stageId, que aqui carrega esse nome
  const [steps, setSteps] = useState<Step[]>(() => template.steps.map((ts) => ({ ...ts, stageId: ts.stageName })));
  const [dirty, setDirty] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);

  const change = (next: Step[]) => { setSteps(next); setDirty(true); };
  const save = () => {
    setTemplates((prev) => prev.map((t) => (t.id === template.id
      ? { ...t, name: name.trim() || t.name, description, version: dirty ? t.version + 1 : t.version, steps: steps.map(({ stageId, ...rest }) => ({ ...rest, stageName: stageId })) }
      : t)));
    setDirty(false);
  };
  const leave = () => { if (dirty) { setLeaveDialogOpen(true); return; } onBack(); };

  return (
    <Page>
      <div className="page-header" style={{ paddingBottom: '8px' }}>
        <div className="page-header-main">
          <div>
            <button type="button" className="page-back" onClick={leave}><ArrowLeft size={14} /> Templates</button>
            <input className="input title-input" value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} aria-label="Nome do template" />
            <div className="tag-row" style={{ marginTop: '8px' }}><Badge tone={template.kind === 'SALE' ? 'info' : 'accent'}>{template.kind === 'SALE' ? 'Venda' : 'Pós-venda'}</Badge><Badge>versão {template.version}</Badge>{dirty && <Badge tone="warning">Alterações não salvas</Badge>}</div>
          </div>
        </div>
        <div className="page-actions"><button type="button" className="btn btn-solid" disabled={!dirty} onClick={save}>Salvar nova versão</button></div>
      </div>
      <SampleBanner>Editar um template não muda as pipelines que já saíram dele: elas têm a própria cópia. Para atualizar uma pipeline, use "Comparar com o template" na aba Ciclo de vida dela.</SampleBanner>
      <div className="form-stack" style={{ maxWidth: '760px', marginBottom: '20px' }}>
        <Field label="Descrição"><textarea className="textarea" value={description} onChange={(e) => { setDescription(e.target.value); setDirty(true); }} /></Field>
      </div>
      <StepsEditor steps={steps} onChange={change} stageOptions={template.stages.map((s) => ({ value: s.name, label: s.name }))} phases={template.kind === 'SALE' ? ['sale'] : ['post-sale']} />
      {leaveDialogOpen && <PopupDialog
        eyebrow="TEMPLATE DE AUTOMAÇÃO"
        tone="warning"
        title="Descartar alterações?"
        description="As mudanças ainda não salvas neste template serão perdidas."
        onClose={() => setLeaveDialogOpen(false)}
        footer={<><button type="button" className="btn" onClick={() => setLeaveDialogOpen(false)}>Continuar editando</button><button type="button" className="btn btn-danger" onClick={() => { setLeaveDialogOpen(false); onBack(); }}>Descartar e sair</button></>}
      />}
    </Page>
  );
}

/* ------------------------------ automação solta ------------------------------ */

type PanelProps = { automation: Row | null; pipelineNames: string[]; onClose: () => void; onSave: (a: AutomationRow) => void; onDelete: (id: string) => void; onOpenPipeline: (id: string) => void };

function AutomationPanel({ automation, pipelineNames, onClose, onSave, onDelete, onOpenPipeline }: PanelProps) {
  const managed = automation?.origin === 'MANAGED';
  const [name, setName] = useState(automation?.name ?? '');
  const [triggerId, setTriggerId] = useState(automation?.triggerId ?? EVENTS[0].id);
  const [actionId, setActionId] = useState(automation?.actionId || ACTIONS[0].id);
  const [pipeline, setPipeline] = useState(automation?.pipeline ?? 'Todas');
  const [detail, setDetail] = useState(automation?.detail ?? '');

  const trigger = EVENTS.find((e) => e.id === triggerId);
  const valid = name.trim() !== '' && !managed;

  const submit = () => {
    if (!valid || !trigger) return;
    onSave({
      id: automation?.id ?? newId('au'), name: name.trim(), category: trigger.category, trigger: trigger.label, action: actionLabel(actionId),
      triggerId, actionId, detail: detail.trim() || actionLabel(actionId), pipeline, origin: 'MANUAL', active: automation?.active ?? true,
      lastRun: automation?.lastRun, runs: automation?.runs ?? 0,
    });
  };

  const byCategory = (items: typeof EVENTS) => CATEGORIES.map((c) => ({ c, items: items.filter((i) => i.category === c) })).filter((g) => g.items.length > 0);

  return (
    <SidePanel
      title={automation ? automation.name : 'Nova automação'}
      subtitle={managed ? automation?.managedBy : 'Escolha o evento, a ação e onde ela vale.'}
      onClose={onClose}
      footer={
        <>
          {automation && !managed && <button type="button" className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={() => onDelete(automation.id)}><Trash2 size={14} /> Excluir</button>}
          <button type="button" className="btn" onClick={onClose}>{managed ? 'Fechar' : 'Cancelar'}</button>
          {managed && automation?.stepOf && <button type="button" className="btn btn-solid" onClick={() => onOpenPipeline(automation.stepOf!.pipelineId)}>Editar na pipeline</button>}
          {!managed && <button type="button" className="btn btn-solid" disabled={!valid} onClick={submit}>Salvar</button>}
        </>
      }
    >
      {managed ? (
        <div className="form-stack">
          <div className="task-callout" role="note">
            <Link2 size={16} />
            <div>
              <strong>Automação gerenciada.</strong>
              <div className="text-xs">Foi criada por "{automation?.managedBy}". {automation?.stepOf ? 'É um passo do ciclo de vida da pipeline: edite na aba Ciclo de vida dela. Aqui dá só para pausar.' : 'Para mudar ou apagar, altere a fonte ou o campo marcado como tarefa em Configurações das pipelines. Aqui dá só para pausar.'}</div>
            </div>
          </div>
          <dl className="detail-list">
            <dt>Quando</dt><dd>{automation?.trigger}</dd>
            <dt>Então</dt><dd>{automation?.detail}</dd>
            <dt>Pipeline</dt><dd>{automation?.pipeline}</dd>
            <dt>Execuções (nesta aba)</dt><dd>{automation?.runs ? `${automation.runs} · última em ${when(automation.lastRun)}` : 'Nenhuma ainda'}</dd>
          </dl>
        </div>
      ) : (
        <div className="form-stack">
          <Field label="Nome"><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
          <Field label="Quando isto acontecer" hint={trigger?.detail}>
            <CustomSelect className="select" value={triggerId} onChange={(e) => setTriggerId(e.target.value)}>
              {byCategory(EVENTS).map((g) => <optgroup key={g.c} label={g.c}>{g.items.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}</optgroup>)}
            </CustomSelect>
          </Field>
          <Field label="Onde vale">
            <CustomSelect className="select" value={pipeline} onChange={(e) => setPipeline(e.target.value)}>
              <option>Todas</option>
              {pipelineNames.map((n) => <option key={n}>{n}</option>)}
            </CustomSelect>
          </Field>
          <Field label="Então faça" hint={ACTIONS.find((a) => a.id === actionId)?.detail}>
            <CustomSelect className="select" value={actionId} onChange={(e) => setActionId(e.target.value)}>
              {byCategory(ACTIONS).map((g) => <optgroup key={g.c} label={g.c}>{g.items.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</optgroup>)}
            </CustomSelect>
          </Field>
          {actionId === 'email.enviar' ? (
            <Field label="Modelo de e-mail">
              <CustomSelect className="select" value={detail} onChange={(e) => setDetail(e.target.value)}>
                <option value="">Escolha um modelo…</option>
                {TEMPLATE_NAMES.map((t) => <option key={t} value={`Modelo: ${t}`}>{t}</option>)}
              </CustomSelect>
            </Field>
          ) : (
            <Field label="Detalhe" hint="Ex.: tag, pessoa a notificar, etapa de destino."><input className="input" value={detail} onChange={(e) => setDetail(e.target.value)} /></Field>
          )}
        </div>
      )}
    </SidePanel>
  );
}
