import { createStore } from '../lib/store';
import type { Lead } from '../domain';

// Dados de exemplo (fase 3 do plano). Ver docs/dominio.md §4.
// As quantidades por etapa batem com as de mocks/pipelines.ts.
// `wasSeen` e os vínculos com pessoa e empresa seguem os dados de mocks/people.ts.

export const leadsStore = createStore<Lead[]>([
  { id: 'l1', name: 'Renata Moura', email: 'renata.moura@exemplo.com.br', phone: '(11) 98888-1122', personId: 'p9', pipelineId: 'q4', stageId: 'q4:novos', origin: 'INBOUND', sourceName: 'Formulário da LP Consultoria', owner: 'Diego Costa', estimatedValue: 12000, tags: ['Quente'], message: 'Quero estruturar o time comercial da minha agência.', status: 'ACTIVE', wasSeen: false, createdAt: '2026-09-27T07:58:00Z' },
  { id: 'l2', name: 'Estúdio Lumen', email: 'contato@estudiolumen.com.br', pipelineId: 'q4', stageId: 'q4:novos', origin: 'INBOUND', sourceName: 'Formulário da LP Consultoria', tags: ['Agência'], message: 'Vi o anúncio e queria entender os valores.', status: 'ACTIVE', wasSeen: false, createdAt: '2026-09-26T17:05:00Z' },
  { id: 'l3', name: 'Paulo Henrique Dias', email: 'paulo.dias@exemplo.com.br', phone: '(21) 97777-3344', personId: 'p8', pipelineId: 'q4', stageId: 'q4:novos', origin: 'OUTBOUND', sourceName: 'Diego Costa', tags: ['Indicação'], status: 'ACTIVE', wasSeen: false, createdAt: '2026-09-26T10:30:00Z' },
  { id: 'l4', name: 'Fernanda Lopes', email: 'fernanda@lopesconsult.com.br', phone: '(31) 96666-5566', personId: 'p5', companyId: 'c3', pipelineId: 'q4', stageId: 'q4:contato', origin: 'INBOUND', sourceName: 'Formulário da LP Consultoria', tags: ['Quente'], status: 'ACTIVE', wasSeen: true, firstContactAt: '2026-09-24T15:00:00Z', createdAt: '2026-09-24T14:12:00Z' },
  { id: 'l5', name: 'Grupo Vértice', email: 'compras@grupovertice.com.br', companyId: 'c4', pipelineId: 'q4', stageId: 'q4:contato', origin: 'OUTBOUND', sourceName: 'Marina Alves', owner: 'Marina Alves', estimatedValue: 30000, tags: ['B2B'], status: 'ACTIVE', wasSeen: false, createdAt: '2026-09-23T09:00:00Z' },
  { id: 'l6', name: 'Instituto Aurora', email: 'parcerias@institutoaurora.org.br', pipelineId: 'b2b', stageId: 'b2b:novos', origin: 'OUTBOUND', sourceName: 'Marina Alves', tags: ['ONG'], status: 'ACTIVE', wasSeen: false, createdAt: '2026-09-25T13:40:00Z' },
  { id: 'l7', name: 'Casa do Código Aberto', email: 'oi@casadocodigo.dev', pipelineId: 'b2b', stageId: 'b2b:novos', origin: 'INBOUND', sourceName: 'Importação de planilha', tags: ['Tecnologia'], status: 'ACTIVE', wasSeen: false, createdAt: '2026-09-22T16:20:00Z' },
  { id: 'l8', name: 'Clínica Bem Viver', email: 'admin@clinicabemviver.com.br', personId: 'p10', companyId: 'c5', pipelineId: 'b2b', stageId: 'b2b:contato', origin: 'OUTBOUND', sourceName: 'Diego Costa', tags: ['Saúde'], status: 'ACTIVE', wasSeen: false, createdAt: '2026-09-21T11:15:00Z' },
  { id: 'l9', name: 'Tatiane Freitas', email: 'tati.freitas@exemplo.com.br', personId: 'p11', returningClient: true, pipelineId: 'exp26', stageId: 'exp26:novos', origin: 'OUTBOUND', sourceName: 'Carol Sales', tags: ['Cliente atual'], status: 'ACTIVE', wasSeen: false, createdAt: '2026-09-20T15:00:00Z' },
]);

/** Motivos de descarte de lead. Lista do time. */
export const discardReasonsStore = createStore<string[]>(['Sem orçamento', 'Sem interesse', 'Fora do perfil', 'Contato inválido', 'Duplicado']);
