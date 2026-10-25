import { retryAuth } from '../lib/auth';

// O login está ligado nesta instalação, mas o servidor não respondeu: nada da área logada aparece.
export default function Unreachable() {
  return (
    <main className="login-screen">
      <section className="login-card" aria-labelledby="unreachable-title">
        <img src="/kalidash-logo.svg" alt="Kalidash" className="login-logo" />
        <h1 id="unreachable-title" className="login-title">Sem conexão com o servidor</h1>
        <p className="text-sm text-muted" style={{ margin: 0 }}>Não foi possível falar com o servidor do Kalidash. Verifique sua internet e tente de novo. Nenhum dado é mostrado sem confirmar o seu acesso.</p>
        <button type="button" className="btn btn-solid login-btn" onClick={retryAuth}>Tentar de novo</button>
      </section>
    </main>
  );
}
