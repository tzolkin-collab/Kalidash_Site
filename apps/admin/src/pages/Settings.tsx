import { useEffect, useMemo, useState } from 'react';
import { LogOut, Mail, Plus, RotateCcw, Trash2 } from 'lucide-react';
import type { Role, TeamMember, Webhook } from '../domain';
import { initials } from '../lib/people';
import { newId, useStore } from '../lib/store';
import { pushErro, setPush, usePushPref } from '../lib/notify';
import { logout, useAuth } from '../lib/auth';
import { useCan } from '../lib/permissions';
import { changeMemberRole, inviteMember, setMemberActive } from '../lib/teamSync';
import { useCrmMode } from '../lib/crmMode';
import { historyStore } from '../lib/history';
import { auditRowOf } from '../lib/historyText';
import { loadRecentHistory } from '../lib/historySync';
import { EVENTS } from '../mocks/automations';
import { CURRENT_USER_ID, auditLog, teamStore, webhooksStore } from '../mocks/team';
import { Badge, EmptyState, Field, Page, PageHeader, SampleBanner, SearchBox, SidePanel, Switch, Tabs } from '../components/ui';
import { CustomSelect } from '../components/ui';

type Tab = 'profile' | 'team' | 'notifications' | 'webhooks' | 'audit';

const ROLE_LABEL: Record<Role, string> = { ADMIN: 'Admin', MANAGER: 'Gerente', SELLER: 'Vendedor' };
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Nunca');

// Quem vê e faz o quê. Ver docs/system-core.md.
const ROLE_MATRIX: { role: Role; sees: string; does: string }[] = [
  { role: 'ADMIN', sees: 'Todo o funil, o dashboard e todas as configurações.', does: 'Gerencia equipe, integrações, chaves, webhooks e blog. Redistribui leads. Não pode remover o último Admin.' },
  { role: 'MANAGER', sees: 'Todo o funil e o dashboard.', does: 'Opera o CRM, o blog e os projetos conectados, redistribui leads. Não acessa equipe nem webhooks.' },
  { role: 'SELLER', sees: 'Só as oportunidades atribuídas a ele.', does: 'Opera as próprias oportunidades e pega leads sem dono. Não vê Configurações.' },
];

export default function Settings() {
  const crmMode = useCrmMode();
  const auth = useAuth();
  const [tab, setTab] = useState<Tab>('profile');
  return (
    <Page>
      <PageHeader title="Configurações" subtitle="Seu perfil, a equipe e os acessos, os webhooks de saída e o registro do que foi feito." />
      <SampleBanner>
        {auth.status === 'in' ? 'A equipe e o perfil são reais (login ligado na API), mas os webhooks ainda não têm API.' : 'O login está desligado nesta API (AUTH_API): a equipe e o perfil são de exemplo e o admin abre sem autenticação. Os webhooks ainda não têm API.'}{' '}
        {crmMode === 'api' ? 'A Auditoria já mostra o histórico real de mudanças.' : 'A Auditoria só vira real quando o CRM está na API.'} O que é de exemplo não é gravado.
      </SampleBanner>
      <Tabs
        tabs={[{ id: 'profile' as Tab, label: 'Meu perfil' }, { id: 'team' as Tab, label: 'Equipe e acessos' }, { id: 'notifications' as Tab, label: 'Notificações' }, { id: 'webhooks' as Tab, label: 'Webhooks' }, { id: 'audit' as Tab, label: 'Auditoria' }]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'profile' && <ProfileTab />}
      {tab === 'team' && <TeamTab />}
      {tab === 'notifications' && <NotificationsTab />}
      {tab === 'webhooks' && <WebhooksTab />}
      {tab === 'audit' && <AuditTab />}
    </Page>
  );
}

function ProfileTab() {
  const [team] = useStore(teamStore);
  const auth = useAuth();
  const me = auth.status === 'in' ? auth.user : team.find((m) => m.id === CURRENT_USER_ID);
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
        {auth.status === 'in' ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            <p className="text-sm text-muted" style={{ margin: 0 }}>Você entrou com a conta Google {me.email}. A sessão dura 7 dias a partir do último uso e termina ao sair; se um Admin mudar o seu perfil ou desativar o seu acesso, vale na hora.</p>
            <button type="button" className="btn" onClick={() => void logout()}><LogOut size={14} /> Sair</button>
          </div>
        ) : (
          <p className="text-sm text-muted" style={{ margin: 0 }}>O login com Google está desligado nesta API (AUTH_API): o admin abre sem autenticação e o perfil acima é o de exemplo.</p>
        )}
      </section>
    </div>
  );
}

function TeamTab() {
  const [team, setTeam] = useStore(teamStore);
  const auth = useAuth();
  const can = useCan();
  const [inviting, setInviting] = useState(false);
  const api = auth.status === 'in'; // equipe na API; senão, o exemplo em memória
  const meId = api ? auth.user?.id : CURRENT_USER_ID;
  const admins = team.filter((m) => m.role === 'ADMIN' && m.status !== 'DISABLED').length;
  const readOnly = api && !can.manageTeam; // só Admin altera a equipe; o servidor também recusa

  const report = (err: string | null) => { if (err) pushErro('Não foi possível alterar a equipe', err); };
  const setRole = (id: string, role: Role) => (api ? changeMemberRole(id, role).then(report) : setTeam((prev) => prev.map((m) => (m.id === id ? { ...m, role } : m))));
  const remove = (id: string) => (api ? setMemberActive(id, false).then(report) : setTeam((prev) => prev.filter((m) => m.id !== id)));
  const reactivate = (id: string) => setMemberActive(id, true).then(report);
  // O último Admin não perde o perfil nem sai
  const isLastAdmin = (m: TeamMember) => !!m.root || (m.role === 'ADMIN' && m.status !== 'DISABLED' && admins <= 1);

  return (
    <div className="settings-pane form-stack">
      <div className="pane-head" style={{ marginBottom: 0 }}>
        <p className="section-sub" style={{ margin: 0 }}>Um único espaço de dados, vários usuários internos, três perfis.</p>
        {!readOnly && <button type="button" className="btn btn-solid" onClick={() => setInviting(true)}><Plus size={14} /> Convidar pessoa</button>}
      </div>

      <div className="table-card">
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Pessoa</th><th>Perfil</th><th>Status</th><th>Último acesso</th><th style={{ width: '48px' }}></th></tr></thead>
            <tbody>
              {team.map((m) => (
                <tr key={m.id}>
                  <td><div className="cell-avatar"><span className="avatar">{initials(m.name)}</span><div className="cell-stack"><span className="cell-primary">{m.name}{m.id === meId && <span className="text-muted"> (você)</span>}{m.root && <span className="text-muted"> · raiz</span>}</span><span className="text-xs text-muted">{m.email}</span></div></div></td>
                  <td>
                    <CustomSelect className="select select-sm" value={m.role} disabled={readOnly || isLastAdmin(m) || m.status === 'DISABLED' || (api && m.id === meId)} title={m.root ? 'Conta Admin raiz, definida no servidor' : isLastAdmin(m) ? 'Não dá para tirar o perfil do último Admin' : api && m.id === meId ? 'Você não pode mudar o seu próprio perfil' : undefined} onChange={(e) => setRole(m.id, e.target.value as Role)} aria-label={`Perfil de ${m.name}`}>
                      {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </CustomSelect>
                  </td>
                  <td><Badge tone={m.status === 'ACTIVE' ? 'success' : m.status === 'DISABLED' ? 'neutral' : 'warning'}>{m.status === 'ACTIVE' ? 'Ativo' : m.status === 'DISABLED' ? 'Desativado' : 'Convite enviado'}</Badge></td>
                  <td className="text-muted">{when(m.lastAccess)}</td>
                  <td>
                    {readOnly ? null : m.status === 'DISABLED' ? (
                      <button type="button" className="icon-btn bare" onClick={() => reactivate(m.id)} title="Reativar" aria-label={`Reativar ${m.name}`}><RotateCcw size={14} /></button>
                    ) : (
                      <button type="button" className="icon-btn bare" disabled={isLastAdmin(m) || m.id === meId} onClick={() => remove(m.id)} title={m.root ? 'Conta Admin raiz, definida no servidor' : isLastAdmin(m) ? 'O último Admin não pode ser removido' : m.id === meId ? 'Você não pode se remover' : api ? 'Desativar acesso' : 'Remover'} aria-label={`${api ? 'Desativar' : 'Remover'} ${m.name}`}><Trash2 size={14} /></button>
                    )}
                  </td>
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

      {inviting && <InvitePanel onClose={() => setInviting(false)} onInvite={async (m) => {
        if (api) {
          const err = await inviteMember(m.name, m.email, m.role);
          report(err);
          if (err) return;
        } else setTeam((prev) => [...prev, m]);
        setInviting(false);
      }} existing={team.map((m) => m.email.toLowerCase())} />}
    </div>
  );
}

function InvitePanel({ onClose, onInvite, existing }: { onClose: () => void; onInvite: (m: TeamMember) => void | Promise<void>; existing: string[] }) {
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
        <Field label="Perfil"><CustomSelect className="select" value={role} onChange={(e) => setRole(e.target.value as Role)}>{(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</CustomSelect></Field>
      </div>
    </SidePanel>
  );
}

function NotificationsTab() {
  const [push] = usePushPref();
  const [note, setNote] = useState('');
  const supported = typeof Notification !== 'undefined';
  const toggle = async (on: boolean) => {
    const ok = await setPush(on);
    setNote(on && !ok ? (supported ? 'O navegador bloqueou as notificações. Libere nas permissões do site e tente de novo.' : 'Este navegador não suporta notificações.') : '');
  };
  return (
    <div className="settings-pane form-stack">
      <section className="panel-card">
        <h2 className="section-title">Aviso do navegador</h2>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <p className="text-sm text-muted" style={{ margin: 0 }}>
            Mostra erros, avisos e notificações como aviso do navegador quando o painel está em segundo plano. Vale só para este navegador: o envio pelo servidor (Web Push, com o painel fechado) entra com o PWA.
          </p>
          <Switch checked={push} onChange={toggle} label="Aviso do navegador" />
        </div>
        {note && <p className="text-sm" role="alert" style={{ margin: '12px 0 0', color: 'var(--danger, #ef4444)' }}>{note}</p>}
      </section>
      <section className="panel-card">
        <h2 className="section-title">O que não se desliga</h2>
        <p className="text-sm text-muted" style={{ margin: 0 }}>
          A caixa do sino (barra lateral) recebe sempre as três categorias: <strong>erros</strong> (falha de acesso ou de conexão), <strong>avisos</strong> (uma regra do sistema barrou a ação, como mover uma oportunidade com tarefa pendente) e <strong>notificações</strong> (acompanhamento do negócio). Só o aviso do navegador é opcional.
        </p>
      </section>
    </div>
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
          <CustomSelect className="select" value={event} onChange={(e) => setEvent(e.target.value)}>{EVENTS.map((e) => <option key={e.id} value={e.id}>{e.label} ({e.id})</option>)}</CustomSelect>
        </Field>
        <Field label="Enviar um POST para" hint={url && !urlOk ? 'Use um endereço https completo.' : undefined}><input className="input mono" value={url} onChange={(e) => setUrl(e.target.value)} /></Field>
      </div>
    </SidePanel>
  );
}

function AuditTab() {
  const [search, setSearch] = useState('');
  const crmMode = useCrmMode();
  const [history] = useStore(historyStore);
  // Com o CRM na API a Auditoria é o histórico real de mudanças; sem ela, o exemplo.
  const source = useMemo(() => (crmMode === 'api' ? history.map(auditRowOf) : auditLog), [crmMode, history]);
  useEffect(() => { if (crmMode === 'api') void loadRecentHistory(); }, [crmMode]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return source.filter((a) => !q || `${a.actor} ${a.action} ${a.target}`.toLowerCase().includes(q));
  }, [search, source]);

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
