import { updateApp, usePwa } from '../lib/pwa';

const bar = { position: 'fixed', left: 12, right: 12, zIndex: 3000, display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center', padding: '8px 14px', borderRadius: 10, fontSize: 13, background: '#28183b', color: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,.25)' } as const;

/** Aviso de versão nova e de falta de conexão. */
export function PwaPrompt() {
  const { needRefresh, online } = usePwa();
  return (
    <>
      {!online && (
        <div role="status" style={{ ...bar, top: 12, background: '#7a4b00' }}>
          Sem conexão. Você vê a última tela carregada; dados e ações do CRM só voltam quando a rede voltar.
        </div>
      )}
      {needRefresh && (
        <div role="alert" style={{ ...bar, bottom: 12 }}>
          <span>Há uma versão nova do Kalidash. Salve o que estiver editando antes de atualizar.</span>
          <button type="button" onClick={updateApp} style={{ padding: '4px 12px', borderRadius: 6, border: 0, cursor: 'pointer', fontWeight: 600 }}>Atualizar</button>
        </div>
      )}
    </>
  );
}
