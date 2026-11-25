import { useEffect, useState } from 'react';
import { Bot, Check, Copy, KeyRound, RotateCcw, Sparkles } from 'lucide-react';
import { API_URL } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useCan } from '../lib/permissions';
import { pushErro } from '../lib/notify';
import { Badge, EmptyState, PopupDialog } from './ui';
import { copyText, LoadError, Offline, Skeleton } from './Access';
import { ProviderLogo } from './ProviderLogo';

// Aba "MCP e agentes" (Configurações). Qualquer agente que fale MCP (claude.ai, ChatGPT, Cursor, Claude Code…) se
// conecta pelo endereço do servidor e entra por OAuth: abre a tela de consentimento do admin, a pessoa aprova e
// pronto (apps/api/mcp_oauth.go). A aba mostra o endereço, o prompt para configurar o agente, os agentes conectados
// (com logo e nome do provedor), as últimas chamadas e as ferramentas.

type McpTool = { name: string; title: string; description: string; scope: string; readOnly: boolean };
type McpCall = { at: string; kind: 'oauth' | 'token' | 'session'; provider: string; version?: string; logoUri?: string; domain?: string; person: string; tool: string; ok: boolean; ms: number };
type McpInfo = { enabled: boolean; path: string; protocolVersion: string; serverVersion: string; tools: McpTool[]; calls: McpCall[] };
type McpConnection = { id: string; clientName: string; logoUri?: string; domain?: string; memberName: string; createdAt: string; lastUsedAt?: string };

const ago = (iso?: string) => {
  if (!iso) return 'nunca';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  if (s < 86400) return `há ${Math.round(s / 3600)} h`;
  return new Date(iso).toLocaleDateString('pt-BR');
};

/** O prompt que a pessoa cola no agente para ele se configurar sozinho. */
export function agentPrompt(url: string, tools: McpTool[]): string {
  const base = url.replace(/\/api\/mcp$/, '');
  return [
    'Conecte-se ao CRM da Kalidash pelo MCP.',
    '',
    `- Servidor MCP remoto (transporte Streamable HTTP): ${url}`,
    `- Autenticação: OAuth 2.1 com registro dinâmico de cliente; metadados em ${base}/.well-known/oauth-authorization-server. Não precisa de token: ao conectar, abre a tela do Kalidash para eu aprovar.`,
    '- Se você aceita conectores personalizados (claude.ai, ChatGPT, Cursor, VS Code…), adicione um conector remoto com o endereço acima.',
    `- Se você é o Claude Code, rode \`claude mcp add --transport http kalidash ${url}\` e depois /mcp para autenticar.`,
    '',
    `Depois de conectado, use as ferramentas do Kalidash (${tools.slice(0, 6).map((t) => t.name).join(', ')}${tools.length > 6 ? '…' : ''}) para responder sobre leads, oportunidades, pessoas, tarefas e o blog. Datas em ISO 8601 no fuso de Brasília (-03:00).`,
  ].join('\n');
}

function CopyButton({ text, label = 'Copiar', solid = false, icon }: { text: string; label?: string; solid?: boolean; icon?: React.ReactNode }) {
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle');
  useEffect(() => {
    if (state === 'idle') return;
    const t = window.setTimeout(() => setState('idle'), 1800);
    return () => window.clearTimeout(t);
  }, [state]);
  return (
    <button type="button" className={`btn ${solid ? 'btn-solid' : 'btn-sm'}`} onClick={async () => setState((await copyText(text)) ? 'ok' : 'fail')}>
      {state === 'ok' ? <Check size={14} /> : icon ?? <Copy size={13} />}
      {state === 'ok' ? 'Copiado' : state === 'fail' ? 'Não copiou' : label}
    </button>
  );
}

const KIND_LABEL: Record<McpCall['kind'], string> = { oauth: 'OAuth', token: 'Token de API', session: 'Sessão do admin' };

export function McpTab({ onGoTokens }: { onGoTokens: () => void }) {
  const auth = useAuth();
  const can = useCan();
  const [info, setInfo] = useState<McpInfo | null>(null);
  const [conns, setConns] = useState<McpConnection[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [revoking, setRevoking] = useState<McpConnection | null>(null);
  const live = auth.status === 'in';
  const allowed = can.has('mcp:use');

  const load = async () => {
    setError(undefined);
    try {
      const [ri, rc] = await Promise.all([fetch(`${API_URL}/api/mcp/info`), fetch(`${API_URL}/api/mcp/connections`)]);
      if (ri.status === 404) throw new Error('Esta API ainda não tem o servidor MCP. Atualize a API para a versão com /api/mcp.');
      if (!ri.ok) throw new Error(`A API respondeu ${ri.status}.`);
      setInfo((await ri.json()) as McpInfo);
      setConns(rc.ok ? (((await rc.json()) as McpConnection[] | null) ?? []) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'A API não respondeu.');
    }
  };

  useEffect(() => { if (live && allowed) void load(); }, [live, allowed]);

  const revoke = async () => {
    if (!revoking) return;
    const target = revoking;
    setRevoking(null);
    const res = await fetch(`${API_URL}/api/mcp/connections/${encodeURIComponent(target.id)}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      pushErro('Não foi possível revogar', typeof body.error === 'string' ? body.error : `A API respondeu ${res.status}.`);
      return;
    }
    setConns((c) => c.filter((x) => x.id !== target.id));
  };

  if (!live) return <Offline what="Conectar agentes por MCP" />;
  if (!allowed) return <EmptyState title="Sem permissão para MCP">Só quem tem a permissão Conectar agentes (MCP), do Admin e do Gerente por padrão, vê e configura os agentes.</EmptyState>;
  if (error && !info) return <LoadError message={error} onRetry={() => void load()} />;
  if (!info) return <Skeleton rows={5} />;

  const url = `${API_URL.replace(/\/$/, '')}${info.path}`;

  return (
    <div className="settings-pane form-stack mcp-pane">
      <div className="pane-head" style={{ marginBottom: 0 }}>
        <p className="section-sub" style={{ margin: 0 }}>
          Conecte agentes de IA ao CRM pelo protocolo MCP. O agente entra pelo login do Kalidash: você aprova uma vez e ele passa a
          agir em seu nome, com as suas permissões. O que ele grava fica no histórico com o nome do agente.
        </p>
      </div>

      <section className="mcp-card">
        <div className="mcp-card-head">
          <div>
            <span className="mcp-eyebrow">Endereço do servidor</span>
            <code className="mcp-url">{url}</code>
          </div>
          <div className="mcp-card-actions">
            <Badge tone={info.enabled ? 'success' : 'neutral'}>{info.enabled ? 'Ligado' : 'Desligado'}</Badge>
            <CopyButton text={url} />
          </div>
        </div>
      </section>

      <section className="mcp-card mcp-setup">
        <div className="mcp-setup-text">
          <h3 className="mcp-h3">Configure o agente</h3>
          <p className="text-sm text-muted" style={{ margin: 0 }}>
            Cole o prompt no agente (claude.ai, ChatGPT, Cursor, Claude Code ou qualquer outro que aceite MCP) ou adicione um conector com o
            endereço acima. Na primeira chamada abre a tela do Kalidash para você permitir o acesso.
          </p>
        </div>
        <CopyButton text={agentPrompt(url, info.tools)} label="Copiar prompt" solid icon={<Sparkles size={14} />} />
      </section>

      <section>
        <h3 className="mcp-h3">Agentes conectados</h3>
        <p className="section-sub">A aprovação se renova sozinha enquanto o agente for usado (expira após 30 dias parado). Revogar corta na hora.</p>
        {conns.length === 0 ? (
          <div className="mcp-empty"><Bot size={18} /><span>Nenhum agente conectado por OAuth ainda.</span></div>
        ) : (
          <div className="mcp-agents">
            {conns.map((c) => (
              <div key={c.id} className="mcp-agent">
                <ProviderLogo name={c.clientName} logoUri={c.logoUri} domain={c.domain} size={36} />
                <div className="mcp-agent-body">
                  <strong>{c.clientName}</strong>
                  <span className="text-xs text-muted">
                    Aprovado por {c.memberName || 'alguém da equipe'} em {new Date(c.createdAt).toLocaleDateString('pt-BR')}{c.domain ? ` · ${c.domain}` : ''}
                  </span>
                </div>
                <span className="text-xs text-muted" style={{ whiteSpace: 'nowrap' }}>Usado {ago(c.lastUsedAt)}</span>
                <button type="button" className="btn btn-sm btn-danger" onClick={() => setRevoking(c)}>Revogar</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="pane-head" style={{ marginBottom: 8 }}>
          <div>
            <h3 className="mcp-h3">Últimas chamadas</h3>
            <p className="section-sub" style={{ margin: 0 }}>As 50 mais recentes desde que a API ligou.</p>
          </div>
          <button type="button" className="btn btn-sm" onClick={() => void load()}><RotateCcw size={13} /> Atualizar</button>
        </div>
        {info.calls.length === 0 ? (
          <div className="mcp-empty"><Bot size={18} /><span>Nenhum agente chamou o servidor ainda.</span></div>
        ) : (
          <div className="table-card"><div className="table-scroll">
            <table className="data-table acc-table">
              <thead><tr><th>Agente</th><th>Em nome de</th><th>Ferramenta</th><th>Resultado</th><th>Quando</th></tr></thead>
              <tbody>
                {info.calls.map((c, i) => (
                  <tr key={`${c.at}-${i}`}>
                    <td>
                      <div className="mcp-caller">
                        <ProviderLogo name={c.provider} logoUri={c.logoUri} domain={c.domain} size={26} />
                        <div className="cell-stack">
                          <span className="cell-primary">{c.provider}{c.version ? <span className="text-muted"> {c.version}</span> : null}</span>
                          <span className="text-xs text-muted">{KIND_LABEL[c.kind] ?? c.kind}</span>
                        </div>
                      </div>
                    </td>
                    <td>{c.person || '—'}</td>
                    <td><code className="text-xs">{c.tool}</code></td>
                    <td>{c.ok ? <Badge tone="success">Ok</Badge> : <Badge tone="danger">Erro</Badge>}</td>
                    <td className="text-muted" style={{ whiteSpace: 'nowrap' }} title={`${new Date(c.at).toLocaleString('pt-BR')} · ${c.ms} ms`}>{ago(c.at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div></div>
        )}
      </section>

      <section>
        <h3 className="mcp-h3">Ferramentas</h3>
        <p className="section-sub">O agente só vê as ferramentas que as permissões de quem aprovou abrem.</p>
        <div className="table-card"><div className="table-scroll">
          <table className="data-table acc-table">
            <thead><tr><th>Ferramenta</th><th>O que faz</th><th>Permissão</th><th>Tipo</th></tr></thead>
            <tbody>
              {info.tools.map((t) => (
                <tr key={t.name}>
                  <td><div className="cell-stack"><span className="cell-primary">{t.title}</span><code className="text-xs text-muted">{t.name}</code></div></td>
                  <td className="text-muted">{t.description}</td>
                  <td><code className="acc-chip">{t.scope}</code></td>
                  <td>{t.readOnly ? <Badge tone="neutral">Consulta</Badge> : <Badge tone="warning">Grava</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      </section>

      <div className="mcp-token-note">
        <p className="text-xs text-muted" style={{ margin: 0 }}>
          Automação sem pessoa na frente (n8n, scripts)? Use um token de API com a permissão Conectar agentes (MCP) no cabeçalho Authorization: Bearer.
        </p>
        <button type="button" className="btn btn-sm" onClick={onGoTokens}><KeyRound size={13} /> Tokens de API</button>
      </div>

      {revoking && (
        <PopupDialog
          title={`Revogar ${revoking.clientName}?`}
          tone="danger"
          onClose={() => setRevoking(null)}
          footer={
            <>
              <button type="button" className="btn" onClick={() => setRevoking(null)}>Cancelar</button>
              <button type="button" className="btn btn-danger" onClick={() => void revoke()}>Revogar acesso</button>
            </>
          }
        >
          <p style={{ margin: 0 }}>O agente perde o acesso na hora. Para voltar a usar, alguém precisa conectar e aprovar de novo.</p>
        </PopupDialog>
      )}
    </div>
  );
}
