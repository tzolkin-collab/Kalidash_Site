import { useCallback, useEffect, useState } from 'react';

// Roteamento por hash (#/leads, #/tarefas/q4). Sem dependência e sem configuração de servidor:
// funciona em qualquer hospedagem estática e mantém o botão "voltar" do navegador.

const read = () => window.location.hash.replace(/^#\/?/, '').split('?')[0];

export function useHashRoute() {
  const [hash, setHash] = useState(read);

  useEffect(() => {
    const onChange = () => setHash(read());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((to: string) => {
    window.location.hash = to.startsWith('/') ? to : `/${to}`;
  }, []);

  const segments = hash.split('/').filter(Boolean).map(decodeURIComponent);
  return { segments, path: `/${segments.join('/')}`, navigate };
}
