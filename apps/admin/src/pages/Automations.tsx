import { useMemo, useState } from 'react';
import { ArrowRight, Link2, Plus, Trash2 } from 'lucide-react';
import type { AutomationCategory } from '../domain';
import { newId, useStore } from '../lib/store';
import { ACTIONS, CATEGORIES, EVENTS, actionLabel, automationsStore, runLog } from '../mocks/automations';
import type { AutomationRow } from '../mocks/automations';
import { pipelinesStore } from '../mocks/pipelines';
import { Badge, EmptyState, Field, Page, PageHeader, SampleBanner, SearchBox, SidePanel, Switch, Tabs } from '../components/ui';

type Tab = 'automations' | 'catalog' | 'runs';

const TEMPLATE_NAMES = ['Boas-vindas (Inbound)', 'Follow-up Reunião'];
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

export default function Automations() {
  const [automations, setAutomations] = useStore(automationsStore);
  const [pipelines] = useStore(pipelinesStore);
  const [tab, setTab] = useState<Tab>('automations');
  const [category, setCategory] = useState<'' | AutomationCategory>('');
  const [origin, setOrigin] = useState<'' | 'MANUAL' | 'MANAGED'>('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<AutomationRow | 'new' | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return automations.filter((a) => (!category || a.category === category) && (!origin || a.origin === origin) && (!q || `${a.name} ${a.trigger} ${a.action}`.toLowerCase().includes(q)));
  }, [automations, category, origin, search]);

  const toggle = (id: string, active: boolean) => setAutomations((prev) => prev.map((a) => (a.id === id ? { ...a, active } : a)));
  const remove = (id: string) => { setAutomations((prev) => prev.filter((a) => a.id !== id)); setEditing(null); };
  const save = (row: AutomationRow) => {
    setAutomations((prev) => (prev.some((a) => a.id === row.id) ? prev.map((a) => (a.id === row.id ? row : a)) : [row, ...prev]));
    setEditing(null);
  };

  const managedCount = automations.filter((a) => a.origin === 'MANAGED').length;

  return (
    <Page>
      <PageHeader
        title="Automações"
        subtitle="Tudo o que o sistema faz sozinho, classificado por assunto. As gerenciadas nascem por trás dos panos quando você conecta uma fonte ou marca um campo como tarefa."
        actions={<button type="button" className="btn btn-solid" onClick={() => setEditing('new')}><Plus size={14} /> Nova automação</button>}
      />
      <SampleBanner phase={5} />

      <Tabs
        tabs={[{ id: 'automations' as Tab, label: 'Automações', count: automations.length }, { id: 'catalog' as Tab, label: 'Catálogo' }, { id: 'runs' as Tab, label: 'Execuções', count: runLog.length }]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'automations' && (
        <>
          <div className="chip-row" role="group" aria-label="Filtrar por assunto">
            <button type="button" className={`chip ${category === '' ? 'active' : ''}`} onClick={() => setCategory('')}>Todas <span className="tab-count">{automations.length}</span></button>
            {CATEGORIES.map((c) => (
              <button key={c} type="button" className={`chip ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>
                {c} <span className="tab-count">{automations.filter((a) => a.category === c).length}</span>
              </button>
            ))}
          </div>
          <div className="toolbar">
            <SearchBox value={search} onChange={setSearch} placeholder="Buscar automação, gatilho ou ação…" />
            <select className="select select-sm" value={origin} onChange={(e) => setOrigin(e.target.value as '' | 'MANUAL' | 'MANAGED')} aria-label="Filtrar por origem">
              <option value="">Manuais e gerenciadas</option>
              <option value="MANUAL">Manuais</option>
              <option value="MANAGED">Gerenciadas ({managedCount})</option>
            </select>
          </div>

          <div className="table-card">
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Automação</th><th>Quando → Então</th><th>Última execução</th><th>Execuções</th><th style={{ width: '70px' }}>Ativa</th></tr></thead>
                <tbody>
                  {filtered.map((a) => (
                    <tr key={a.id} className="clickable" onClick={() => setEditing(a)} style={{ opacity: a.active ? 1 : 0.6 }}>
                      <td>
                        <div className="cell-stack">
                          <span className="cell-primary">{a.name}</span>
                          <span className="tag-row" style={{ marginTop: '4px' }}>
                            <Badge tone={a.origin === 'MANAGED' ? 'accent' : 'neutral'} title={a.managedBy}>{a.origin === 'MANAGED' ? <><Link2 size={10} /> Gerenciada</> : 'Manual'}</Badge>
                            <Badge>{a.category}</Badge>
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="flow-line"><span>{a.trigger}</span><ArrowRight size={13} className="text-muted" /><span>{a.action}</span></div>
                        <div className="text-xs text-muted">{a.detail}</div>
                      </td>
                      <td className="text-muted">{when(a.lastRun)}</td>
                      <td>{a.runs}</td>
                      <td onClick={(e) => e.stopPropagation()}><Switch checked={a.active} onChange={(v) => toggle(a.id, v)} label={`Ativar ${a.name}`} /></td>
                    </tr>
                  ))}
                  {filtered.length === 0 && <tr><td colSpan={5}><EmptyState title="Nenhuma automação aqui">Ajuste os filtros ou crie uma nova.</EmptyState></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

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
            <table className="data-table">
              <thead><tr><th>Quando</th><th>Automação</th><th>Evento</th><th>Resultado</th><th>Detalhe</th></tr></thead>
              <tbody>
                {runLog.map((r) => (
                  <tr key={r.id}>
                    <td className="text-muted">{when(r.at)}</td>
                    <td>{r.automation}</td>
                    <td><code className="mono">{r.event}</code></td>
                    <td><Badge tone={r.result === 'OK' ? 'success' : 'danger'}>{r.result === 'OK' ? 'Executada' : 'Falhou'}</Badge></td>
                    <td className="text-muted">{r.note}</td>
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
          pipelineNames={pipelines.map((p) => p.name)}
          onClose={() => setEditing(null)}
          onSave={save}
          onDelete={remove}
        />
      )}
    </Page>
  );
}

type PanelProps = { automation: AutomationRow | null; pipelineNames: string[]; onClose: () => void; onSave: (a: AutomationRow) => void; onDelete: (id: string) => void };

function AutomationPanel({ automation, pipelineNames, onClose, onSave, onDelete }: PanelProps) {
  const managed = automation?.origin === 'MANAGED';
  const [name, setName] = useState(automation?.name ?? '');
  const [triggerId, setTriggerId] = useState(automation?.triggerId ?? EVENTS[0].id);
  const [actionId, setActionId] = useState(automation?.actionId ?? ACTIONS[0].id);
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
              <div className="text-xs">Foi criada por "{automation?.managedBy}". Para mudar ou apagar, altere a fonte ou o campo marcado como tarefa em Configurações das pipelines. Aqui dá só para pausar.</div>
            </div>
          </div>
          <dl className="detail-list">
            <dt>Quando</dt><dd>{automation?.trigger}</dd>
            <dt>Então</dt><dd>{automation?.action}</dd>
            <dt>Detalhe</dt><dd>{automation?.detail}</dd>
            <dt>Pipeline</dt><dd>{automation?.pipeline}</dd>
            <dt>Execuções</dt><dd>{automation?.runs} · última em {when(automation?.lastRun)}</dd>
          </dl>
        </div>
      ) : (
        <div className="form-stack">
          <Field label="Nome"><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
          <Field label="Quando isto acontecer" hint={trigger?.detail}>
            <select className="select" value={triggerId} onChange={(e) => setTriggerId(e.target.value)}>
              {byCategory(EVENTS).map((g) => <optgroup key={g.c} label={g.c}>{g.items.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}</optgroup>)}
            </select>
          </Field>
          <Field label="Onde vale">
            <select className="select" value={pipeline} onChange={(e) => setPipeline(e.target.value)}>
              <option>Todas</option>
              {pipelineNames.map((n) => <option key={n}>{n}</option>)}
            </select>
          </Field>
          <Field label="Então faça" hint={ACTIONS.find((a) => a.id === actionId)?.detail}>
            <select className="select" value={actionId} onChange={(e) => setActionId(e.target.value)}>
              {byCategory(ACTIONS).map((g) => <optgroup key={g.c} label={g.c}>{g.items.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</optgroup>)}
            </select>
          </Field>
          {actionId === 'email.enviar' ? (
            <Field label="Modelo de e-mail">
              <select className="select" value={detail} onChange={(e) => setDetail(e.target.value)}>
                <option value="">Escolha um modelo…</option>
                {TEMPLATE_NAMES.map((t) => <option key={t} value={`Modelo: ${t}`}>{t}</option>)}
              </select>
            </Field>
          ) : (
            <Field label="Detalhe" hint="Ex.: tag, pessoa a notificar, etapa de destino."><input className="input" value={detail} onChange={(e) => setDetail(e.target.value)} /></Field>
          )}
        </div>
      )}
    </SidePanel>
  );
}
