import { useState } from 'react';
import { devLogin, startGoogleLogin, useAuth } from '../lib/auth';

// Tela de entrada (só aparece quando a API está com AUTH_API=1 e não há sessão).
export default function Login() {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const enterDev = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError((await devLogin(email.trim())) ?? '');
    setBusy(false);
  };
  const denied = new URLSearchParams(window.location.search).has('negado');

  return (
    <main className="login-screen">
      <section className="login-card" aria-labelledby="login-title">
        <img src="/kalidash-logo.svg" alt="Kalidash" className="login-logo" />
        <h1 id="login-title" className="login-title">Entrar no Kalidash</h1>
        <p className="text-sm text-muted" style={{ margin: 0 }}>Acesso só para a equipe. Use a conta Google do e-mail que foi convidado.</p>
        {(auth.notice || denied) && <p className="text-sm" role="alert" style={{ margin: 0, color: 'var(--danger, #ef4444)' }}>{auth.notice ?? 'Não foi possível entrar.'}</p>}
        {auth.google && (
          <button type="button" className="btn btn-solid login-btn" onClick={startGoogleLogin}>Entrar com Google</button>
        )}
        {auth.dev && (
          <form onSubmit={enterDev} className="login-dev">
            <p className="text-xs text-muted" style={{ margin: 0 }}>Modo de desenvolvimento (sem Google). Não existe em produção.</p>
            <input className="input" type="email" required placeholder="e-mail da equipe" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="E-mail da equipe" />
            <button type="submit" className="btn login-btn" disabled={busy || !email.trim()}>Entrar (desenvolvimento)</button>
            {error && <span className="text-sm" role="alert" style={{ color: 'var(--danger, #ef4444)' }}>{error}</span>}
          </form>
        )}
        {!auth.google && !auth.dev && <p className="text-sm" role="alert" style={{ margin: 0 }}>Nenhuma forma de entrar está configurada na API (GOOGLE_CLIENT_ID ou AUTH_DEV_LOGIN).</p>}
      </section>
    </main>
  );
}
