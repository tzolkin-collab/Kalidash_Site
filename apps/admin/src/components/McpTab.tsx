import { useEffect, useState } from 'react';
import { Bot, Check, Copy, KeyRound, RotateCcw } from 'lucide-react';
import { API_URL } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useCan } from '../lib/permissions';
import { Badge, EmptyState } from './ui';
import { copyText, LoadError, Offline, Skeleton } from './Access';

// Aba "MCP e agentes" (Configurações): como ligar Claude, Cursor e outros agentes ao CRM pelo servidor MCP da API
// (apps/api/mcp.go). Cada agente usa um token de API próprio, com mcp:use e os escopos das áreas que ele pode tocar.

type McpTool = { name: string; title: string; description: string; scope: string; readOnly: boolean };
type McpCall = { at: string; actor: string; tool: string; ok: boolean; ms: number };
type McpInfo = { enabled: boolean; path: string; protocolVersion: string; serverVersion: string; tools: McpTool[]; calls: McpCall[] };

type Snippet = 'claude-code' | 'cursor' | 'claude-desktop' | 'curl';

const SNIPPET_LABEL: Record<Snippet, string> = {
  'claude-code': 'Claude Code',
  cursor: 'Cursor',
  'claude-desktop': 'Claude Desktop',
  curl: 'Testar (curl)',
};

function snippetOf(kind: Snippet, url: string): { hint: string; code: string } {
  switch (kind) {
    case 'claude-code':
      return {
        hint: 'No terminal, na pasta do projeto. Troque SEU_TOKEN pelo token criado.',
        code: `claude mcp add --transport http kalidash ${url} --header "Authorization: Bearer SEU_TOKEN"`,
      };
    case 'cursor':
      return {
        hint: 'Em .cursor/mcp.json (no projeto) ou em Settings → MCP.',
        code: JSON.stringify({ mcpServers: { kalidash: { url, headers: { Authorization: 'Bearer SEU_TOKEN' } } } }, null, 2),
      };
    case 'claude-desktop':
      return {
        hint: 'Em Configurações → Desenvolvedor → Editar configuração (claude_desktop_config.json). Precisa do Node instalado.',
        code: JSON.stringify(
          { mcpServers: { kalidash: { command: 'npx', args: ['-y', 'mcp-remote', url, '--header', 'Authorization:${KALIDASH_AUTH}'], env: { KALIDASH_AUTH: 'Bearer SEU_TOKEN' } } } },
          null,
          2,
        ),
      };
    case 'curl':
      return {
        hint: 'Lista as ferramentas que o token alcança. Útil para conferir os escopos antes de ligar o agente.',
        code: `curl -X POST ${url} \\\n  -H "Authorization: Bearer SEU_TOKEN" \\\n  -H "Content-Type: application/json" \\\n  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`,
      };
  }
}

const ago = (iso: string) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  if (s < 86400) return `há ${Math.round(s / 3600)} h`;
  return new Date(iso).toLocaleDateString('pt-BR');
};

function CopyButton({ text, label = 'Copiar' }: { text: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle');
  useEffect(() => {
    if (state === 'idle') return;
    const t = window.setTimeout(() => setState('idle'), 1800);
    return () => window.clearTimeout(t);
  }, [state]);
  return (
    <button type="button" className="btn btn-sm" onClick={async () => setState((await copyText(text)) ? 'ok' : 'fail')}>
      {state === 'ok' ? <Check size={13} /> : <Copy size={13} />}
      {state === 'ok' ? 'Copiado' : state === 'fail' ? 'Não copiou' : label}
    </button>
  );
}

export function McpTab({ onGoTokens }: { onGoTokens: () => void }) {
  const auth = useAuth();
  const can = useCan();
  const [info, setInfo] = useState<McpInfo | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [snippet, setSnippet] = useState<Snippet>('claude-code');
  const live = auth.status === 'in';
  const allowed = can.has('mcp:use');

  const load = async () => {
    setError(undefined);
    try {
      const res = await fetch(`${API_URL}/api/mcp/info`);
      if (res.status === 404) throw new Error('Esta API ainda não tem o servidor MCP. Atualize a API para a versão com /api/mcp.');
      if (!res.ok) throw new Error(`A API respondeu ${res.status}.`);
      setInfo((await res.json()) as McpInfo);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'A API não respondeu.');
    }
  };

  useEffect(() => { if (live && allowed) void load(); }, [live, allowed]);

  if (!live) return <Offline what="Conectar agentes por MCP" />;
  if (!allowed) return <EmptyState title="Sem permissão para MCP">Só quem tem a permissão Conectar agentes (MCP), do Admin e do Gerente por padrão, vê e configura os agentes.</EmptyState>;
  if (error && !info) return <LoadError message={error} onRetry={() => void load()} />;
  if (!info) return <Skeleton rows={5} />;

  const url = `${API_URL.replace(/\/$/, '')}${info.path}`;
  const sn = snippetOf(snippet, url);

  return (
    <div className="settings-pane form-stack mcp-pane">
      <div className="pane-head" style={{ marginBottom: 0 }}>
        <p className="section-sub" style={{ margin: 0 }}>
          Ligue Claude, Cursor e outros agentes de IA ao CRM pelo protocolo MCP. Cada agente entra com um token de API próprio
          e só alcança o que os escopos do token permitem. Tudo o que ele grava fica no histórico com o nome do token.
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
        <p className="text-xs text-muted" style={{ margin: 0 }}>
          MCP via HTTP (Streamable HTTP, protocolo {info.protocolVersion}), servidor {info.serverVersion}. Os conectores do claude.ai na web
          pedem login por OAuth, que ainda não existe aqui: por enquanto use o Claude Code, o Claude Desktop ou o Cursor.
        </p>
      </section>

      <section className="mcp-steps">
        <div className="mcp-step">
          <span className="mcp-step-num">1</span>
          <div className="mcp-step-body">
            <strong>Crie um token para o agente</strong>
            <p className="text-muted">
              Em Tokens de API, marque <b>Conectar agentes (MCP)</b> e as áreas que ele pode usar: Ver leads, Ver tarefas, Criar e editar
              tarefas… Um token por agente, para revogar um sem derrubar os outros.
            </p>
            <button type="button" className="btn btn-sm" onClick={onGoTokens}><KeyRound size={13} /> Ir para Tokens de API</button>
          </div>
        </div>
        <div className="mcp-step">
          <span className="mcp-step-num">2</span>
          <div className="mcp-step-body">
            <strong>Configure o agente</strong>
            <div className="mcp-snippet-tabs" role="tablist" aria-label="Onde configurar">
              {(Object.keys(SNIPPET_LABEL) as Snippet[]).map((k) => (
                <button key={k} type="button" role="tab" aria-selected={snippet === k} className={`btn btn-sm ${snippet === k ? 'btn-solid' : ''}`} onClick={() => setSnippet(k)}>
                  {SNIPPET_LABEL[k]}
                </button>
              ))}
            </div>
            <p className="text-muted">{sn.hint}</p>
            <div className="mcp-code">
              <pre><code>{sn.code}</code></pre>
              <div className="mcp-code-copy"><CopyButton text={sn.code} /></div>
            </div>
          </div>
        </div>
        <div className="mcp-step">
          <span className="mcp-step-num">3</span>
          <div className="mcp-step-body">
            <strong>Peça ao agente</strong>
            <p className="text-muted">Por exemplo: “Quais leads novos entraram esta semana?”, “Crie uma tarefa para ligar para a Ana amanhã às 10h”.</p>
          </div>
        </div>
      </section>

      <section>
        <h3 className="mcp-h3">Ferramentas</h3>
        <p className="section-sub">O agente só vê as ferramentas cujo escopo o token tem.</p>
        <div className="table-card"><div className="table-scroll">
          <table className="data-table acc-table">
            <thead>
              <tr><th>Ferramenta</th><th>O que faz</th><th>Escopo</th><th>Tipo</th></tr>
            </thead>
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

      <section>
        <div className="pane-head" style={{ marginBottom: 8 }}>
          <div>
            <h3 className="mcp-h3">Últimas chamadas</h3>
            <p className="section-sub" style={{ margin: 0 }}>As 50 mais recentes desde que a API ligou.</p>
          </div>
          <button type="button" className="btn btn-sm" onClick={() => void load()}><RotateCcw size={13} /> Atualizar</button>
        </div>
        {info.calls.length === 0 ? (
          <div className="mcp-empty">
            <Bot size={18} />
            <span>Nenhum agente chamou o servidor ainda. Depois do passo 2, as chamadas aparecem aqui.</span>
          </div>
        ) : (
          <div className="table-card"><div className="table-scroll">
            <table className="data-table acc-table">
              <thead><tr><th>Quando</th><th>Quem</th><th>Ferramenta</th><th>Resultado</th><th>Tempo</th></tr></thead>
              <tbody>
                {info.calls.map((c, i) => (
                  <tr key={`${c.at}-${i}`}>
                    <td className="text-muted acc-nowrap" title={new Date(c.at).toLocaleString('pt-BR')}>{ago(c.at)}</td>
                    <td>{c.actor}</td>
                    <td><code className="text-xs">{c.tool}</code></td>
                    <td>{c.ok ? <Badge tone="success">Ok</Badge> : <Badge tone="danger">Erro</Badge>}</td>
                    <td className="text-muted">{c.ms} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div></div>
        )}
      </section>
    </div>
  );
}
