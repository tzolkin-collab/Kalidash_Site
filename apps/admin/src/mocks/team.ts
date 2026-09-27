import { createStore } from '../lib/store';
import type { AuditEntry, EmailLogEntry, TeamMember, Webhook } from '../domain';

// Dados de exemplo (fase 5/6 do plano). Ver docs/system-core.md.

export const teamStore = createStore<TeamMember[]>([
  { id: 'u1', name: 'Carol Sales', email: 'carol@agenciatzolkin.com', role: 'ADMIN', status: 'ACTIVE', lastAccess: '2026-09-27T09:12:00Z' },
  { id: 'u2', name: 'Marina Alves', email: 'marina@agenciatzolkin.com', role: 'MANAGER', status: 'ACTIVE', lastAccess: '2026-09-26T17:40:00Z' },
  { id: 'u3', name: 'Diego Costa', email: 'diego@agenciatzolkin.com', role: 'SELLER', status: 'ACTIVE', lastAccess: '2026-09-27T08:05:00Z' },
  { id: 'u4', name: 'Bianca Rocha', email: 'bianca@agenciatzolkin.com', role: 'SELLER', status: 'INVITED' },
]);

export const CURRENT_USER_ID = 'u1';

export const webhooksStore = createStore<Webhook[]>([
  { id: 'w1', name: 'Avisar o HubSpot do cliente', event: 'oportunidade.ganha', url: 'https://hooks.exemplo.com.br/hubspot/ganho', active: true, lastStatus: 'OK', lastAt: '2026-09-25T14:02:00Z' },
  { id: 'w2', name: 'Espelhar leads na planilha', event: 'lead.criado', url: 'https://hooks.exemplo.com.br/planilha/leads', active: true, lastStatus: 'FAILED', lastAt: '2026-09-27T07:31:00Z' },
  { id: 'w3', name: 'Notificar o Slack de vendas', event: 'oportunidade.mudou_de_etapa', url: 'https://hooks.exemplo.com.br/slack/vendas', active: false },
]);

export const auditLog: AuditEntry[] = [
  { id: 'a1', at: '2026-09-27T09:14:00Z', actor: 'Carol Sales', action: 'Alterou o valor', target: 'Oportunidade "Consultoria de Vendas Q4"' },
  { id: 'a2', at: '2026-09-27T08:50:00Z', actor: 'Diego Costa', action: 'Qualificou o lead', target: 'Lead "Renata Moura"' },
  { id: 'a3', at: '2026-09-26T16:20:00Z', actor: 'Marina Alves', action: 'Revogou a chave de API', target: 'kld_test_9f2a1c…' },
  { id: 'a4', at: '2026-09-26T11:03:00Z', actor: 'Carol Sales', action: 'Convidou para a equipe', target: 'bianca@agenciatzolkin.com (Vendedor)' },
  { id: 'a5', at: '2026-09-25T15:44:00Z', actor: 'Carol Sales', action: 'Criou o webhook', target: 'Avisar o HubSpot do cliente' },
  { id: 'a6', at: '2026-09-25T10:12:00Z', actor: 'Marina Alves', action: 'Moveu de etapa', target: 'Oportunidade "Treinamento de Equipe" → Ganho' },
  { id: 'a7', at: '2026-09-24T18:30:00Z', actor: 'Carol Sales', action: 'Editou a pipeline', target: 'Q4 Sales Pipeline (etapa "Assinatura do contrato")' },
];

export const emailLog: EmailLogEntry[] = [
  { id: 'm1', at: '2026-09-27T09:20:00Z', to: 'joao@acmecorp.com.br', subject: 'Resumo da nossa reunião', template: 'Follow-up Reunião', context: 'Consultoria de Vendas Q4', status: 'SENT' },
  { id: 'm2', at: '2026-09-27T08:02:00Z', to: 'renata.moura@exemplo.com.br', subject: 'Bem-vindo ao Kalidash!', template: 'Boas-vindas (Inbound)', context: 'Lead Renata Moura', status: 'SENT' },
  { id: 'm3', at: '2026-09-26T17:11:00Z', to: 'contato@estudiolumen.com.br', subject: 'Bem-vindo ao Kalidash!', template: 'Boas-vindas (Inbound)', context: 'Lead Estúdio Lumen', status: 'FAILED' },
  { id: 'm4', at: '2026-09-26T15:45:00Z', to: 'maria.oliveira@exemplo.com.br', subject: 'Resumo da nossa reunião', template: 'Follow-up Reunião', context: 'Mentoria Individual', status: 'SENT' },
  { id: 'm5', at: '2026-09-25T10:15:00Z', to: 'financeiro@agenciatzolkin.com', subject: 'Parabéns pelo fechamento!', template: 'Boas-vindas (Inbound)', context: 'Treinamento de Equipe', status: 'QUEUED' },
];
