import { retryAuth } from '../lib/auth';

// Sem sessão confirmada pelo servidor nada da área logada aparece. `nologin`: o servidor respondeu, mas sem
// o login ligado (no build de produção o admin não abre assim; ver authDecision.ts).
export default function Unreachable({ nologin = false }: { nologin?: boolean }) {
  return (
    <main className="login-screen">
      <section className="login-card" aria-labelledby="unreachable-title">
        <img src="/kalidash-logo.svg" alt="Kalidash" className="login-logo" />
        <h1 id="unreachable-title" className="login-title">{nologin ? 'Login ainda não configurado' : 'Sem conexão com o servidor'}</h1>
        <p className="text-sm text-muted" style={{ margin: 0 }}>
          {nologin
            ? 'O servidor do Kalidash respondeu, mas o login ainda não está ligado nele. O admin só abre depois de confirmar quem você é.'
            : 'Não foi possível falar com o servidor do Kalidash. Verifique sua internet e tente de novo. Nenhum dado é mostrado sem confirmar o seu acesso.'}
        </p>
        <button type="button" className="btn btn-solid login-btn" onClick={retryAuth}>Tentar de novo</button>
      </section>
    </main>
  );
}
