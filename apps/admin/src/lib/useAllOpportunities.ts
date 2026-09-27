import { useMemo } from 'react';
import { sampleOppsStore } from '../mocks/opportunities';
import { useOpportunities } from './useOpportunities';
import { useStore } from './store';

/** As oportunidades da API mais as criadas no protótipo (qualificar e "nova oportunidade"). */
export function useAllOpportunities() {
  const api = useOpportunities();
  const [samples] = useStore(sampleOppsStore);
  const all = useMemo(() => [...samples, ...api.opportunities], [samples, api.opportunities]);
  return { ...api, all, samples };
}
