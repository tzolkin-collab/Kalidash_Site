import { useMemo, useState } from 'react';
import { Mail, Plus, Trash2 } from 'lucide-react';
import type { Role, TeamMember, Webhook } from '../domain';
import { initials } from '../lib/people';
import { newId, useStore } from '../lib/store';
import { EVENTS } from '../mocks/automations';
import { CURRENT_USER_ID, auditLog, teamStore, webhooksStore } from '../mocks/team';
import { Badge, EmptyState, Field, Page, PageHeader, SampleBanner, SearchBox, SidePanel, Switch, Tabs } from '../components/ui';

type Tab = 'profile' | 'team' | 'webhooks' | 'audit';

const ROLE_LABEL: Record<Role, string> = { ADMIN: 'Admin', MANAGER: 'Gerente', SELLER: 'Vendedor' };
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Nunca');

// Quem vê e faz o quê. Ver docs/system-core.md.
const ROLE_MATRIX: { role: Role; sees: string; does: string }[] = [
  { role: 'ADMIN', sees: 'Todo o funil, o dashboard e todas as configurações.', does: 'Gerencia equipe, integrações, chaves, webhooks e blog. Redistribui leads. Não pode remover o último Admin.' },
  { role: 'MANAGER', sees: 'Todo o funil e o dashboard.', does: 'Opera o CRM, o blog e os projetos conectados, redistribui leads. Não acessa equipe nem webhooks.' },
  { role: 'SELLER', sees: 'Só as oportunidades atribuídas a ele.', does: 'Opera as próprias oportunidades e pega leads sem dono. Não vê Configurações.' },
];

export default function Settings() {
  const [tab, setTab] = useState<Tab>('profile');
  return (
    <Page>
      <PageHeader title="Configurações" subtitle="Seu perfil, a equipe e os acessos, os webhooks de saída e o registro do que foi feito." />
      <SampleBanner>Equipe, webhooks e auditoria ainda não têm API, e o login com Google entra na fase de segurança, que fica por último. Nada aqui é gravado.</SampleBanner>
      <Tabs
        tabs={[{ id: 'profile' as Tab, label: 'Meu perfil' }, { id: 'team' as Tab, label: 'Equipe e acessos' }, { id: 'webhooks' as Tab, label: 'Webhooks' }, { id: 'audit' as Tab, label: 'Auditoria' }]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'profile' && <ProfileTab />}
      {tab === 'team' && <TeamTab />}
      {tab === 'webhooks' && <WebhooksTab />}
      {tab === 'audit' && <AuditTab />}
    </Page>
  );
}

function ProfileTab() {
  const [team] = useStore(teamStore);
  const me = team.find((m) => m.id === CURRENT_USER_ID);
  if (!me) return <EmptyState title="Perfil indisponível" />;
  return (
    <div className="settings-pane form-stack">
      <section className="panel-card profile-card">
        <span className="avatar profile-avatar">{initials(me.name)}</span>
        <div className="cell-stack">
          <span className="cell-primary" style={{ fontSize: '18px' }}>{me.name}</span>
          <span className="text-muted">{me.email}</span>
          <span style={{ marginTop: '6px' }}><Badge tone="danger">{ROLE_LABEL[me.role]}</Badge></span>
        </div>
      </section>
      <section className="panel-card">
        <h2 className="section-title">Sessão</h2>
        <p className="text-sm text-muted" style={{ margin: 0 }}>O login com Google Workspace ainda não está ligado: hoje o admin abre sem autenticação. Ele entra na fase de segurança, com o e-mail vindo da conta Google e o perfil definido em Equipe e acessos.</p>
      </section>
    </div>
  );
}

function TeamTab() {
  const [team, setTeam] = useStore(teamStore);
  const [inviting, setInviting] = useState(false);
  const admins = team.filter((m) => m.role === 'ADMIN').length;

  const setRole = (id: string, role: Role) => setTeam((prev) => prev.map((m) => (m.id === id ? { ...m, role } : m)));
  const remove = (id: string) => setTeam((prev) => prev.filter((m) => m.id !== id));
  // O último Admin não perde o perfil nem sai
  const isLastAdmin = (m: TeamMember) => m.role === 'ADMIN' && admins <= 1;

  return (
    <div className="settings-pane form-stack">
      <div className="pane-head" style={{ marginBottom: 0 }}>
        <p className="section-sub" style={{ margin: 0 }}>Um único espaço de dados, vários usuários internos, três perfis.</p>
        <button type="button" className="btn btn-solid" onClick={() => setInviting(true)}><Plus size={14} /> Convidar pessoa</button>
      </div>

      <div className="table-card">
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Pessoa</th><th>Perfil</th><th>Status</th><th>Último acesso</th><th style={{ width: '48px' }}></th></tr></thead>
            <tbody>
              {team.map((m) => (
                <tr key={m.id}>
                  <td><div className="cell-avatar"><span className="avatar">{initials(m.name)}</span><div className="cell-stack"><span className="cell-primary">{m.name}{m.id === CURRENT_USER_ID && <span className="text-muted"> (você)</span>}</span><span className="text-xs text-muted">{m.email}</span></div></div></td>
                  <td>
                    <select className="select select-sm" value={m.role} disabled={isLastAdmin(m)} title={isLastAdmin(m) ? 'Não dá para tirar o perfil do último Admin' : undefined} onChange={(e) => setRole(m.id, e.target.value as Role)} aria-label={`Perfil de ${m.name}`}>
                      {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </select>
                  </td>
                  <td><Badge tone={m.status === 'ACTIVE' ? 'success' : 'warning'}>{m.status === 'ACTIVE' ? 'Ativo' : 'Convite enviado'}</Badge></td>
                  <td className="text-muted">{when(m.lastAccess)}</td>
                  <td><button type="button" className="icon-btn bare" disabled={isLastAdmin(m) || m.id === CURRENT_USER_ID} onClick={() => remove(m.id)} title={isLastAdmin(m) ? 'O último Admin não pode ser removido' : m.id === CURRENT_USER_ID ? 'Você não pode se remover' : 'Remover'} aria-label={`Remover ${m.name}`}><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <section className="panel-card">
        <h2 className="section-title">O que cada perfil vê e faz</h2>
        <div className="role-grid">
          {ROLE_MATRIX.map((r) => (
            <div key={r.role} className="role-item">
              <Badge tone={r.role === 'ADMIN' ? 'danger' : r.role === 'MANAGER' ? 'info' : 'neutral'}>{ROLE_LABEL[r.role]}</Badge>
              <div><strong>Vê:</strong> {r.sees}</div>
              <div><strong>Faz:</strong> {r.does}</div>
            </div>
          ))}
        </div>
      </section>

      {inviting && <InvitePanel onClose={() => setInviting(false)} onInvite={(m) => { setTeam((prev) => [...prev, m]); setInviting(false); }} existing={team.map((m) => m.email.toLowerCase())} />}
    </div>
  );
}

function InvitePanel({ onClose, onInvite, existing }: { onClose: () => void; onInvite: (m: TeamMember) => void; existing: string[] }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('SELLER');
  const emailOk = /^\S+@\S+\.\S+$/.test(email);
  const duplicate = existing.includes(email.trim().toLowerCase());

  return (
    <SidePanel
      title="Convidar pessoa"
      subtitle="Ela entra com a conta Google do mesmo e-mail."
      onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="button" className="btn btn-solid" disabled={!name.trim() || !emailOk || duplicate} onClick={() => onInvite({ id: newId('u'), name: name.trim(), email: email.trim(), role, status: 'INVITED' })}><Mail size={14} /> Enviar convite</button></>}
    >
      <div className="form-stack">
        <Field label="Nome"><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
        <Field label="E-mail" hint={duplicate ? 'Esta pessoa já está na equipe.' : email && !emailOk ? 'Informe um e-mail válido.' : undefined}><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Perfil"><select className="select" value={role} onChange={(e) => setRole(e.target.value as Role)}>{(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></Field>
      </div>
    </SidePanel>
  );
}

function WebhooksTab() {
  const [hooks, setHooks] = useStore(webhooksStore);
  const [adding, setAdding] = useState(false);

  return (
    <div className="settings-pane form-stack">
      <div className="pane-head" style={{ marginBottom: 0 }}>
        <p className="section-sub" style={{ margin: 0 }}>Regras de saída: quando algo acontece no Kalidash, ele envia um POST em segundo plano. Se o destino estiver fora do ar, tenta de novo com espera crescente.</p>
        <button type="button" className="btn btn-solid" onClick={() => setAdding(true)}><Plus size={14} /> Novo webhook</button>
      </div>
      {hooks.length === 0 ? (
        <EmptyState title="Nenhum webhook">Crie a primeira regra, por exemplo "quando uma oportunidade for ganha, avisar o Zapier".</EmptyState>
      ) : (
        <ul className="row-list">
          {hooks.map((h) => (
            <li key={h.id} className="row-item">
              <div className="cell-stack">
                <span className="cell-primary">{h.name}</span>
                <span className="text-xs text-muted"><code className="mono">{h.event}</code> → <span className="mono">{h.url}</span></span>
              </div>
              {h.lastStatus && <Badge tone={h.lastStatus === 'OK' ? 'success' : 'danger'} title={when(h.lastAt)}>{h.lastStatus === 'OK' ? 'Último envio OK' : 'Último envio falhou'}</Badge>}
              <Switch checked={h.active} onChange={(v) => setHooks((prev) => prev.map((x) => (x.id === h.id ? { ...x, active: v } : x)))} label={`Webhook ${h.name} ativo`} />
              <button type="button" className="icon-btn bare" onClick={() => setHooks((prev) => prev.filter((x) => x.id !== h.id))} aria-label={`Excluir ${h.name}`}><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
      )}
      {adding && <WebhookPanel onClose={() => setAdding(false)} onSave={(h) => { setHooks((prev) => [...prev, h]); setAdding(false); }} />}
    </div>
  );
}

function WebhookPanel({ onClose, onSave }: { onClose: () => void; onSave: (h: Webhook) => void }) {
  const [name, setName] = useState('');
  const [event, setEvent] = useState(EVENTS[0].id);
  const [url, setUrl] = useState('https://');
  const urlOk = /^https:\/\/[^\s/]+\.[^\s/]+/.test(url);

  return (
    <SidePanel
      title="Novo webhook"
      subtitle="Só endereços https."
      onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="button" className="btn btn-solid" disabled={!name.trim() || !urlOk} onClick={() => onSave({ id: newId('w'), name: name.trim(), event, url: url.trim(), active: true })}>Criar</button></>}
    >
      <div className="form-stack">
        <Field label="Nome"><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
        <Field label="Quando isto acontecer">
          <select className="select" value={event} onChange={(e) => setEvent(e.target.value)}>{EVENTS.map((e) => <option key={e.id} value={e.id}>{e.label} ({e.id})</option>)}</select>
        </Field>
        <Field label="Enviar um POST para" hint={url && !urlOk ? 'Use um endereço https completo.' : undefined}><input className="input mono" value={url} onChange={(e) => setUrl(e.target.value)} /></Field>
      </div>
    </SidePanel>
  );
}

function AuditTab() {
  const [search, setSearch] = useState('');
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return auditLog.filter((a) => !q || `${a.actor} ${a.action} ${a.target}`.toLowerCase().includes(q));
  }, [search]);

  return (
    <div className="settings-pane">
      <p className="section-sub">Quem fez o quê e quando. O registro é só de leitura e cada linha guarda o IP de origem quando a API existir.</p>
      <div className="toolbar"><SearchBox value={search} onChange={setSearch} placeholder="Buscar por pessoa, ação ou alvo…" /></div>
      <div className="table-card">
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Alvo</th></tr></thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}><td className="text-muted">{when(a.at)}</td><td>{a.actor}</td><td>{a.action}</td><td className="text-muted">{a.target}</td></tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={4}><EmptyState title="Nada encontrado" /></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
