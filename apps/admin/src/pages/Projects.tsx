import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Copy, ExternalLink, KeyRound, Plus, ShieldOff } from 'lucide-react';
import type { ApiKey, ApiKeyScope, ConnectedProject } from '../domain';
import { formatDate } from '../lib/format';
import { newId, useStore } from '../lib/store';
import { SCOPE_INFO, apiKeysStore, projectsStore } from '../mocks/projects';
import { Badge, EmptyState, Field, Page, PageHeader, SampleBanner, SidePanel, Tabs } from '../components/ui';
import type { Tone } from '../components/ui';

type Tab = 'projects' | 'integrations' | 'keys';

const STATUS_TONE: Record<string, Tone> = { ACTIVE: 'success', PENDING: 'warning', ERROR: 'danger' };
const STATUS_LABEL: Record<string, string> = { ACTIVE: 'Ativo', PENDING: 'Pendente', ERROR: 'Erro' };
const rate = (a: number, b: number) => (b === 0 ? '—' : `${((a / b) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);
const number = (n: number) => n.toLocaleString('pt-BR');

const KEY_FORMAT = /^kld_(live|test)_[0-9a-f]{9,32}$/;

function randomHex(bytes: number) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function Projects() {
  const [projects] = useStore(projectsStore);
  const [keys] = useStore(apiKeysStore);
  const [tab, setTab] = useState<Tab>('projects');

  return (
    <Page>
      <PageHeader title="Projetos conectados" subtitle="As LPs, sites e formulários que a Kalidash lança, com o Connect instalado. Daqui saem também as integrações e as chaves de API." />
      <SampleBanner phase={5}>Projetos, métricas e chaves são de exemplo: nenhuma chave emitida aqui vale de verdade no servidor.</SampleBanner>
      <Tabs
        tabs={[{ id: 'projects' as Tab, label: 'Projetos', count: projects.length }, { id: 'integrations' as Tab, label: 'Integrações' }, { id: 'keys' as Tab, label: 'Chaves de API', count: keys.filter((k) => k.status === 'ACTIVE').length }]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'projects' && <ProjectsTab />}
      {tab === 'integrations' && <IntegrationsTab />}
      {tab === 'keys' && <KeysTab />}
    </Page>
  );
}

/* ------------------------------ Projetos ------------------------------ */

function ProjectsTab() {
  const [projects, setProjects] = useStore(projectsStore);
  const [open, setOpen] = useState<string | null>(projects[0]?.id ?? null);
  const [adding, setAdding] = useState(false);

  return (
    <>
      <div className="pane-head">
        <p className="section-sub" style={{ margin: 0 }}>Cada projeto pode viver em uma stack diferente: o que padroniza é o snippet, não a tecnologia.</p>
        <button type="button" className="btn btn-solid" onClick={() => setAdding(true)}><Plus size={14} /> Conectar projeto</button>
      </div>
      <div className="project-list">
        {projects.map((p) => {
          const expanded = open === p.id;
          return (
            <article key={p.id} className="project-card">
              <button type="button" className="project-head" onClick={() => setOpen(expanded ? null : p.id)} aria-expanded={expanded}>
                {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <div className="cell-stack" style={{ flex: 1, textAlign: 'left' }}>
                  <span className="cell-primary">{p.name}</span>
                  <span className="text-xs text-muted">{p.url}</span>
                </div>
                <div className="tag-row">{p.modules.map((m) => <Badge key={m.name} tone={STATUS_TONE[m.status]}>{m.name}: {STATUS_LABEL[m.status]}</Badge>)}</div>
              </button>
              {expanded && (
                <div className="project-body">
                  <div className="stat-grid" style={{ marginBottom: '16px' }}>
                    <div className="stat-card"><div className="stat-label">Visitas</div><div className="stat-value">{number(p.visits)}</div></div>
                    <div className="stat-card"><div className="stat-label">Envios</div><div className="stat-value">{number(p.submissions)}</div></div>
                    <div className="stat-card"><div className="stat-label">Conversão</div><div className="stat-value">{rate(p.submissions, p.visits)}</div></div>
                    <div className="stat-card"><div className="stat-label">Principal origem</div><div className="stat-value" style={{ fontSize: '18px' }}>{p.topOrigin}</div></div>
                  </div>
                  <h3 className="section-title">Formulários rastreados</h3>
                  <div className="table-card">
                    <div className="table-scroll">
                      <table className="data-table">
                        <thead><tr><th>Formulário</th><th>Seletor CSS</th><th>Campos</th><th>Visualizações</th><th>Envios</th><th>Conversão</th></tr></thead>
                        <tbody>
                          {p.forms.map((f) => (
                            <tr key={f.id}>
                              <td className="cell-primary">{f.name}</td>
                              <td><code className="mono">{f.selector}</code></td>
                              <td>{f.fields}</td>
                              <td>{number(f.views)}</td>
                              <td>{number(f.submissions)}</td>
                              <td>{rate(f.submissions, f.views)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <dl className="detail-list" style={{ marginTop: '16px' }}>
                    <dt>Site</dt><dd><a className="link-inline" href={p.url} target="_blank" rel="noreferrer noopener">{p.url} <ExternalLink size={11} /></a></dd>
                    <dt>Stack</dt><dd>{p.stack}</dd>
                    <dt>Descrição (SEO)</dt><dd>{p.description}</dd>
                  </dl>
                </div>
              )}
            </article>
          );
        })}
      </div>
      {adding && <NewProjectPanel onClose={() => setAdding(false)} onCreate={(p) => { setProjects((prev) => [...prev, p]); setOpen(p.id); setAdding(false); }} />}
    </>
  );
}

function NewProjectPanel({ onClose, onCreate }: { onClose: () => void; onCreate: (p: ConnectedProject) => void }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('https://');
  const [stack, setStack] = useState('');
  const [description, setDescription] = useState('');
  const urlOk = /^https?:\/\/[^\s/]+\.[^\s/]+/.test(url);

  return (
    <SidePanel
      title="Conectar projeto"
      subtitle="Depois de criar, emita uma chave de API e instale o snippet do Connect na página."
      onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="button" className="btn btn-solid" disabled={!name.trim() || !urlOk} onClick={() => onCreate({ id: newId('prj'), name: name.trim(), url: url.trim(), description: description.trim(), stack: stack.trim() || '—', modules: [{ name: 'Formulário', status: 'PENDING' }], forms: [], visits: 0, submissions: 0, topOrigin: '—' })}>Conectar</button></>}
    >
      <div className="form-stack">
        <Field label="Nome do projeto"><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
        <Field label="URL" hint={url && !urlOk ? 'Informe o endereço completo, com https://.' : undefined}><input className="input" value={url} onChange={(e) => setUrl(e.target.value)} /></Field>
        <Field label="Stack"><input className="input" value={stack} onChange={(e) => setStack(e.target.value)} placeholder="Ex.: WordPress, Next.js, HTML estático" /></Field>
        <Field label="Descrição (SEO)"><textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      </div>
    </SidePanel>
  );
}

/* ------------------------------ Integrações ------------------------------ */

const CDN_PLACEHOLDER = 'https://cdn.exemplo.com.br/connect.js';

function IntegrationsTab() {
  const [keys] = useStore(apiKeysStore);
  const [projects] = useStore(projectsStore);
  const [pasted, setPasted] = useState('');
  const [sent, setSent] = useState<string | null>(null);

  const usable = keys.filter((k) => k.status === 'ACTIVE' && k.scopes.includes('forms:write'));
  const [keyId, setKeyId] = useState(usable[0]?.id ?? '');
  const key = usable.find((k) => k.id === keyId);
  const snippet = key ? `<script src="${CDN_PLACEHOLDER}" data-key="${key.prefix}…" defer></script>` : '';

  const dataKey = /data-key=["']([^"']+)["']/.exec(pasted)?.[1]?.replace(/…$/, '');
  const keyValid = dataKey !== undefined && KEY_FORMAT.test(dataKey);
  const pastedProject = keys.find((k) => dataKey && k.prefix.startsWith(dataKey.slice(0, 18)))?.project;
  const activeIntegrations = projects.filter((p) => p.modules.some((m) => m.name === 'Formulário' && m.status === 'ACTIVE'));

  return (
    <div className="settings-pane form-stack">
      <section className="panel-card">
        <h2 className="section-title">Integrador de formulário (Connect)</h2>
        <p className="section-sub">O snippet só carrega uma chave pública emitida em "Chaves de API", com escopo de escrita. Não existe renderizador de formulário: o objetivo é gerar o token.</p>
        {usable.length === 0 ? (
          <EmptyState title="Nenhuma chave disponível">Emita uma chave com o escopo forms:write na aba Chaves de API.</EmptyState>
        ) : (
          <>
            <Field label="Chave do snippet">
              <select className="select" value={keyId} onChange={(e) => setKeyId(e.target.value)}>{usable.map((k) => <option key={k.id} value={k.id}>{k.name} ({k.prefix}…)</option>)}</select>
            </Field>
            <div className="code-box">
              <code>{snippet}</code>
              <button type="button" className="btn btn-sm" onClick={() => void navigator.clipboard?.writeText(snippet)}><Copy size={12} /> Copiar</button>
            </div>
            <p className="text-xs text-muted">Troque o endereço do script pelo da CDN do Connect. A chave completa só aparece na hora da emissão; aqui vai o prefixo.</p>
          </>
        )}
      </section>

      <section className="panel-card">
        <h2 className="section-title">Página de exemplo</h2>
        <p className="section-sub">Cole o snippet de um projeto e veja uma página com formulário (com CSS próprio) que já envia ao admin.</p>
        <textarea className="textarea mono" value={pasted} onChange={(e) => { setPasted(e.target.value); setSent(null); }} placeholder={'<script src="…/connect.js" data-key="kld_live_…" defer></script>'} />
        {pasted.trim() !== '' && (
          <div className="preview-page" aria-label="Prévia da página">
            <div className="preview-bar"><span /><span /><span /><em>{pastedProject ? projects.find((p) => p.name === pastedProject)?.url ?? 'sua-pagina' : 'sua-pagina'}</em></div>
            {keyValid ? (
              <form className="preview-form" onSubmit={(e) => { e.preventDefault(); setSent(`Envio de teste simulado com a chave ${dataKey}…, escopo forms:write. Em produção, isto criaria um lead na fonte deste projeto.`); }}>
                <h4>Fale com a gente</h4>
                <input placeholder="Seu nome" required />
                <input type="email" placeholder="Seu e-mail" required />
                <button type="submit">Enviar</button>
                {sent && <p className="preview-ok" role="status">{sent}</p>}
              </form>
            ) : (
              <div className="preview-form"><p className="preview-warn"><AlertTriangle size={14} /> Não achei um <code>data-key</code> válido (kld_live_… ou kld_test_…). Copie o snippet acima.</p></div>
            )}
          </div>
        )}
      </section>

      <section className="panel-card">
        <h2 className="section-title">Conexões</h2>
        <ul className="row-list" style={{ margin: 0 }}>
          <li className="row-item">
            <div className="cell-stack"><span className="cell-primary">Formulários ativos</span><span className="text-xs text-muted">{activeIntegrations.length ? activeIntegrations.map((p) => p.name).join(', ') : 'Nenhum projeto com o módulo Formulário ativo.'}</span></div>
            <Badge tone={activeIntegrations.length ? 'success' : 'warning'}>{activeIntegrations.length} ativa{activeIntegrations.length === 1 ? '' : 's'}</Badge>
          </li>
          <li className="row-item">
            <div className="cell-stack"><span className="cell-primary">Google (Meet, Gmail, Drive)</span><span className="text-xs text-muted">Depende do login com Google, que entra na fase de segurança.</span></div>
            <Badge>Não conectado</Badge>
          </li>
          <li className="row-item">
            <div className="cell-stack"><span className="cell-primary">Webhooks de saída e de entrada</span><span className="text-xs text-muted">Configurados em Configurações.</span></div>
            <a className="btn btn-sm" href="#/configuracoes">Abrir</a>
          </li>
        </ul>
      </section>
    </div>
  );
}

/* ------------------------------ Chaves de API ------------------------------ */

function KeysTab() {
  const [keys, setKeys] = useStore(apiKeysStore);
  const [issuing, setIssuing] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const revoke = (id: string) => {
    setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, status: 'REVOKED' } : k)));
    setRevoking(null);
  };

  return (
    <>
      <div className="pane-head">
        <p className="section-sub" style={{ margin: 0 }}>Formato <code className="mono">kld_live_…</code> ou <code className="mono">kld_test_…</code>. O token completo aparece uma única vez; depois ficam só o prefixo e um hash SHA-256. Revogar uma chave não afeta as demais.</p>
        <button type="button" className="btn btn-solid" onClick={() => setIssuing(true)}><KeyRound size={14} /> Emitir chave</button>
      </div>
      <div className="table-card">
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Chave</th><th>Ambiente</th><th>Projeto</th><th>Escopos</th><th>Criada</th><th>Último uso</th><th>Status</th><th style={{ width: '100px' }}></th></tr></thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} style={{ opacity: k.status === 'REVOKED' ? 0.6 : 1 }}>
                  <td><div className="cell-stack"><span className="cell-primary">{k.name}</span><code className="mono text-muted">{k.prefix}…</code></div></td>
                  <td><Badge tone={k.env === 'live' ? 'info' : 'neutral'}>{k.env === 'live' ? 'Produção' : 'Teste'}</Badge></td>
                  <td>{k.project}</td>
                  <td><div className="tag-row">{k.scopes.map((s) => <Badge key={s} tone={SCOPE_INFO[s].publicSafe ? 'neutral' : 'warning'} title={SCOPE_INFO[s].hint}>{s}</Badge>)}</div></td>
                  <td className="text-muted">{formatDate(k.createdAt)}</td>
                  <td className="text-muted">{k.lastUsedAt ? formatDate(k.lastUsedAt) : 'Nunca'}</td>
                  <td><Badge tone={k.status === 'ACTIVE' ? 'success' : 'danger'}>{k.status === 'ACTIVE' ? 'Ativa' : 'Revogada'}</Badge></td>
                  <td>
                    {k.status === 'ACTIVE' && (revoking === k.id
                      ? <div className="row-actions"><button type="button" className="btn btn-sm btn-danger" onClick={() => revoke(k.id)}>Revogar</button><button type="button" className="btn btn-sm" onClick={() => setRevoking(null)}>Não</button></div>
                      : <button type="button" className="btn btn-sm" onClick={() => setRevoking(k.id)}><ShieldOff size={12} /> Revogar</button>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {issuing && <IssueKeyPanel onClose={() => setIssuing(false)} onIssued={(k) => setKeys((prev) => [k, ...prev])} />}
    </>
  );
}

const ALL_SCOPES: ApiKeyScope[] = ['forms:write', 'analytics:write', 'ads:read', 'leads:read'];

function IssueKeyPanel({ onClose, onIssued }: { onClose: () => void; onIssued: (k: ApiKey) => void }) {
  const [projects] = useStore(projectsStore);
  const [name, setName] = useState('');
  const [env, setEnv] = useState<'live' | 'test'>('live');
  const [project, setProject] = useState(projects[0]?.name ?? '');
  const [scopes, setScopes] = useState<ApiKeyScope[]>(['forms:write']);
  const [token, setToken] = useState<string | null>(null);

  const risky = useMemo(() => scopes.filter((s) => !SCOPE_INFO[s].publicSafe), [scopes]);
  const toggle = (s: ApiKeyScope) => setScopes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const issue = () => {
    const full = `kld_${env}_${randomHex(16)}`;
    setToken(full);
    onIssued({ id: newId('k'), name: name.trim(), env, prefix: full.slice(0, 18), project, scopes, createdAt: new Date().toISOString(), status: 'ACTIVE' });
  };

  if (token) {
    return (
      <SidePanel title="Chave emitida" subtitle="Copie agora. Depois desta tela só o prefixo fica visível." onClose={onClose} footer={<button type="button" className="btn btn-solid" onClick={onClose}>Já copiei</button>}>
        <div className="form-stack">
          <div className="code-box"><code>{token}</code><button type="button" className="btn btn-sm" onClick={() => void navigator.clipboard?.writeText(token)}><Copy size={12} /> Copiar</button></div>
          <div className="task-callout" role="note"><AlertTriangle size={16} /><div><strong>Chave de exemplo.</strong><div className="text-xs">Foi gerada aqui no navegador e não existe no servidor. Quando a API de chaves existir, ela guardará só o hash SHA-256.</div></div></div>
        </div>
      </SidePanel>
    );
  }

  return (
    <SidePanel
      title="Emitir chave de API"
      subtitle="Chaves do snippet devem ter só escopos de escrita, porque ficam visíveis no HTML."
      onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="button" className="btn btn-solid" disabled={!name.trim() || scopes.length === 0} onClick={issue}>Emitir</button></>}
    >
      <div className="form-stack">
        <Field label="Nome"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Connect da LP Consultoria" autoFocus /></Field>
        <div className="form-grid">
          <Field label="Ambiente"><select className="select" value={env} onChange={(e) => setEnv(e.target.value as 'live' | 'test')}><option value="live">Produção (live)</option><option value="test">Teste (test)</option></select></Field>
          <Field label="Projeto"><select className="select" value={project} onChange={(e) => setProject(e.target.value)}>{projects.map((p) => <option key={p.id}>{p.name}</option>)}</select></Field>
        </div>
        <fieldset className="scope-box">
          <legend className="field-label">Escopos</legend>
          {ALL_SCOPES.map((s) => (
            <label key={s} className="scope-row">
              <input type="checkbox" checked={scopes.includes(s)} onChange={() => toggle(s)} />
              <span className="cell-stack"><code className="mono">{s}</code><span className="text-xs text-muted">{SCOPE_INFO[s].hint} {SCOPE_INFO[s].publicSafe ? 'Pode ir no HTML.' : 'Nunca no HTML.'}</span></span>
            </label>
          ))}
        </fieldset>
        {risky.length > 0 && <div className="form-error" role="alert">Escopos de leitura ({risky.join(', ')}) não podem ir no snippet: use só em servidores.</div>}
      </div>
    </SidePanel>
  );
}
