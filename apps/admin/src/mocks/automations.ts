import { createStore } from '../lib/store';
import type { Automation, AutomationCategory } from '../domain';

// Dados de exemplo (fase 5 do plano). Ver docs/dominio.md §9.

export const CATEGORIES: AutomationCategory[] = ['Fontes', 'Leads', 'Oportunidades', 'Pendências', 'Notificações', 'E-mails'];

export type CatalogItem = { id: string; label: string; category: AutomationCategory; detail: string };

/** Eventos que a plataforma emite: os gatilhos possíveis. */
export const EVENTS: CatalogItem[] = [
  { id: 'formulario.enviado', label: 'Formulário enviado', category: 'Fontes', detail: 'Um formulário conectado recebeu um envio.' },
  { id: 'fonte.conectada', label: 'Fonte conectada a uma pipeline', category: 'Fontes', detail: 'Uma fonte passou a alimentar uma pipeline.' },
  { id: 'lead.criado', label: 'Lead criado', category: 'Leads', detail: 'Um lead entrou por fonte, cadastro manual ou importação.' },
  { id: 'lead.qualificado', label: 'Lead qualificado', category: 'Leads', detail: 'Um lead virou oportunidade.' },
  { id: 'lead.descartado', label: 'Lead descartado', category: 'Leads', detail: 'Um lead foi marcado como descartado.' },
  { id: 'oportunidade.criada', label: 'Oportunidade criada', category: 'Oportunidades', detail: 'Uma oportunidade nova entrou em uma pipeline.' },
  { id: 'oportunidade.mudou_de_etapa', label: 'Oportunidade mudou de etapa', category: 'Oportunidades', detail: 'Movida por arraste, botão ou automação.' },
  { id: 'oportunidade.ganha', label: 'Oportunidade ganha', category: 'Oportunidades', detail: 'Chegou a uma etapa do tipo Ganha.' },
  { id: 'oportunidade.perdida', label: 'Oportunidade perdida', category: 'Oportunidades', detail: 'Chegou a uma etapa do tipo Perdida, com o motivo.' },
  { id: 'oportunidade.parada', label: 'Oportunidade parada na etapa', category: 'Oportunidades', detail: 'Passou dos dias de alerta configurados na etapa.' },
  { id: 'tarefa.criada', label: 'Tarefa criada', category: 'Pendências', detail: 'Um requisito de etapa gerou uma tarefa.' },
  { id: 'tarefa.concluida', label: 'Tarefa concluída', category: 'Pendências', detail: 'Alguém cumpriu o requisito.' },
  { id: 'tarefa.atrasada', label: 'Tarefa atrasada', category: 'Pendências', detail: 'Passou do prazo do requisito.' },
  { id: 'notificacao.lida', label: 'Notificação lida', category: 'Notificações', detail: 'Quem recebeu abriu o aviso.' },
  { id: 'email.enviado', label: 'E-mail enviado', category: 'E-mails', detail: 'O provedor aceitou o envio.' },
  { id: 'email.falhou', label: 'E-mail falhou', category: 'E-mails', detail: 'O envio foi recusado ou voltou.' },
];

/** O que a plataforma sabe fazer: as ações possíveis. */
export const ACTIONS: CatalogItem[] = [
  { id: 'lead.criar', label: 'Criar lead', category: 'Fontes', detail: 'Cria o lead com a fonte de origem preenchida.' },
  { id: 'contato.criar', label: 'Criar contato (pessoa)', category: 'Fontes', detail: 'Cadastra a pessoa, com deduplicação por e-mail e CPF.' },
  { id: 'empresa.criar', label: 'Criar empresa', category: 'Fontes', detail: 'Cria a empresa; sem CNPJ ela fica em análise.' },
  { id: 'lead.qualificar', label: 'Qualificar lead', category: 'Leads', detail: 'Transforma o lead em oportunidade.' },
  { id: 'tag.adicionar', label: 'Adicionar tag', category: 'Leads', detail: 'Marca o registro com uma tag.' },
  { id: 'oportunidade.mover', label: 'Mover de etapa', category: 'Oportunidades', detail: 'Respeita os requisitos que impedem entrar ou sair.' },
  { id: 'responsavel.atribuir', label: 'Atribuir responsável', category: 'Oportunidades', detail: 'Define o dono do registro.' },
  { id: 'tarefa.criar', label: 'Criar tarefa', category: 'Pendências', detail: 'Abre uma pendência com tag, responsável e prazo.' },
  { id: 'notificar.equipe', label: 'Notificar alguém da equipe', category: 'Notificações', detail: 'Aviso dentro do admin.' },
  { id: 'webhook.chamar', label: 'Chamar webhook', category: 'Notificações', detail: 'POST em segundo plano, com nova tentativa progressiva.' },
  { id: 'email.enviar', label: 'Enviar e-mail com um modelo', category: 'E-mails', detail: 'Usa um modelo da página E-mails.' },
];

export const actionLabel = (id: string) => ACTIONS.find((a) => a.id === id)?.label ?? id;

export type AutomationRow = Automation & { triggerId: string; actionId: string; detail: string; pipeline: string };

export const automationsStore = createStore<AutomationRow[]>([
  { id: 'au1', name: 'Criar lead a partir do formulário da LP Consultoria', category: 'Fontes', trigger: 'Formulário enviado', action: 'Criar lead', triggerId: 'formulario.enviado', actionId: 'lead.criar', detail: 'Pipeline Q4 Sales Pipeline, etapa Novos', pipeline: 'Q4 Sales Pipeline', origin: 'MANAGED', managedBy: 'Conectar fonte: Formulário da LP Consultoria', active: true, lastRun: '2026-09-27T07:58:00Z', runs: 47 },
  { id: 'au2', name: 'Importar contatos da planilha de parcerias', category: 'Fontes', trigger: 'Formulário enviado', action: 'Criar contato (pessoa)', triggerId: 'formulario.enviado', actionId: 'contato.criar', detail: 'Pipeline Parcerias B2B, etapa Novos', pipeline: 'Parcerias B2B', origin: 'MANAGED', managedBy: 'Conectar fonte: Importação de planilha', active: true, lastRun: '2026-09-22T16:20:00Z', runs: 12 },
  { id: 'au3', name: 'Tarefa "Informar CNPJ" ao entrar em Negociação', category: 'Pendências', trigger: 'Oportunidade mudou de etapa', action: 'Criar tarefa', triggerId: 'oportunidade.mudou_de_etapa', actionId: 'tarefa.criar', detail: 'Tag Dados da empresa, prazo de 3 dias', pipeline: 'Q4 Sales Pipeline', origin: 'MANAGED', managedBy: 'Marcar como tarefa: CNPJ da empresa', active: true, lastRun: '2026-09-25T10:12:00Z', runs: 9 },
  { id: 'au4', name: 'Boas-vindas ao lead inbound', category: 'Leads', trigger: 'Lead criado', action: 'Enviar e-mail com um modelo', triggerId: 'lead.criado', actionId: 'email.enviar', detail: 'Modelo: Boas-vindas (Inbound)', pipeline: 'Todas', origin: 'MANUAL', active: true, lastRun: '2026-09-27T08:02:00Z', runs: 31 },
  { id: 'au5', name: 'Avisar o vendedor quando um lead entra', category: 'Leads', trigger: 'Lead criado', action: 'Notificar alguém da equipe', triggerId: 'lead.criado', actionId: 'notificar.equipe', detail: 'Responsável pela pipeline', pipeline: 'Todas', origin: 'MANUAL', active: true, lastRun: '2026-09-27T07:58:00Z', runs: 47 },
  { id: 'au6', name: 'Resumo por e-mail ao ganhar', category: 'Oportunidades', trigger: 'Oportunidade ganha', action: 'Enviar e-mail com um modelo', triggerId: 'oportunidade.ganha', actionId: 'email.enviar', detail: 'Modelo: Follow-up Reunião', pipeline: 'Todas', origin: 'MANUAL', active: true, lastRun: '2026-09-25T10:15:00Z', runs: 6 },
  { id: 'au7', name: 'Alerta de oportunidade parada', category: 'Oportunidades', trigger: 'Oportunidade parada na etapa', action: 'Notificar alguém da equipe', triggerId: 'oportunidade.parada', actionId: 'notificar.equipe', detail: 'Dono da oportunidade', pipeline: 'Todas', origin: 'MANUAL', active: true, lastRun: '2026-09-26T09:00:00Z', runs: 14 },
  { id: 'au8', name: 'Cobrar tarefas atrasadas', category: 'Pendências', trigger: 'Tarefa atrasada', action: 'Notificar alguém da equipe', triggerId: 'tarefa.atrasada', actionId: 'notificar.equipe', detail: 'Responsável da tarefa', pipeline: 'Todas', origin: 'MANUAL', active: true, lastRun: '2026-09-27T06:00:00Z', runs: 22 },
  { id: 'au9', name: 'Reenviar e-mails que falharam', category: 'E-mails', trigger: 'E-mail falhou', action: 'Enviar e-mail com um modelo', triggerId: 'email.falhou', actionId: 'email.enviar', detail: 'Mesmo modelo, uma nova tentativa', pipeline: 'Todas', origin: 'MANUAL', active: false, runs: 0 },
]);

export type RunEntry = { id: string; at: string; automation: string; event: string; result: 'OK' | 'FAILED'; note: string };

export const runLog: RunEntry[] = [
  { id: 'r1', at: '2026-09-27T08:02:00Z', automation: 'Boas-vindas ao lead inbound', event: 'lead.criado', result: 'OK', note: 'E-mail enviado para renata.moura@exemplo.com.br' },
  { id: 'r2', at: '2026-09-27T07:58:00Z', automation: 'Criar lead a partir do formulário da LP Consultoria', event: 'formulario.enviado', result: 'OK', note: 'Lead "Renata Moura" criado em Novos' },
  { id: 'r3', at: '2026-09-27T07:58:00Z', automation: 'Avisar o vendedor quando um lead entra', event: 'lead.criado', result: 'OK', note: 'Notificação entregue a Diego Costa' },
  { id: 'r4', at: '2026-09-27T06:00:00Z', automation: 'Cobrar tarefas atrasadas', event: 'tarefa.atrasada', result: 'OK', note: '2 tarefas em atraso, 2 avisos' },
  { id: 'r5', at: '2026-09-26T17:11:00Z', automation: 'Boas-vindas ao lead inbound', event: 'lead.criado', result: 'FAILED', note: 'Provedor recusou o endereço contato@estudiolumen.com.br' },
  { id: 'r6', at: '2026-09-26T09:00:00Z', automation: 'Alerta de oportunidade parada', event: 'oportunidade.parada', result: 'OK', note: '"Mentoria Individual" parada há 8 dias em Qualificação' },
  { id: 'r7', at: '2026-09-25T10:15:00Z', automation: 'Resumo por e-mail ao ganhar', event: 'oportunidade.ganha', result: 'OK', note: 'E-mail enviado (Treinamento de Equipe)' },
  { id: 'r8', at: '2026-09-25T10:12:00Z', automation: 'Tarefa "Informar CNPJ" ao entrar em Negociação', event: 'oportunidade.mudou_de_etapa', result: 'OK', note: 'Tarefa criada para Marina Alves' },
];
