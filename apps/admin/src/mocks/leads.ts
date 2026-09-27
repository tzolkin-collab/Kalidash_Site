import { createStore } from '../lib/store';
import type { Lead } from '../domain';

// Dados de exemplo (fase 3 do plano). Ver docs/dominio.md §4.
// As quantidades por etapa batem com as de mocks/pipelines.ts.

export const leadsStore = createStore<Lead[]>([
  { id: 'l1', name: 'Renata Moura', email: 'renata.moura@exemplo.com.br', phone: '(11) 98888-1122', pipelineId: 'q4', stageId: 'q4:novos', origin: 'INBOUND', sourceName: 'Formulário da LP Consultoria', tags: ['Quente'], message: 'Quero estruturar o time comercial da minha agência.', status: 'ACTIVE', createdAt: '2026-09-27T07:58:00Z' },
  { id: 'l2', name: 'Estúdio Lumen', email: 'contato@estudiolumen.com.br', pipelineId: 'q4', stageId: 'q4:novos', origin: 'INBOUND', sourceName: 'Formulário da LP Consultoria', tags: ['Agência'], message: 'Vi o anúncio e queria entender os valores.', status: 'ACTIVE', createdAt: '2026-09-26T17:05:00Z' },
  { id: 'l3', name: 'Paulo Henrique Dias', email: 'paulo.dias@exemplo.com.br', phone: '(21) 97777-3344', pipelineId: 'q4', stageId: 'q4:novos', origin: 'OUTBOUND', sourceName: 'Diego Costa', tags: ['Indicação'], status: 'ACTIVE', createdAt: '2026-09-26T10:30:00Z' },
  { id: 'l4', name: 'Fernanda Lopes', email: 'fernanda@lopesconsult.com.br', phone: '(31) 96666-5566', pipelineId: 'q4', stageId: 'q4:contato', origin: 'INBOUND', sourceName: 'Formulário da LP Consultoria', tags: ['Quente'], status: 'ACTIVE', createdAt: '2026-09-24T14:12:00Z' },
  { id: 'l5', name: 'Grupo Vértice', email: 'compras@grupovertice.com.br', pipelineId: 'q4', stageId: 'q4:contato', origin: 'OUTBOUND', sourceName: 'Marina Alves', tags: ['B2B'], status: 'ACTIVE', createdAt: '2026-09-23T09:00:00Z' },
  { id: 'l6', name: 'Instituto Aurora', email: 'parcerias@institutoaurora.org.br', pipelineId: 'b2b', stageId: 'b2b:novos', origin: 'OUTBOUND', sourceName: 'Marina Alves', tags: ['ONG'], status: 'ACTIVE', createdAt: '2026-09-25T13:40:00Z' },
  { id: 'l7', name: 'Casa do Código Aberto', email: 'oi@casadocodigo.dev', pipelineId: 'b2b', stageId: 'b2b:novos', origin: 'INBOUND', sourceName: 'Importação de planilha', tags: ['Tecnologia'], status: 'ACTIVE', createdAt: '2026-09-22T16:20:00Z' },
  { id: 'l8', name: 'Clínica Bem Viver', email: 'admin@clinicabemviver.com.br', pipelineId: 'b2b', stageId: 'b2b:contato', origin: 'OUTBOUND', sourceName: 'Diego Costa', tags: ['Saúde'], status: 'ACTIVE', createdAt: '2026-09-21T11:15:00Z' },
  { id: 'l9', name: 'Tatiane Freitas', email: 'tati.freitas@exemplo.com.br', pipelineId: 'exp26', stageId: 'exp26:novos', origin: 'OUTBOUND', sourceName: 'Carol Sales', tags: ['Cliente atual'], status: 'ACTIVE', createdAt: '2026-09-20T15:00:00Z' },
]);
