import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, ShieldCheck } from 'lucide-react';
import { API_URL } from '../lib/api';
import { ProviderLogo } from '../components/ProviderLogo';

// Consentimento do OAuth do MCP (apps/api/mcp_oauth.go). O /oauth/authorize da API manda para cá com os parâmetros
// do pedido; a pessoa logada vê qual provedor quer acessar, o que ele vai poder fazer, e aprova ou recusa. A API
// devolve o endereço de volta do provedor (com o código, ou com access_denied) e a página segue para ele.

export const OAUTH_PENDING_KEY = 'kld_oauth_pending';

type ConsentInfo = {
  client: { name: string; logoUri?: string; domain?: string };
  redirectHost: string;
  canConnect: boolean;
  member: string;
  tools: { name: string; title: string }[];
};

export default function AuthorizeAgent() {
  const params = useMemo(() => {
    const out: Record<string, string> = {};
    new URLSearchParams(window.location.search).forEach((v, k) => { out[k] = v; });
    return out;
  }, []);
  const [info, setInfo] = useState<ConsentInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'approve' | 'deny' | null>(null);

  useEffect(() => {
    sessionStorage.removeItem(OAUTH_PENDING_KEY);
    if (!params.client_id) {
      setError('Este endereço não traz um pedido de conexão. Comece pelo agente (claude.ai, ChatGPT, Cursor…).');
      return;
    }
    void (async () => {
      try {
        const res = await fetch(`${API_URL}/api/oauth/consent?${new URLSearchParams(params).toString()}`);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof body.error === 'string' ? body.error : `A API respondeu ${res.status}.`);
        setInfo(body as ConsentInfo);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'A API não respondeu.');
      }
    })();
  }, [params]);

  const decide = async (approve: boolean) => {
    setBusy(approve ? 'approve' : 'deny');
    try {
      const res = await fetch(`${API_URL}/api/oauth/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ params, approve }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || typeof body.redirect !== 'string') throw new Error(typeof body.error === 'string' ? body.error : `A API respondeu ${res.status}.`);
      window.location.replace(body.redirect);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'A API não respondeu.');
      setBusy(null);
    }
  };

  return (
    <main className="login-screen">
      <section className="login-card consent-card" aria-labelledby="consent-title">
        {error ? (
          <>
            <img src="/kalidash-logo.svg" alt="Kalidash" className="login-logo" />
            <h1 id="consent-title" className="login-title">Não foi possível conectar</h1>
            <p className="text-sm" role="alert" style={{ margin: 0 }}>{error}</p>
            <a className="btn" href="/">Voltar ao Kalidash</a>
          </>
        ) : !info ? (
          <p className="text-sm text-muted" aria-busy="true">Carregando o pedido…</p>
        ) : (
          <>
            <div className="consent-logos" aria-hidden>
              <ProviderLogo name={info.client.name} logoUri={info.client.logoUri} domain={info.client.domain} size={52} />
              <ArrowLeftRight size={18} className="text-muted" />
              <span className="consent-kd"><img src="/kalidash-icon.svg" alt="" /></span>
            </div>
            <h1 id="consent-title" className="login-title">{info.client.name} quer acessar o Kalidash</h1>
            <p className="text-sm text-muted" style={{ margin: 0 }}>
              Você está conectado como <strong>{info.member}</strong>. O agente vai agir em seu nome, com as suas permissões, e tudo o que ele gravar fica no histórico como “{info.client.name} · {info.member}”.
            </p>
            {info.canConnect ? (
              <>
                <div className="consent-tools">
                  <span className="mcp-eyebrow">O que ele vai poder fazer</span>
                  <ul>
                    {info.tools.map((t) => <li key={t.name}>{t.title}</li>)}
                    {info.tools.length === 0 && <li>Nada por enquanto: suas permissões não abrem nenhuma ferramenta.</li>}
                  </ul>
                </div>
                <p className="text-xs text-muted consent-redirect"><ShieldCheck size={13} /><span>Depois de aprovar, você volta para <code>{info.redirectHost}</code>. Dá para revogar a qualquer momento em Configurações → MCP e agentes.</span></p>
                <div className="consent-actions">
                  <button type="button" className="btn" disabled={busy !== null} onClick={() => void decide(false)}>{busy === 'deny' ? 'Recusando…' : 'Recusar'}</button>
                  <button type="button" className="btn btn-solid" disabled={busy !== null} onClick={() => void decide(true)}>{busy === 'approve' ? 'Conectando…' : 'Permitir acesso'}</button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm" role="alert" style={{ margin: 0 }}>Sua conta não tem a permissão “Conectar agentes (MCP)”. Peça a um Admin para liberar.</p>
                <div className="consent-actions">
                  <button type="button" className="btn" disabled={busy !== null} onClick={() => void decide(false)}>Voltar ao agente</button>
                </div>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}
