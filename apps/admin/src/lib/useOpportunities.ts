import { useCallback, useEffect, useState } from 'react';
import type { Opportunity } from '../types';
import { API_URL } from './api';

/** Carrega as oportunidades da API (a rota /api/leads ainda as serve). */
export function useOpportunities() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(
    () =>
      fetch(`${API_URL}/api/leads`)
        .then((res) => {
          if (!res.ok) throw new Error(String(res.status));
          return res.json();
        })
        .then((data: Opportunity[] | null) => setOpportunities(data || []))
        .catch((err) => {
          console.error('Erro ao carregar oportunidades:', err);
          setError('Não foi possível falar com a API. Confira se ela está no ar.');
        })
        .finally(() => setLoading(false)),
    [],
  );

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    void fetchAll();
  }, [fetchAll]);

  return { opportunities, setOpportunities, loading, error, reload };
}
