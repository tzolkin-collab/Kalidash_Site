import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Copy, KeyRound, Lock, Plus, RotateCcw, ShieldCheck, TriangleAlert } from 'lucide-react';
import type { Role, TeamMember } from '../domain';
import { API_URL } from '../lib/api';
import { createToken, loadCatalog, loadTokens, revokeToken, saveMemberAccess, useCatalog, useTokens } from '../lib/accessSync';
import type { ApiToken } from '../lib/accessSync';
import { useAuth } from '../lib/auth';
import { pushErro } from '../lib/notify';
import { initials } from '../lib/people';
import { useCan } from '../lib/permissions';
import { ago, effective, expiryFor, groupScopes, maskedToken, overridesFor, summarize } from '../lib/scopes';
import type { Catalog, ScopeDef, Validity } from '../lib/scopes';
import { teamStore } from '../mocks/team';
import { useStore } from '../lib/store';
import { Badge, CustomSelect, EmptyState, Field, PopupDialog, SidePanel, Switch } from './ui';
import '../access.css';

// Permissões por escopo e tokens de API (Configurações). O servidor decide (apps/api/auth_scopes.go,
// auth_tokens.go); aqui só se mostra, se edita e se envia. Os perfis são presets de escopos.

const ROLE_LABEL: Record<Role, string> = { ADMIN: 'Admin', MANAGER: 'Gerente', SELLER: 'Vendedor' };
const ROLE_TONE: Record<Role, 'danger' | 'info' | 'neutral'> = { ADMIN: 'danger', MANAGER: 'info', SELLER: 'neutral' };
const ROLE_BLURB: Record<Role, string> = {
  ADMIN: 'Acesso total, inclusive equipe, permissões e tokens.',
  MANAGER: 'Opera CRM, funis, blog e automações. Não gerencia a equipe.',
  SELLER: 'Trabalha leads, pessoas e tarefas do dia a dia.',
};
const ROLES: Role[] = ['ADMIN', 'MANAGER', 'SELLER'];
const when = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

function Offline({ what }: { what: string }) {
  return (
    <EmptyState title="Disponível com o login ligado">
      {what} depende do login com Google na API (AUTH_API=1). Hoje o admin abre sem autenticação e a equipe é de exemplo, então não há o que configurar aqui.
    </EmptyState>
  );
}

function LoadError({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div className="acc-error" role="alert">
      <TriangleAlert size={18} />
      <div>
        <strong>Não foi possível carregar.</strong>
        <span>{message ?? 'A API não respondeu.'}</span>
      </div>
      <button type="button" className="btn" onClick={onRetry}><RotateCcw size={14} /> Tentar de novo</button>
    </div>
  );
}

function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="acc-skeleton" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: rows }, (_, i) => <span key={i} style={{ width: `${92 - i * 11}%` }} />)}
    </div>
  );
}

/** Linha de um escopo: interruptor (ou caixa) + nome, descrição e o código que a API usa. */
function ScopeRow({ def, on, onChange, disabled, tag, note }: { def: ScopeDef; on: boolean; onChange: (v: boolean) => void; disabled?: boolean; tag?: 'extra' | 'removed'; note?: string }) {
  return (
    <div className={`acc-scope ${disabled ? 'is-disabled' : ''}`}>
      <Switch checked={on} onChange={(v) => !disabled && onChange(v)} label={def.label} />
      <div className="acc-scope-main">
        <div className="acc-scope-title">
          <span>{def.label}</span>
          {tag === 'extra' && <span className="acc-tag acc-tag-extra">Extra</span>}
          {tag === 'removed' && <span className="acc-tag acc-tag-removed">Removida</span>}
          {def.reserved && <span className="acc-tag">Em breve</span>}
          {note && <span className="acc-tag acc-tag-lock"><Lock size={10} /> {note}</span>}
        </div>
        <div className="acc-scope-desc">{def.description}</div>
      </div>
      <code className="acc-code">{def.id}</code>
    </div>
  );
}

/** Escopos por área, com "marcar tudo". `lockedNote(def)` devolve o motivo de um escopo não poder ser mexido. */
function ScopeGroups({ catalog, selected, onToggle, onGroup, forTokens, lockedNote, tagOf }: {
  catalog: Catalog;
  selected: Set<string>;
  onToggle: (id: string, on: boolean) => void;
  onGroup: (ids: string[], on: boolean) => void;
  forTokens?: boolean;
  lockedNote?: (def: ScopeDef) => string | undefined;
  tagOf?: (id: string) => 'extra' | 'removed' | undefined;
}) {
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  return (
    <div className="acc-groups">
      {groupScopes(catalog, { forTokens }).map(({ group, scopes }) => {
        const free = scopes.filter((s) => !lockedNote?.(s));
        const n = scopes.filter((s) => selected.has(s.id)).length;
        const allOn = free.length > 0 && free.every((s) => selected.has(s.id));
        const isClosed = closed[group];
        return (
          <section key={group} className="acc-group">
            <header className="acc-group-head">
              <button type="button" className="acc-group-toggle" aria-expanded={!isClosed} onClick={() => setClosed((c) => ({ ...c, [group]: !c[group] }))}>
                <ChevronDown size={15} className={isClosed ? 'is-closed' : ''} />
                <span className="acc-group-name">{group}</span>
                <span className="acc-count">{n} de {scopes.length}</span>
              </button>
              {free.length > 0 && (
                <button type="button" className="acc-link" onClick={() => onGroup(free.map((s) => s.id), !allOn)}>{allOn ? 'Limpar' : 'Marcar todas'}</button>
              )}
            </header>
            {!isClosed && (
              <div className="acc-group-body">
                {scopes.map((s) => {
                  const note = lockedNote?.(s);
                  return <ScopeRow key={s.id} def={s} on={selected.has(s.id)} disabled={!!note} note={note} tag={tagOf?.(s.id)} onChange={(v) => onToggle(s.id, v)} />;
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

// ======================= Permissões =======================

export function PermissionsTab() {
  const auth = useAuth();
  const catalog = useCatalog();
  const [team] = useStore(teamStore);
  const [sel, setSel] = useState<string | undefined>();
  const [savedId, setSavedId] = useState<string | undefined>();
  const live = auth.status === 'in';

  useEffect(() => { if (live) void loadCatalog(); }, [live]);
  if (!live) return <Offline what="Ajustar permissões por pessoa" />;
  if (catalog.status === 'error') return <LoadError message={catalog.error} onRetry={() => void loadCatalog(true)} />;
  if (!catalog.data) return <Skeleton rows={5} />;

  const people = team;
  const current = people.find((m) => m.id === sel) ?? people.find((m) => m.id === auth.user?.id) ?? people[0];
  return (
    <div className="acc-split">
      <aside className="acc-people" aria-label="Pessoas da equipe">
        {people.map((m) => {
          const custom = (m.scopesExtra?.length ?? 0) + (m.scopesDenied?.length ?? 0) > 0;
          return (
            <button key={m.id} type="button" className={`acc-person ${current?.id === m.id ? 'active' : ''}`} onClick={() => { setSel(m.id); setSavedId(undefined); }} aria-current={current?.id === m.id}>
              <span className="avatar">{initials(m.name)}</span>
              <span className="acc-person-main">
                <span className="acc-person-name">{m.name}{m.id === auth.user?.id && <span className="text-muted"> (você)</span>}</span>
                <span className="acc-person-meta">
                  {ROLE_LABEL[m.role]}{custom ? ' · personalizado' : ''}{m.status === 'DISABLED' ? ' · desativado' : ''}
                </span>
              </span>
              {custom && <span className="acc-dot" title="Tem permissões diferentes do perfil" />}
            </button>
          );
        })}
      </aside>
      {current && <PersonAccess key={`${current.id}|${current.role}|${current.scopesExtra?.join(',')}|${current.scopesDenied?.join(',')}`} member={current} catalog={catalog.data} saved={savedId === current.id} onSaved={() => setSavedId(current.id)} />}
    </div>
  );
}

function PersonAccess({ member, catalog, saved, onSaved }: { member: TeamMember; catalog: Catalog; saved: boolean; onSaved: () => void }) {
  const auth = useAuth();
  const can = useCan();
  const [role, setRole] = useState<Role>(member.role);
  const [extra, setExtra] = useState<string[]>(member.scopesExtra ?? []);
  const [denied, setDenied] = useState<string[]>(member.scopesDenied ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSelf = member.id === auth.user?.id;
  const readOnly = !can.manageTeam || isSelf || !!member.root || member.status === 'DISABLED';
  const reason = member.root
    ? 'Conta Admin raiz, definida no servidor (AUTH_ROOT_ADMIN): sempre tem todas as permissões.'
    : isSelf
      ? 'Você não pode mudar o seu próprio acesso. Peça a outro Admin.'
      : member.status === 'DISABLED'
        ? 'Esta pessoa está desativada. Reative-a na aba Equipe e acessos para editar.'
        : !can.manageTeam
          ? 'Só quem tem a permissão de gerenciar a equipe (team:manage) altera acessos.'
          : null;

  const preset = (r: Role) => new Set(catalog.presets[r] ?? []);
  const selected = useMemo(() => new Set(member.root ? catalog.scopes.map((s) => s.id) : effective([...preset(role)], extra, denied)), [role, extra, denied, member.root, catalog]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = catalog.scopes.length;

  const original = `${member.role}|${(member.scopesExtra ?? []).join(',')}|${(member.scopesDenied ?? []).join(',')}`;
  const draft = `${role}|${extra.join(',')}|${denied.join(',')}`;
  const dirty = original !== draft;
  const changes = dirty ? (role !== member.role ? 1 : 0) + extra.filter((s) => !(member.scopesExtra ?? []).includes(s)).length + (member.scopesExtra ?? []).filter((s) => !extra.includes(s)).length + denied.filter((s) => !(member.scopesDenied ?? []).includes(s)).length + (member.scopesDenied ?? []).filter((s) => !denied.includes(s)).length : 0;

  const apply = (next: Set<string>) => {
    const o = overridesFor([...preset(role)], next);
    setExtra(o.extra);
    setDenied(o.denied);
    setError(null);
  };
  const toggle = (id: string, on: boolean) => { const n = new Set(selected); if (on) n.add(id); else n.delete(id); apply(n); };
  const group = (ids: string[], on: boolean) => { const n = new Set(selected); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); apply(n); };
  const choosePreset = (r: Role) => { setRole(r); setExtra([]); setDenied([]); setError(null); };
  const discard = () => { setRole(member.role); setExtra(member.scopesExtra ?? []); setDenied(member.scopesDenied ?? []); setError(null); };

  const submit = async () => {
    setSaving(true);
    setError(null);
    const err = await saveMemberAccess(member.id, role, extra, denied);
    setSaving(false);
    if (err) { setError(err); pushErro('Não foi possível salvar as permissões', err); return; }
    onSaved();
  };

  const tagOf = (id: string) => (extra.includes(id) ? 'extra' as const : denied.includes(id) ? 'removed' as const : undefined);
  const summary = summarize(catalog, selected);
  const first = member.name.split(' ')[0];
  const custom = extra.length + denied.length > 0;

  return (
    <div className="acc-detail">
      <header className="acc-detail-head">
        <span className="avatar acc-avatar">{initials(member.name)}</span>
        <div className="acc-detail-id">
          <h2>{member.name}</h2>
          <span className="text-muted">{member.email}</span>
        </div>
        <div className="acc-detail-badges">
          <Badge tone={ROLE_TONE[role]}>{ROLE_LABEL[role]}</Badge>
          {custom && <span className="acc-pill">Personalizado</span>}
          <span className="acc-pill acc-pill-count"><ShieldCheck size={12} /> {selected.size} de {total} permissões</span>
        </div>
      </header>

      {reason && <div className="acc-note"><Lock size={14} /><span>{reason}</span></div>}

      <section className="acc-section">
        <div className="acc-section-head">
          <h3>Perfil base</h3>
          <p>Um clique define o conjunto padrão. Escolher outro perfil descarta os ajustes individuais.</p>
        </div>
        <div className="acc-presets" role="radiogroup" aria-label="Perfil base">
          {ROLES.map((r) => (
            <button key={r} type="button" role="radio" aria-checked={role === r} disabled={readOnly} className={`acc-preset ${role === r ? 'on' : ''}`} onClick={() => choosePreset(r)}>
              <span className="acc-preset-top">
                <strong>{ROLE_LABEL[r]}</strong>
                <span className="acc-preset-check">{role === r && <Check size={13} />}</span>
              </span>
              <span className="acc-preset-blurb">{ROLE_BLURB[r]}</span>
              <span className="acc-preset-count">{(catalog.presets[r] ?? []).length} permissões</span>
            </button>
          ))}
        </div>
      </section>

      <section className="acc-section">
        <div className="acc-section-head">
          <h3>O que {first} pode fazer</h3>
        </div>
        <ul className="acc-summary">
          {summary.map((s) => (
            <li key={s.group}>
              <span className="acc-summary-group">{s.group}</span>
              <span className={s.can ? 'acc-summary-text' : 'acc-summary-none'}>{s.can ?? 'Sem acesso'}</span>
              <span className="acc-meter" aria-label={`${s.count} de ${s.total}`}><span style={{ width: `${(s.count / s.total) * 100}%` }} /></span>
            </li>
          ))}
        </ul>
      </section>

      <section className="acc-section">
        <div className="acc-section-head">
          <h3>Ajustar permissões</h3>
          <p>Cada interruptor é um escopo da API. O que foge do perfil base fica marcado como Extra ou Removida.</p>
        </div>
        <ScopeGroups
          catalog={catalog}
          selected={selected}
          onToggle={toggle}
          onGroup={group}
          tagOf={tagOf}
          lockedNote={() => (readOnly ? (member.root ? 'Sempre ativa' : 'Somente leitura') : undefined)}
        />
      </section>

      {dirty && !readOnly && (
        <div className="acc-savebar" role="region" aria-label="Alterações não salvas">
          <span className="acc-savebar-text">{error ? <span className="acc-savebar-error">{error}</span> : <><strong>{changes} {changes === 1 ? 'alteração' : 'alterações'}</strong> não {changes === 1 ? 'salva' : 'salvas'} em {member.name}</>}</span>
          <button type="button" className="btn" onClick={discard} disabled={saving}>Descartar</button>
          <button type="button" className="btn btn-solid" onClick={() => void submit()} disabled={saving}>{saving ? 'Salvando…' : 'Salvar permissões'}</button>
        </div>
      )}
      {saved && !dirty && <div className="acc-saved" role="status"><Check size={14} /> Permissões salvas. Valem na próxima chamada de {first}.</div>}
    </div>
  );
}

// ======================= Tokens =======================

function curl(token: string) {
  return `curl -H "Authorization: Bearer ${token}" \\\n  ${API_URL}/api/crm/leads`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand('copy');
      el.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function TokensTab() {
  const auth = useAuth();
  const can = useCan();
  const catalog = useCatalog();
  const tokens = useTokens();
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<{ token: string; meta: ApiToken } | null>(null);
  const [revoking, setRevoking] = useState<ApiToken | null>(null);
  const [showOld, setShowOld] = useState(false);
  const live = auth.status === 'in';

  useEffect(() => { if (live && can.manageKeys) { void loadCatalog(); void loadTokens(); } }, [live, can.manageKeys]);

  if (!live) return <Offline what="Criar tokens de API" />;
  if (!can.manageKeys) return <EmptyState title="Sem permissão para tokens">Só quem tem a permissão keys:manage (Admin e Gerente por padrão) cria e revoga tokens de API.</EmptyState>;
  if (tokens.status === 'error' && !tokens.data) return <LoadError message={tokens.error} onRetry={() => void loadTokens()} />;
  if (!tokens.data || !catalog.data) return <Skeleton rows={4} />;

  const active = tokens.data.filter((t) => t.status === 'ACTIVE');
  const old = tokens.data.filter((t) => t.status !== 'ACTIVE');
  const order = (id: string) => catalog.data!.scopes.findIndex((s) => s.id === id);
  const nameOf = (id: string) => catalog.data!.scopes.find((s) => s.id === id)?.label ?? id;

  const confirmRevoke = async () => {
    if (!revoking) return;
    const err = await revokeToken(revoking.id);
    if (err) pushErro('Não foi possível revogar o token', err);
    setRevoking(null);
  };

  const row = (t: ApiToken) => {
    const scopes = [...t.scopes].sort((a, b) => order(a) - order(b));
    return (
    <tr key={t.id} className={t.status === 'ACTIVE' ? '' : 'acc-row-off'}>
      <td>
        <div className="cell-stack">
          <span className="cell-primary">{t.name}{t.status === 'EXPIRED' && <span className="acc-tag acc-tag-removed" style={{ marginLeft: 8 }}>Expirado</span>}{t.status === 'REVOKED' && <span className="acc-tag" style={{ marginLeft: 8 }}>Revogado</span>}</span>
          <code className="acc-token-mask">{maskedToken(t.prefix, t.last4)}</code>
        </div>
      </td>
      <td>
        <div className="acc-chips" title={t.scopes.map(nameOf).join(', ')}>
          {scopes.slice(0, 3).map((s) => <code key={s} className="acc-chip">{s}</code>)}
          {scopes.length > 3 && <span className="acc-chip acc-chip-more">+{scopes.length - 3}</span>}
        </div>
      </td>
      <td className="text-muted acc-nowrap">{t.lastUsedAt ? ago(t.lastUsedAt) : 'Nunca usado'}</td>
      <td className="text-muted acc-nowrap">{t.status === 'REVOKED' ? `Revogado em ${when(t.revokedAt)}` : t.expiresAt ? `${t.status === 'EXPIRED' ? 'Expirou' : 'Expira'} em ${when(t.expiresAt)}` : 'Nunca expira'}</td>
      <td className="text-muted">{when(t.createdAt)}{t.createdByName ? ` · ${t.createdByName}` : ''}</td>
      <td>{t.status === 'ACTIVE' && <button type="button" className="btn btn-sm btn-danger" onClick={() => setRevoking(t)}>Revogar</button>}</td>
    </tr>
    );
  };

  return (
    <div className="settings-pane form-stack">
      <div className="pane-head" style={{ marginBottom: 0 }}>
        <p className="section-sub" style={{ margin: 0 }}>Tokens dão a sistemas e automações acesso à API com só os escopos escolhidos. Valem para sempre, a menos que você defina uma validade, e podem ser revogados na hora.</p>
        <button type="button" className="btn btn-solid" onClick={() => setCreating(true)}><Plus size={14} /> Criar token</button>
      </div>

      {tokens.status === 'error' && <LoadError message={tokens.error} onRetry={() => void loadTokens()} />}

      {tokens.data.length === 0 ? (
        <div className="panel-card acc-empty">
          <span className="acc-empty-icon"><KeyRound size={22} /></span>
          <h3>Nenhum token ainda</h3>
          <p>Crie um token para o Zapier, o n8n ou um script ler e gravar leads. Você escolhe exatamente o que ele pode fazer e o segredo aparece uma única vez.</p>
          <pre className="acc-code-block">{curl('kld_live_…')}</pre>
          <button type="button" className="btn btn-solid" onClick={() => setCreating(true)}><Plus size={14} /> Criar o primeiro token</button>
        </div>
      ) : (
        <>
          <div className="table-card">
            <div className="table-scroll">
              <table className="data-table acc-table">
                <thead><tr><th>Token</th><th>Escopos</th><th>Último uso</th><th>Validade</th><th>Criado</th><th style={{ width: '90px' }}></th></tr></thead>
                <tbody>
                  {active.length === 0 ? <tr><td colSpan={6} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>Nenhum token ativo.</td></tr> : active.map(row)}
                </tbody>
              </table>
            </div>
          </div>
          {old.length > 0 && (
            <div>
              <button type="button" className="acc-link" onClick={() => setShowOld((v) => !v)}>{showOld ? 'Esconder' : 'Mostrar'} revogados e expirados ({old.length})</button>
              {showOld && (
                <div className="table-card" style={{ marginTop: 8 }}>
                  <div className="table-scroll"><table className="data-table acc-table"><tbody>{old.map(row)}</tbody></table></div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {tokens.data.length > 0 && <section className="panel-card acc-howto">
        <h2 className="section-title">Como usar</h2>
        <p className="text-sm text-muted" style={{ margin: '0 0 10px' }}>Envie o token no cabeçalho <code>Authorization</code>. Sem o escopo certo a API responde 403; token inválido, expirado ou revogado, 401.</p>
        <pre className="acc-code-block">{curl('kld_live_…')}</pre>
      </section>}

      {creating && catalog.data && (
        <CreateTokenPanel
          catalog={catalog.data}
          onClose={() => setCreating(false)}
          onCreated={(out) => { setCreating(false); setRevealed(out); }}
        />
      )}

      {revealed && (
        <PopupDialog
          eyebrow="TOKEN CRIADO"
          tone="success"
          title={`Copie o token “${revealed.meta.name}” agora`}
          description="Por segurança ele não será mostrado de novo. Guarde num cofre de senhas ou no ambiente do sistema que vai usá-lo."
          onClose={() => setRevealed(null)}
          footer={<button type="button" className="btn btn-solid" onClick={() => setRevealed(null)}>Já copiei, fechar</button>}
        >
          <RevealBox token={revealed.token} />
        </PopupDialog>
      )}

      {revoking && (
        <PopupDialog
          eyebrow="REVOGAR TOKEN"
          tone="danger"
          title={`Revogar “${revoking.name}”?`}
          description="Quem usa este token perde o acesso na hora. Não dá para desfazer; crie outro se precisar."
          onClose={() => setRevoking(null)}
          footer={<><button type="button" className="btn" onClick={() => setRevoking(null)}>Cancelar</button><button type="button" className="btn btn-solid acc-btn-danger" onClick={() => void confirmRevoke()}>Revogar agora</button></>}
        />
      )}
    </div>
  );
}

function RevealBox({ token }: { token: string }) {
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);
  return (
    <div className="acc-reveal">
      <div className="acc-reveal-box">
        <code data-testid="token-secret">{token}</code>
        <button type="button" className="btn" onClick={async () => { setCopied((await copyText(token)) ? 'ok' : 'fail'); }}>
          {copied === 'ok' ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar</>}
        </button>
      </div>
      {copied === 'fail' && <p className="acc-reveal-fail">O navegador não deixou copiar sozinho. Selecione o texto acima e copie.</p>}
      <pre className="acc-code-block">{curl(token)}</pre>
    </div>
  );
}

const VALIDITY: { value: Validity; label: string }[] = [
  { value: 'never', label: 'Nunca expira (padrão)' },
  { value: '30', label: '30 dias' },
  { value: '90', label: '90 dias' },
  { value: '365', label: '1 ano' },
  { value: 'date', label: 'Até uma data…' },
];

function CreateTokenPanel({ catalog, onClose, onCreated }: { catalog: Catalog; onClose: () => void; onCreated: (out: { token: string; meta: ApiToken }) => void }) {
  const can = useCan();
  const [name, setName] = useState('');
  const [validity, setValidity] = useState<Validity>('never');
  const [date, setDate] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mine = (s: ScopeDef) => can.has(s.id);
  const grantable = catalog.scopes.filter((s) => !s.humanOnly && mine(s));
  const preset = (pred: (s: ScopeDef) => boolean) => setPicked(new Set(grantable.filter(pred).map((s) => s.id)));
  const expiresAt = expiryFor(validity, date);
  const dateBad = validity === 'date' && !expiresAt;
  const ready = name.trim().length > 0 && picked.size > 0 && !dateBad && !busy;

  const submit = async () => {
    setBusy(true);
    setError(null);
    const out = await createToken(name.trim(), [...picked], expiresAt);
    setBusy(false);
    if ('error' in out) { setError(out.error); return; }
    onCreated(out);
  };

  const set = (id: string, on: boolean) => setPicked((p) => { const n = new Set(p); if (on) n.add(id); else n.delete(id); return n; });
  const setMany = (ids: string[], on: boolean) => setPicked((p) => { const n = new Set(p); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); return n; });

  return (
    <SidePanel
      title="Criar token de API"
      subtitle="Escolha o que este token pode fazer. Ele nunca terá mais do que você tem."
      onClose={onClose}
      footer={
        <>
          <span className="acc-foot-summary">{picked.size} {picked.size === 1 ? 'permissão' : 'permissões'} · {validity === 'never' ? 'nunca expira' : expiresAt ? `expira em ${when(expiresAt)}` : 'escolha a data'}</span>
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn btn-solid" disabled={!ready} onClick={() => void submit()}>{busy ? 'Criando…' : 'Criar token'}</button>
        </>
      }
    >
      <div className="form-stack">
        <Field label="Nome" hint="Para você reconhecer depois. Ex.: Zapier — leads do site.">
          <input className="input" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Zapier — leads do site" />
        </Field>
        <Field label="Validade" hint={validity === 'never' ? 'Sem prazo: vale até você revogar.' : undefined}>
          <CustomSelect className="select" value={validity} onChange={(e) => setValidity(e.target.value as Validity)} aria-label="Validade">
            {VALIDITY.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
          </CustomSelect>
        </Field>
        {validity === 'date' && (
          <Field label="Expira em" hint={dateBad ? 'Informe uma data.' : undefined}>
            <input className="input" type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} />
          </Field>
        )}

        <div className="acc-quick">
          <span className="field-label">Atalhos</span>
          <div className="acc-quick-btns">
            <button type="button" className="btn btn-sm" onClick={() => preset((s) => s.id.endsWith(':read'))}>Somente leitura</button>
            <button type="button" className="btn btn-sm" onClick={() => preset((s) => s.group === 'CRM' && !s.id.endsWith(':document') && !s.id.endsWith(':origin'))}>Leitura e escrita do CRM</button>
            <button type="button" className="btn btn-sm" onClick={() => preset(() => true)}>Tudo que posso</button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setPicked(new Set())}>Limpar</button>
          </div>
        </div>

        <ScopeGroups
          catalog={catalog}
          selected={picked}
          forTokens
          onToggle={set}
          onGroup={setMany}
          lockedNote={(s) => (mine(s) ? undefined : 'Você não tem')}
        />
        {error && <div className="acc-error" role="alert"><TriangleAlert size={16} /><div><strong>Não foi possível criar.</strong><span>{error}</span></div></div>}
      </div>
    </SidePanel>
  );
}

