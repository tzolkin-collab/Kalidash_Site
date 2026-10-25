import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Copy, ExternalLink, Pencil, Plus, RotateCcw, Trash2, TriangleAlert, Unplug } from 'lucide-react';
import { pushErro } from '../lib/notify';
import { useCan } from '../lib/permissions';
import { activePipelines } from '../lib/stages';
import { useStore } from '../lib/store';
import { pipelinesStore } from '../mocks/pipelines';
import { LEAD_FIELDS, createForm, createProject, deleteForm, disconnectProject, loadProjects, updateForm, updateProject, useApiProjects } from '../lib/connectSync';
import type { ApiProject, FormInput, LeadField, ProjectInput, TrackedForm } from '../lib/connectSync';
import { loadTokens, useTokens } from '../lib/accessSync';
import { ago } from '../lib/scopes';
import { Badge, CustomSelect, EmptyState, Field, PopupDialog, SidePanel, Tabs } from './ui';
import { TokensTab } from './Access';

// Projetos conectados com a API ligada (CRM_API=1 e AUTH_API=1): o que aparece aqui está gravado no servidor.
// Projeto = uma LP/site da Kalidash; formulários rastreados = quais formulários o connect.js observa; as chaves
// (kld_live_/kld_test_) são os tokens de API do WP1.1, emitidos na aba Chaves de API (mesmo componente de Configurações).

type Tab = 'projects' | 'integrations' | 'keys';

const number = (n: number) => n.toLocaleString('pt-BR');
const FIELD_LABEL: Record<LeadField, string> = { nome: 'Nome', email: 'E-mail', telefone: 'Telefone', empresa: 'Empresa', cargo: 'Cargo', interesse: 'Interesse', mensagem: 'Mensagem' };

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="settings-pane form-stack">{children}</div>;
}

export default function ProjectsLive() {
  const can = useCan();
  const projects = useApiProjects();
  const tokens = useTokens();
  const [tab, setTab] = useState<Tab>('projects');

  useEffect(() => { if (can.manageKeys) { void loadProjects(); void loadTokens(); } }, [can.manageKeys]);

  if (!can.manageKeys) return <EmptyState title="Sem permissão para projetos">Só quem tem a permissão keys:manage (Admin e Gerente por padrão) gerencia projetos conectados e chaves de API.</EmptyState>;

  const keys = tokens.data?.filter((t) => t.status === 'ACTIVE' && t.projectId).length;
  return (
    <>
      <Tabs
        tabs={[{ id: 'projects' as Tab, label: 'Projetos', count: projects.data?.length }, { id: 'integrations' as Tab, label: 'Integrações' }, { id: 'keys' as Tab, label: 'Chaves de API', count: keys }]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'projects' && <ProjectsPane goKeys={() => setTab('keys')} />}
      {tab === 'integrations' && <IntegrationsPane />}
      {tab === 'keys' && <TokensTab />}
    </>
  );
}

function ProjectsPane({ goKeys }: { goKeys: () => void }) {
  const projects = useApiProjects();
  const tokens = useTokens();
  const [pipelines] = useStore(pipelinesStore);
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<ApiProject | 'new' | null>(null);
  const [formOf, setFormOf] = useState<{ project: ApiProject; form: TrackedForm | null } | null>(null);
  const [unplug, setUnplug] = useState<ApiProject | null>(null);

  const list = projects.data;
  const current = open ?? list?.[0]?.id ?? ''; // null: ainda não mexeu, abre o primeiro; '': fechou tudo

  if (projects.status === 'error' && !list) {
    return (
      <div className="acc-error" role="alert">
        <TriangleAlert size={18} />
        <div><strong>Não foi possível carregar os projetos.</strong><span>{projects.error}</span></div>
        <button type="button" className="btn" onClick={() => void loadProjects()}><RotateCcw size={14} /> Tentar de novo</button>
      </div>
    );
  }
  if (!list) return <div className="acc-skeleton" aria-busy="true" aria-label="Carregando">{[92, 81, 70].map((w) => <span key={w} style={{ width: `${w}%` }} />)}</div>;

  const pipeName = (p: ApiProject) => pipelines.find((x) => x.id === p.pipelineId)?.name ?? p.pipelineId ?? 'Sem funil';
  const stageName = (p: ApiProject) => pipelines.find((x) => x.id === p.pipelineId)?.stages.find((s) => s.id === p.stageId)?.name ?? p.stageId ?? '—';
  const keysOf = (p: ApiProject) => tokens.data?.filter((t) => t.projectId === p.id && t.status === 'ACTIVE') ?? [];

  const confirmUnplug = async () => {
    if (!unplug) return;
    const res = await disconnectProject(unplug.id);
    if ('error' in res) pushErro('Não foi possível desconectar o projeto', res.error);
    setUnplug(null);
  };

  return (
    <>
      <div className="pane-head">
        <p className="section-sub" style={{ margin: 0 }}>Cada projeto é uma LP ou site da Kalidash. O envio dos formulários vira um <strong>lead</strong> no funil escolhido, com a fonte do projeto. O que padroniza é o snippet, não a tecnologia.</p>
        <button type="button" className="btn btn-solid" onClick={() => setEditing('new')}><Plus size={14} /> Conectar projeto</button>
      </div>

      {list.length === 0 ? (
        <EmptyState title="Nenhum projeto conectado" action={<button type="button" className="btn btn-solid" onClick={() => setEditing('new')}><Plus size={14} /> Conectar o primeiro projeto</button>}>
          Conecte a LP ou o site, cadastre o formulário e emita uma chave do snippet. Os envios aparecem em Leads.
        </EmptyState>
      ) : (
        <div className="project-list">
          {list.map((p) => {
            const expanded = current === p.id;
            const k = keysOf(p);
            return (
              <article key={p.id} className="project-card">
                <button type="button" className="project-head" onClick={() => setOpen(expanded ? '' : p.id)} aria-expanded={expanded}>
                  {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <div className="cell-stack" style={{ flex: 1, textAlign: 'left' }}>
                    <span className="cell-primary">{p.name}</span>
                    <span className="text-xs text-muted">{p.url}</span>
                  </div>
                  <div className="tag-row">
                    <Badge tone={k.length ? 'success' : 'warning'}>{k.length ? `${k.length} chave${k.length > 1 ? 's' : ''} ativa${k.length > 1 ? 's' : ''}` : 'Sem chave'}</Badge>
                    <Badge tone={p.forms.length ? 'neutral' : 'warning'}>{p.forms.length} formulário{p.forms.length === 1 ? '' : 's'}</Badge>
                  </div>
                </button>
                {expanded && (
                  <div className="project-body">
                    <div className="stat-grid" style={{ marginBottom: '16px' }}>
                      <div className="stat-card"><div className="stat-label">Envios</div><div className="stat-value">{number(p.submissions)}</div></div>
                      <div className="stat-card"><div className="stat-label">Último envio</div><div className="stat-value" style={{ fontSize: '18px' }}>{p.lastSubmissionAt ? ago(p.lastSubmissionAt) : '—'}</div></div>
                      <div className="stat-card"><div className="stat-label">Fonte do lead</div><div className="stat-value" style={{ fontSize: '18px' }}>{p.sourceName}</div></div>
                      <div className="stat-card"><div className="stat-label">Entra em</div><div className="stat-value" style={{ fontSize: '18px' }}>{pipeName(p)} › {stageName(p)}</div></div>
                    </div>

                    <div className="pane-head" style={{ marginBottom: 8 }}>
                      <h3 className="section-title" style={{ margin: 0 }}>Formulários rastreados</h3>
                      <button type="button" className="btn btn-sm" onClick={() => setFormOf({ project: p, form: null })}><Plus size={12} /> Adicionar formulário</button>
                    </div>
                    {p.forms.length === 0 ? (
                      <p className="text-sm text-muted" style={{ margin: '0 0 16px' }}>Nenhum formulário cadastrado: o connect.js não observa nada neste projeto. Cadastre o seletor CSS do formulário da página.</p>
                    ) : (
                      <div className="table-card" style={{ marginBottom: 16 }}>
                        <div className="table-scroll">
                          <table className="data-table">
                            <thead><tr><th>Formulário</th><th>Seletor CSS</th><th>Campos mapeados</th><th>Envios</th><th style={{ width: 84 }}></th></tr></thead>
                            <tbody>
                              {p.forms.map((f) => (
                                <tr key={f.id}>
                                  <td className="cell-primary">{f.name}</td>
                                  <td><code className="mono">{f.selector}</code></td>
                                  <td className="text-muted">{Object.keys(f.fields).length ? Object.keys(f.fields).map((x) => FIELD_LABEL[x as LeadField] ?? x).join(', ') : 'Automático (por name/id)'}</td>
                                  <td>{number(f.submissions)}</td>
                                  <td>
                                    <div className="row-actions">
                                      <button type="button" className="icon-btn bare" onClick={() => setFormOf({ project: p, form: f })} aria-label={`Editar ${f.name}`}><Pencil size={14} /></button>
                                      <button type="button" className="icon-btn bare" onClick={async () => { const r = await deleteForm(p.id, f.id); if ('error' in r) pushErro('Não foi possível remover o formulário', r.error); }} aria-label={`Remover ${f.name}`}><Trash2 size={14} /></button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    <dl className="detail-list">
                      <dt>Site</dt><dd><a className="link-inline" href={p.url} target="_blank" rel="noreferrer noopener">{p.url} <ExternalLink size={11} /></a></dd>
                      <dt>Origens aceitas</dt><dd>{[new URL(p.url).origin, ...p.origins].join(', ')}</dd>
                      {p.stack && <><dt>Stack</dt><dd>{p.stack}</dd></>}
                      {p.description && <><dt>Descrição (SEO)</dt><dd>{p.description}</dd></>}
                      <dt>Chaves</dt><dd>{k.length ? k.map((t) => `${t.name}${t.env === 'test' ? ' (teste)' : ''}`).join(', ') : 'Nenhuma ativa.'} <button type="button" className="acc-link" onClick={goKeys}>Emitir ou revogar</button></dd>
                    </dl>
                    <div className="row-actions" style={{ marginTop: 16 }}>
                      <button type="button" className="btn btn-sm" onClick={() => setEditing(p)}><Pencil size={12} /> Editar projeto</button>
                      <button type="button" className="btn btn-sm btn-danger" onClick={() => setUnplug(p)}><Unplug size={12} /> Desconectar</button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {editing && <ProjectPanel project={editing === 'new' ? null : editing} pipelines={activePipelines(pipelines)} onClose={() => setEditing(null)} onSaved={(p) => { setOpen(p.id); setEditing(null); }} />}
      {formOf && <FormPanel project={formOf.project} form={formOf.form} onClose={() => setFormOf(null)} />}
      {unplug && (
        <PopupDialog
          eyebrow="DESCONECTAR PROJETO"
          tone="danger"
          title={`Desconectar “${unplug.name}”?`}
          description="O connect.js e as chaves deste projeto deixam de aceitar envios na hora. Os leads que já chegaram ficam. As chaves continuam na lista: revogue em Chaves de API."
          onClose={() => setUnplug(null)}
          footer={<><button type="button" className="btn" onClick={() => setUnplug(null)}>Cancelar</button><button type="button" className="btn btn-solid acc-btn-danger" onClick={() => void confirmUnplug()}>Desconectar agora</button></>}
        />
      )}
    </>
  );
}

function ProjectPanel({ project, pipelines, onClose, onSaved }: { project: ApiProject | null; pipelines: ReturnType<typeof activePipelines>; onClose: () => void; onSaved: (p: ApiProject) => void }) {
  const firstWith = pipelines.find((p) => p.stages.some((s) => s.kind === 'LEAD'));
  const [name, setName] = useState(project?.name ?? '');
  const [url, setUrl] = useState(project?.url ?? 'https://');
  const [stack, setStack] = useState(project?.stack ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [pipelineId, setPipelineId] = useState(project?.pipelineId ?? firstWith?.id ?? '');
  const leadStages = useMemo(() => pipelines.find((p) => p.id === pipelineId)?.stages.filter((s) => s.kind === 'LEAD') ?? [], [pipelines, pipelineId]);
  const [stageId, setStageId] = useState(project?.stageId ?? leadStages[0]?.id ?? '');
  const [sourceName, setSourceName] = useState(project?.sourceName ?? '');
  const [origins, setOrigins] = useState((project?.origins ?? []).join('\n'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urlOk = /^https?:\/\/[^\s/]+\.[^\s/]+|^https?:\/\/localhost/.test(url);
  const stage = leadStages.some((s) => s.id === stageId) ? stageId : leadStages[0]?.id ?? '';
  const ready = name.trim() && urlOk && pipelineId && stage && !busy;

  const save = async () => {
    setBusy(true);
    setError(null);
    const input: ProjectInput = { name: name.trim(), url: url.trim(), stack: stack.trim(), description: description.trim(), pipelineId, stageId: stage, sourceName: sourceName.trim() || name.trim(), origins: origins.split(/\s+/).filter(Boolean) };
    const res = project ? await updateProject(project.id, input) : await createProject(input);
    setBusy(false);
    if ('error' in res) setError(res.error);
    else onSaved(res.data);
  };

  return (
    <SidePanel
      title={project ? 'Editar projeto' : 'Conectar projeto'}
      subtitle="Depois de salvar, cadastre o formulário e emita uma chave do snippet."
      onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="button" className="btn btn-solid" disabled={!ready} onClick={() => void save()}>{busy ? 'Salvando…' : project ? 'Salvar' : 'Conectar'}</button></>}
    >
      <div className="form-stack">
        <Field label="Nome do projeto"><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
        <Field label="URL" hint={url && !urlOk ? 'Informe o endereço completo, com https://.' : 'Só envios vindos deste endereço (Origin) são aceitos.'}><input className="input" value={url} onChange={(e) => setUrl(e.target.value)} /></Field>
        <div className="form-grid">
          <Field label="Funil dos leads"><CustomSelect className="select" value={pipelineId} onChange={(e) => setPipelineId(e.target.value)} aria-label="Funil">{pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</CustomSelect></Field>
          <Field label="Coluna de entrada" hint={leadStages.length === 0 ? 'Este funil não tem coluna de leads.' : undefined}><CustomSelect className="select" value={stage} onChange={(e) => setStageId(e.target.value)} aria-label="Coluna">{leadStages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</CustomSelect></Field>
        </div>
        <Field label="Fonte do lead" hint="Aparece no lead como origem inbound. Vazio: o nome do projeto."><input className="input" value={sourceName} onChange={(e) => setSourceName(e.target.value)} placeholder={name || 'Nome do projeto'} /></Field>
        <Field label="Outras origens aceitas" hint="Uma por linha, só esquema e domínio. Ex.: https://www.exemplo.com.br ou https://*.vercel.app"><textarea className="textarea" value={origins} onChange={(e) => setOrigins(e.target.value)} rows={3} /></Field>
        <Field label="Stack"><input className="input" value={stack} onChange={(e) => setStack(e.target.value)} placeholder="Ex.: WordPress, Next.js, HTML estático" /></Field>
        <Field label="Descrição (SEO)"><textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        {error && <div className="acc-error" role="alert"><TriangleAlert size={16} /><div><strong>Não foi possível salvar.</strong><span>{error}</span></div></div>}
      </div>
    </SidePanel>
  );
}

function FormPanel({ project, form, onClose }: { project: ApiProject; form: TrackedForm | null; onClose: () => void }) {
  const [name, setName] = useState(form?.name ?? '');
  const [selector, setSelector] = useState(form?.selector ?? '');
  const [consent, setConsent] = useState(form?.consentSelector ?? '');
  const [fields, setFields] = useState<Partial<Record<LeadField, string>>>(form?.fields ?? {});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    const input: FormInput = { name: name.trim(), selector: selector.trim(), consentSelector: consent.trim(), fields: Object.fromEntries(Object.entries(fields).filter(([, v]) => v?.trim()).map(([k, v]) => [k, v!.trim()])) };
    const res = form ? await updateForm(project.id, form.id, input) : await createForm(project.id, input);
    setBusy(false);
    if ('error' in res) setError(res.error);
    else onClose();
  };

  return (
    <SidePanel
      title={form ? 'Editar formulário' : 'Adicionar formulário'}
      subtitle={`Projeto ${project.name}. O connect.js só observa os formulários cadastrados aqui.`}
      onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="button" className="btn btn-solid" disabled={!name.trim() || !selector.trim() || busy} onClick={() => void save()}>{busy ? 'Salvando…' : 'Salvar'}</button></>}
    >
      <div className="form-stack">
        <Field label="Nome"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Fale conosco" autoFocus /></Field>
        <Field label="Seletor CSS do formulário" hint="Ex.: #form-contato ou form.contact. Vale também para formulários criados depois (modais)."><input className="input mono" value={selector} onChange={(e) => setSelector(e.target.value)} placeholder="#form-contato" /></Field>
        <fieldset className="scope-box">
          <legend className="field-label">Campos (opcional)</legend>
          <p className="text-xs text-muted" style={{ margin: '0 0 8px' }}>Deixe vazio para o connect.js achar sozinho pelo name/id (nome, email, telefone…). Preencha só se a página usar nomes diferentes.</p>
          {LEAD_FIELDS.map((f) => (
            <label key={f} className="scope-row">
              <span className="cell-stack" style={{ width: 90 }}><span className="text-sm">{FIELD_LABEL[f]}</span></span>
              <input className="input mono" value={fields[f] ?? ''} onChange={(e) => setFields((prev) => ({ ...prev, [f]: e.target.value }))} placeholder="automático" aria-label={`Seletor de ${FIELD_LABEL[f]}`} />
            </label>
          ))}
        </fieldset>
        <Field label="Caixa de consentimento (opcional)" hint="Se informada e desmarcada, o connect.js não envia."><input className="input mono" value={consent} onChange={(e) => setConsent(e.target.value)} placeholder="#lgpd" /></Field>
        {error && <div className="acc-error" role="alert"><TriangleAlert size={16} /><div><strong>Não foi possível salvar.</strong><span>{error}</span></div></div>}
      </div>
    </SidePanel>
  );
}

function IntegrationsPane() {
  const projects = useApiProjects().data ?? [];
  const testHtml = `<form id="form-contato">
  <input name="nome" placeholder="Seu nome" required>
  <input name="email" type="email" placeholder="Seu e-mail" required>
  <input name="telefone" placeholder="WhatsApp">
  <textarea name="mensagem"></textarea>
  <!-- armadilha para robôs: invisível para pessoas -->
  <input name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px">
  <button type="submit">Enviar</button>
</form>`;
  const [copied, setCopied] = useState(false);
  return (
    <Panel>
      <section className="panel-card">
        <h2 className="section-title">Como conectar uma página (connect.js)</h2>
        <ol className="text-sm" style={{ margin: '0 0 12px', paddingLeft: 18, display: 'grid', gap: 6 }}>
          <li>Em <strong>Projetos</strong>, conecte o site ({projects.length ? `${projects.length} conectado${projects.length > 1 ? 's' : ''}` : 'nenhum ainda'}) e cadastre o seletor do formulário.</li>
          <li>Em <strong>Chaves de API</strong>, emita uma <strong>chave do snippet</strong> do projeto (produção <code>kld_live_</code> ou teste <code>kld_test_</code>). O token aparece uma única vez, já com a tag pronta.</li>
          <li>Cole a tag antes de <code>&lt;/body&gt;</code>. O script não toca no seu HTML nem no seu CSS e não bloqueia o envio normal do formulário.</li>
          <li>Cada envio cria um <strong>lead</strong> (não uma oportunidade) no funil do projeto, com a fonte do projeto e a atribuição (UTMs, página). Chaves de teste marcam o lead com a tag <em>Teste</em>.</li>
        </ol>
        <p className="text-xs text-muted" style={{ margin: 0 }}>A chave do snippet só escreve leads daquele projeto e só vale vinda da página cadastrada (Origin). Chave de leitura (<code>leads:read</code>, <code>ads:read</code>) nunca vai no HTML: o servidor nem emite uma chave que misture os dois. Limite: 10 envios por minuto por IP e 60 por chave.</p>
      </section>
      <section className="panel-card">
        <h2 className="section-title">API direta (servidor para servidor)</h2>
        <p className="section-sub">O servidor da página faz o mesmo POST, sem o navegador:</p>
        <pre className="acc-code-block">{`curl -X POST ${location.protocol}//SUA-API/api/connect/leads \\
  -H "Authorization: Bearer kld_live_…" -H "Content-Type: application/json" \\
  -d '{"form":"#form-contato","lead":{"nome":"Maria Souza","email":"maria@exemplo.com","telefone":"11999998888","mensagem":"Quero saber mais"}}'`}</pre>
      </section>
      <section className="panel-card">
        <h2 className="section-title">Formulário de teste</h2>
        <p className="section-sub">Um formulário mínimo para colar na página e conferir o lead em Leads. O campo <code>website</code> é o honeypot: preenchido, o envio é descartado.</p>
        <div className="code-box">
          <code style={{ whiteSpace: 'pre-wrap' }}>{testHtml}</code>
          <button type="button" className="btn btn-sm" onClick={() => { void navigator.clipboard?.writeText(testHtml).then(() => setCopied(true)).catch(() => undefined); }}><Copy size={12} /> {copied ? 'Copiado' : 'Copiar'}</button>
        </div>
      </section>
      <section className="panel-card">
        <h2 className="section-title">Outras conexões</h2>
        <ul className="row-list" style={{ margin: 0 }}>
          <li className="row-item"><div className="cell-stack"><span className="cell-primary">Formulário do site público</span><span className="text-xs text-muted">O formulário do diagnóstico da Home ainda usa POST /api/public/leads (cria oportunidade INBOUND) até a migração do WP3.</span></div><Badge>Fora deste pacote</Badge></li>
          <li className="row-item"><div className="cell-stack"><span className="cell-primary">Webhooks de entrada e de saída</span><span className="text-xs text-muted">Configurados em Configurações.</span></div><a className="btn btn-sm" href="#/configuracoes">Abrir</a></li>
        </ul>
      </section>
    </Panel>
  );
}
