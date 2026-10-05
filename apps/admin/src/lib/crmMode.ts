import { createStore, useStore } from './store.ts';

// Modo do CRM (pessoas, empresas e leads): 'api' quando a API tem CRM_API=1, 'local' com os dados de
// exemplo. Fica num módulo à parte para o workflowSync e o crmSync consultarem sem importar um ao outro.
export type CrmMode = 'loading' | 'api' | 'local';
export const crmModeStore = createStore<CrmMode>('loading');
export const useCrmMode = () => useStore(crmModeStore)[0];
