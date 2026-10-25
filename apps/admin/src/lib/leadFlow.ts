import type { Company, Lead, LeadOrigin, Person, Pipeline, Stage } from '../domain';
import type { Opportunity } from '../types';
import { leadsStore } from '../mocks/leads';
import { oppContactsStore, sampleOppsStore } from '../mocks/opportunities';
import { companiesStore, peopleStore } from '../mocks/people';
import { pipelinesStore } from '../mocks/pipelines';
import { tasksStore } from '../mocks/tasks';
import { isValidCnpj, isValidCpf, stripDoc } from './documents';
import { emit } from './events';
import type { EventContext } from './events';
import { gateBlockers } from './gate';
import type { Blocker } from './gate';
import { logChange } from './history';
import { newId } from './store';

// Ciclo de vida do lead: cadastrar (achando ou criando pessoa e empresa), mover, qualificar e descartar.
// Cada passo grava, registra no histórico e emite o evento padronizado.

const stageKindOf = (p: Pipeline | undefined, id: string) => p?.stages.find((s) => s.id === id)?.kind;

/** Etapa da pipeline que corresponde a uma etapa da API (INBOUND, QUALIFICATION, WON). */
export function pipelineStageFor(p: Pipeline | undefined, apiStage: string): Stage | undefined {
  if (!p) return undefined;
  if (apiStage === 'WON') return p.stages.find((s) => s.kind === 'WON');
  if (apiStage === 'QUALIFICATION') return p.stages.find((s) => s.name === 'Qualificação') ?? p.stages.find((s) => s.kind === 'OPEN');
  return p.stages.find((s) => s.kind === 'LEAD');
}

/* ---------- cadastrar ---------- */

export type NewLeadInput = {
  name: string;
  email: string;
  phone?: string;
  pipelineId: string;
  origin: LeadOrigin;
  sourceName: string;
  owner?: string;
  /** Responsável na equipe (id), com o login e o CRM ligados. */
  ownerId?: string;
  estimatedValue?: number;
  expectedCloseAt?: string;
  tags: string[];
  message?: string;
  /** Documento explícito (domínio §5): CPF, CNPJ ou nada. */
  docKind: 'NONE' | 'CPF' | 'CNPJ';
  document?: string;
  /** Nome da empresa, quando há CNPJ ou o contato diz que tem. */
  companyName?: string;
};

const sameEmail = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Acha a pessoa (e-mail ou CPF) e a empresa (CNPJ) ou cria o que faltar, sem duplicar. */
function resolveParties(input: NewLeadInput): { person: Person; company?: Company; notes: string[]; returning: boolean } {
  const notes: string[] = [];
  const now = new Date().toISOString();
  const people = peopleStore.get().filter((p) => !p.archivedAt);
  const cpf = input.docKind === 'CPF' && input.document && isValidCpf(input.document) ? input.document : undefined;

  let person = people.find((p) => [p.email, ...p.extraEmails.map((e) => e.value)].some((e) => sameEmail(e, input.email)) || (cpf && p.document && stripDoc(p.document) === stripDoc(cpf)));
  if (person) notes.push(`Vinculado à pessoa ${person.name}, que já estava cadastrada.`);
  else {
    person = { id: newId('p'), name: input.name, email: input.email, phone: input.phone ?? '', extraEmails: [], extraPhones: [], document: cpf, tags: [], lifecycle: 'LEAD', createdAt: now };
    const created = person;
    peopleStore.set((prev) => [created, ...prev]);
    logChange({ entity: 'person', entityId: created.id, entityName: created.name, kind: 'create', note: 'Criada pelo cadastro do lead' });
    emit('pessoa.criada', { entity: 'person', entityId: created.id, entityName: created.name, personId: created.id });
  }

  let company: Company | undefined;
  const wantsCompany = input.docKind === 'CNPJ' || Boolean(input.companyName?.trim());
  if (wantsCompany) {
    const cnpj = input.docKind === 'CNPJ' && input.document && isValidCnpj(input.document) ? input.document : undefined;
    company = cnpj ? companiesStore.get().find((c) => !c.archivedAt && c.document && stripDoc(c.document) === stripDoc(cnpj)) : undefined;
    if (company) notes.push(`Vinculado à empresa ${company.name} pelo CNPJ.`);
    else {
      const created: Company = {
        id: newId('c'), name: (input.companyName ?? '').trim() || input.name, document: cnpj, status: cnpj ? 'ACTIVE' : 'REVIEW', defaultContactId: person.id,
        stakeholders: [{ personId: person.id, description: 'Contato padrão', tag: 'Contato padrão' }], lifecycle: 'LEAD', segment: '—', createdAt: now,
      };
      company = created;
      companiesStore.set((prev) => [created, ...prev]);
      logChange({ entity: 'company', entityId: created.id, entityName: created.name, kind: 'create', note: 'Criada pelo cadastro do lead' });
      emit('empresa.criada', { entity: 'company', entityId: created.id, entityName: created.name, companyId: created.id, personId: person.id });
      notes.push(cnpj ? `Empresa ${created.name} criada e ${person.name} é o contato padrão.` : `Empresa ${created.name} criada em análise: falta o CNPJ. A tarefa "Informar CNPJ" ficou aberta.`);
    }
  }
  const returning = person.lifecycle === 'CLIENT' || company?.lifecycle === 'CLIENT';
  return { person, company, notes, returning };
}

export function createLead(input: NewLeadInput): { lead: Lead; notes: string[] } {
  const { person, company, notes, returning } = resolveParties(input);
  const pipe = pipelinesStore.get().find((p) => p.id === input.pipelineId);
  const stage = pipe?.stages.find((s) => s.kind === 'LEAD');
  const lead: Lead = {
    id: newId('l'), name: input.name, email: input.email, phone: input.phone, personId: person.id, companyId: company?.id,
    pipelineId: input.pipelineId, stageId: stage?.id ?? `${input.pipelineId}:novos`, origin: input.origin, sourceName: input.sourceName,
    owner: input.owner, ownerId: input.ownerId, estimatedValue: input.estimatedValue, expectedCloseAt: input.expectedCloseAt, tags: input.tags, message: input.message,
    status: 'ACTIVE', wasSeen: false, returningClient: returning || undefined, createdAt: new Date().toISOString(),
  };
  leadsStore.set((prev) => [lead, ...prev]);
  logChange({ entity: 'lead', entityId: lead.id, entityName: lead.name, kind: 'create', note: `${input.origin === 'INBOUND' ? 'Fonte' : 'Trouxe'}: ${input.sourceName}` });
  if (returning) notes.push('Cliente retornando: este lead recebeu a marca.');
  emit('lead.criado', leadCtx(lead));
  return { lead, notes };
}

export const leadCtx = (l: Lead): EventContext => ({ entity: 'lead', entityId: l.id, entityName: l.name, pipelineId: l.pipelineId, stageId: l.stageId, personId: l.personId, companyId: l.companyId, leadId: l.id });

/* ---------- mover, descartar, restaurar ---------- */

export type MoveResult = { ok: true } | { ok: false; blockers: Blocker[] };

/** Move o lead de etapa se nada travar a fronteira; senão devolve o que está travando (D10 §4). */
export function moveLeadStage(lead: Lead, stageId: string): MoveResult {
  const pipe = pipelinesStore.get().find((p) => p.id === lead.pipelineId);
  const to = pipe?.stages.find((s) => s.id === stageId);
  const from = pipe?.stages.find((s) => s.id === lead.stageId);
  if (!to || to.id === lead.stageId || to.kind !== 'LEAD') return { ok: true };

  if (pipe) {
    const entity = { kind: 'lead' as const, id: lead.id, name: lead.name };
    const blockers = gateBlockers(pipe, entity, lead.stageId, to.id);
    if (blockers.length > 0) return { ok: false, blockers };
  }

  // Ir para "Em contato" é o primeiro contato: registra a data e marca como visto
  const patch: Partial<Lead> = { stageId, wasSeen: true, firstContactAt: lead.firstContactAt ?? (from && to.name !== from.name ? new Date().toISOString() : undefined) };
  leadsStore.set((prev) => prev.map((l) => (l.id === lead.id ? { ...l, ...patch } : l)));
  logChange({ entity: 'lead', entityId: lead.id, entityName: lead.name, kind: 'edit', field: 'Etapa', from: from?.name, to: to.name });
  emit('oportunidade.mudou_de_etapa', { ...leadCtx(lead), stageId });
  return { ok: true };
}

export function discardLead(lead: Lead, reason: string) {
  leadsStore.set((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status: 'DISCARDED', discardReason: reason } : l)));
  logChange({ entity: 'lead', entityId: lead.id, entityName: lead.name, kind: 'discard', note: `Motivo: ${reason}` });
  emit('lead.descartado', leadCtx(lead));
}

export function restoreLead(lead: Lead) {
  leadsStore.set((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status: 'ACTIVE', discardReason: undefined } : l)));
  logChange({ entity: 'lead', entityId: lead.id, entityName: lead.name, kind: 'restore', note: 'Lead restaurado' });
}

/* ---------- qualificar ---------- */

/** O que falta para qualificar, segundo a pipeline (D5): valor e dono só se ela exigir. */
export function missingForQualify(lead: Lead): ('value' | 'owner')[] {
  const pipe = pipelinesStore.get().find((p) => p.id === lead.pipelineId);
  return (pipe?.qualifyRequires ?? []).filter((r) => (r === 'value' ? !lead.estimatedValue : !lead.owner && !lead.ownerId));
}

/** Qualificar cria a oportunidade na primeira etapa aberta e leva tarefas e histórico. */
export function qualifyLead(lead: Lead, extra: { value?: number; owner?: string } = {}): Opportunity {
  const pipe = pipelinesStore.get().find((p) => p.id === lead.pipelineId);
  const person = peopleStore.get().find((p) => p.id === lead.personId);
  const company = companiesStore.get().find((c) => c.id === lead.companyId);
  const value = extra.value ?? lead.estimatedValue ?? 0;
  const owner = extra.owner ?? lead.owner;
  const firstOpen = pipe?.stages.find((s) => s.kind === 'OPEN');

  const opp: Opportunity = {
    id: newId('opp'), title: lead.name, value, stage: firstOpen?.id ?? 'QUALIFICATION', priority: 'MEDIUM', tags: lead.tags, pipeline: pipe?.name,
    created_at: new Date().toISOString(), isSample: true, origin: lead.origin, leadId: lead.id,
    contactName: person?.name ?? lead.name, companyName: company?.name, ownerName: owner, customData: lead.customData,
  };
  sampleOppsStore.set((prev) => [opp, ...prev]);
  const defaultContact = company?.defaultContactId ?? person?.id;
  if (defaultContact) oppContactsStore.set((prev) => ({ ...prev, [opp.id]: { defaultPersonId: defaultContact, emailIds: [defaultContact], meetingIds: [defaultContact] } }));

  leadsStore.set((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status: 'QUALIFIED', convertedOpportunityId: opp.id, estimatedValue: value || l.estimatedValue, owner } : l)));

  const moved = tasksStore.get().filter((t) => t.entity === 'lead' && t.entityId === lead.id).length;
  tasksStore.set((prev) => prev.map((t) => (t.entity === 'lead' && t.entityId === lead.id ? { ...t, entity: 'opportunity', entityId: opp.id, entityName: opp.title } : t)));

  logChange({ entity: 'lead', entityId: lead.id, entityName: lead.name, kind: 'qualify', note: `Virou a oportunidade "${opp.title}" em ${pipe?.name ?? 'pipeline'}${firstOpen ? `, etapa ${firstOpen.name}` : ''}${moved ? `. ${moved} tarefa(s) foram junto.` : ''}` });
  logChange({ entity: 'opportunity', entityId: opp.id, entityName: opp.title, kind: 'create', note: `Nasceu do lead ${lead.name} (${lead.origin === 'INBOUND' ? 'inbound' : 'outbound'})` });

  emit('lead.qualificado', leadCtx(lead));
  emit('oportunidade.criada', { entity: 'opportunity', entityId: opp.id, entityName: opp.title, pipelineId: lead.pipelineId, stageId: firstOpen?.id, personId: lead.personId, companyId: lead.companyId, leadId: lead.id });
  return opp;
}

/** O lead está numa etapa do tipo Lead? (a API só conhece as etapas antigas) */
export const isLeadStage = (p: Pipeline | undefined, stageId: string) => stageKindOf(p, stageId) === 'LEAD';

