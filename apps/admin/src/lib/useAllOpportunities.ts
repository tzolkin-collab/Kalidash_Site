import { useMemo } from 'react';
import { sampleOppsStore } from '../mocks/opportunities';
import { useOpportunities } from './useOpportunities';
import { useStore } from './store';
import { withSampleOpportunities } from './workflowDiff';
import { useSyncMode } from './workflowSync';

/**
 * As oportunidades da API mais as criadas no protótipo (qualificar e "nova oportunidade"). Com a API de funis
 * ligada, só as da API: as de exemplo (id não numérico) não sincronizam tarefas e nunca podem aparecer (B-10).
 */
export function useAllOpportunities() {
  const api = useOpportunities();
  const [samples] = useStore(sampleOppsStore);
  const apiMode = useSyncMode() === 'api';
  const all = useMemo(() => withSampleOpportunities(samples, api.opportunities, apiMode), [samples, api.opportunities, apiMode]);
  return { ...api, all, samples: apiMode ? [] : samples };
}
