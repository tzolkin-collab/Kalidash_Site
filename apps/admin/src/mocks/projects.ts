import { createStore } from '../lib/store';
import type { ApiKey, ConnectedProject } from '../domain';

// Dados de exemplo (fase 5 do plano). Ver docs/pagesAdmin/projects.md.

export const projectsStore = createStore<ConnectedProject[]>([
  {
    id: 'lp-consultoria', name: 'LP Consultoria', url: 'https://consultoria.exemplo.com.br', description: 'Landing page da oferta de consultoria de vendas.', stack: 'Next.js (Vercel)',
    modules: [{ name: 'Formulário', status: 'ACTIVE' }, { name: 'Analytics', status: 'ACTIVE' }, { name: 'Ads', status: 'PENDING' }],
    forms: [
      { id: 'lp-consultoria:principal', name: 'Formulário principal', selector: 'form#lead-consultoria', fields: 6, views: 2140, submissions: 47 },
      { id: 'lp-consultoria:modal', name: 'Modal de inscrição', selector: '#modal-inscricao form', fields: 4, views: 812, submissions: 19 },
    ],
    visits: 5210, submissions: 66, topOrigin: 'Google Ads',
  },
  {
    id: 'site-kalidash', name: 'Site institucional', url: 'https://kalidash.exemplo.com.br', description: 'Site da Kalidash, com o formulário de contato.', stack: 'Next.js (Vercel)',
    modules: [{ name: 'Formulário', status: 'ACTIVE' }, { name: 'Analytics', status: 'ERROR' }, { name: 'Ads', status: 'PENDING' }],
    forms: [{ id: 'site-kalidash:contato', name: 'Fale conosco', selector: 'form.contact', fields: 5, views: 930, submissions: 21 }],
    visits: 3400, submissions: 21, topOrigin: 'Orgânico',
  },
  {
    id: 'lp-parcerias', name: 'LP Parcerias', url: 'https://parcerias.exemplo.com.br', description: 'Página estática para captar parceiros.', stack: 'HTML estático',
    modules: [{ name: 'Formulário', status: 'PENDING' }, { name: 'Analytics', status: 'ACTIVE' }],
    forms: [{ id: 'lp-parcerias:parceiro', name: 'Quero ser parceiro', selector: '#parceiro', fields: 7, views: 300, submissions: 0 }],
    visits: 640, submissions: 0, topOrigin: 'Indicação',
  },
]);

export const apiKeysStore = createStore<ApiKey[]>([
  { id: 'k1', name: 'Connect da LP Consultoria', env: 'live', prefix: 'kld_live_3f9c2a71b', project: 'LP Consultoria', scopes: ['forms:write', 'analytics:write'], createdAt: '2026-08-14T13:00:00Z', lastUsedAt: '2026-09-27T07:58:00Z', status: 'ACTIVE' },
  { id: 'k2', name: 'Connect do site institucional', env: 'live', prefix: 'kld_live_a81e5d20c', project: 'Site institucional', scopes: ['forms:write'], createdAt: '2026-08-20T10:30:00Z', lastUsedAt: '2026-09-26T18:12:00Z', status: 'ACTIVE' },
  { id: 'k3', name: 'Testes locais', env: 'test', prefix: 'kld_test_9f2a1c04e', project: 'LP Parcerias', scopes: ['forms:write', 'analytics:write'], createdAt: '2026-09-02T09:00:00Z', lastUsedAt: '2026-09-10T15:40:00Z', status: 'REVOKED' },
]);

export const SCOPE_INFO: Record<string, { label: string; hint: string; publicSafe: boolean }> = {
  'forms:write': { label: 'forms:write', hint: 'Criar leads a partir do Connect (o mínimo do snippet).', publicSafe: true },
  'analytics:write': { label: 'analytics:write', hint: 'Pageview, sessão e origem para as métricas do projeto.', publicSafe: true },
  'ads:read': { label: 'ads:read', hint: 'Sincronizar custo e CPL da conta de anúncios.', publicSafe: false },
  'leads:read': { label: 'leads:read', hint: 'Consultar a base pelo servidor.', publicSafe: false },
};
