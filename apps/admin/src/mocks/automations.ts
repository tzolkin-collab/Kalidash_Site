import { createStore } from '../lib/store';
import type { Automation, AutomationCategory } from '../domain';

// Catálogo (eventos e ações) e automações de EXEMPLO. Nada daqui roda no servidor: o que executa, executa só no
// navegador aberto (events.ts). As contagens de execução e os logs inventados foram removidos (D34, B-16).

export const CATEGORIES: AutomationCategory[] = ['Fontes', 'Cadastros', 'Leads', 'Oportunidades', 'Pendências', 'Ciclo de vida', 'Notificações', 'E-mails'];

export type CatalogItem = { id: string; label: string; category: AutomationCategory; detail: string };

/** Eventos que a plataforma emite: os gatilhos possíveis. */
export const EVENTS: CatalogItem[] = [
  { id: 'formulario.enviado', label: 'Formulário enviado', category: 'Fontes', detail: 'Um formulário conectado recebeu um envio.' },
  { id: 'fonte.conectada', label: 'Fonte conectada a uma pipeline', category: 'Fontes', detail: 'Uma fonte passou a alimentar uma pipeline.' },
  { id: 'pessoa.criada', label: 'Pessoa criada', category: 'Cadastros', detail: 'Uma pessoa foi cadastrada, à mão, por importação ou por uma fonte.' },
  { id: 'empresa.criada', label: 'Empresa criada', category: 'Cadastros', detail: 'Uma empresa foi cadastrada. Sem CNPJ, ela fica em análise.' },
  { id: 'campo.mudou', label: 'Campo mudou', category: 'Cadastros', detail: 'O valor de um campo de pessoa, empresa, lead ou oportunidade mudou (inclui preencher um campo vazio).' },
  { id: 'lead.criado', label: 'Lead criado', category: 'Leads', detail: 'Um lead entrou por fonte, cadastro manual ou importação.' },
  { id: 'lead.qualificado', label: 'Lead qualificado', category: 'Leads', detail: 'Um lead virou oportunidade.' },
  { id: 'lead.descartado', label: 'Lead descartado', category: 'Leads', detail: 'Um lead foi marcado como descartado.' },
  { id: 'lead.sem_contato', label: 'Lead sem contato', category: 'Leads', detail: 'Passou dos dias combinados sem o primeiro contato.' },
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
  { id: 'tarefa.criar', label: 'Criar tarefa', category: 'Pendências', detail: 'Abre uma pendência com tag, responsável e prazo. Formato: Título|Tag. O atraso vira o prazo da tarefa.' },
  { id: 'tarefa.concluir', label: 'Concluir tarefa', category: 'Pendências', detail: 'Conclui a pendência aberta com este título no registro.' },
  { id: 'ciclo.definir', label: 'Definir ciclo de vida', category: 'Ciclo de vida', detail: 'LEAD, PROSPECT (em negociação), CLIENT ou INACTIVE. Só avança sozinho.' },
  { id: 'notificar.equipe', label: 'Notificar alguém da equipe', category: 'Notificações', detail: 'Aviso dentro do admin.' },
  { id: 'webhook.chamar', label: 'Chamar webhook', category: 'Notificações', detail: 'POST em segundo plano, com nova tentativa progressiva.' },
  { id: 'email.enviar', label: 'Enviar e-mail com um modelo', category: 'E-mails', detail: 'Usa um modelo da página E-mails.' },
];

export const eventLabel = (id: string) => EVENTS.find((e) => e.id === id)?.label ?? id;
export const actionLabel = (id: string) => ACTIONS.find((a) => a.id === id)?.label ?? id;

export type AutomationRow = Automation & { triggerId: string; actionId: string; detail: string; pipeline: string };

export const automationsStore = createStore<AutomationRow[]>([
  { id: 'au1', name: 'Criar lead a partir do formulário da LP Consultoria', category: 'Fontes', trigger: 'Formulário enviado', action: 'Criar lead', triggerId: 'formulario.enviado', actionId: 'lead.criar', detail: 'Pipeline Q4 Sales Pipeline, etapa Novos', pipeline: 'Q4 Sales Pipeline', origin: 'MANAGED', managedBy: 'Conectar fonte: Formulário da LP Consultoria', active: true, runs: 0 },
  { id: 'au2', name: 'Importar contatos da planilha de parcerias', category: 'Fontes', trigger: 'Formulário enviado', action: 'Criar contato (pessoa)', triggerId: 'formulario.enviado', actionId: 'contato.criar', detail: 'Pipeline Parcerias B2B, etapa Novos', pipeline: 'Parcerias B2B', origin: 'MANAGED', managedBy: 'Conectar fonte: Importação de planilha', active: true, runs: 0 },
  { id: 'au3', name: 'Tarefa "Informar CNPJ" ao entrar em Negociação', category: 'Pendências', trigger: 'Oportunidade mudou de etapa', action: 'Criar tarefa', triggerId: 'oportunidade.mudou_de_etapa', actionId: 'tarefa.criar', detail: 'Tag Dados da empresa, prazo de 3 dias', pipeline: 'Q4 Sales Pipeline', origin: 'MANAGED', managedBy: 'Marcar como tarefa: CNPJ da empresa', active: true, runs: 0 },
  { id: 'au6', name: 'Resumo por e-mail ao ganhar', category: 'Oportunidades', trigger: 'Oportunidade ganha', action: 'Enviar e-mail com um modelo', triggerId: 'oportunidade.ganha', actionId: 'email.enviar', detail: 'Modelo: Follow-up Reunião', pipeline: 'Todas', origin: 'MANUAL', active: true, runs: 0 },
  { id: 'au8', name: 'Cobrar tarefas atrasadas', category: 'Pendências', trigger: 'Tarefa atrasada', action: 'Notificar alguém da equipe', triggerId: 'tarefa.atrasada', actionId: 'notificar.equipe', detail: 'Responsável da tarefa', pipeline: 'Todas', origin: 'MANUAL', active: true, runs: 0 },
  { id: 'au9', name: 'Reenviar e-mails que falharam', category: 'E-mails', trigger: 'E-mail falhou', action: 'Enviar e-mail com um modelo', triggerId: 'email.falhou', actionId: 'email.enviar', detail: 'Mesmo modelo, uma nova tentativa', pipeline: 'Todas', origin: 'MANUAL', active: false, runs: 0 },
]);

export type RunEntry = { id: string; at: string; automation: string; event: string; result: 'OK' | 'FAILED' | 'SCHEDULED'; note: string };

/** Execuções registradas por events.ts nesta aba do navegador. Começa vazia: nada aqui é histórico real do servidor. */
export const runsStore = createStore<RunEntry[]>([]);
