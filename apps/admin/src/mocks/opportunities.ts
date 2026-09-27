import { createStore } from '../lib/store';
import type { Note, Opportunity } from '../types';

// Oportunidades criadas no protótipo (ao qualificar um lead ou no formulário de nova oportunidade).
// A API de verdade continua intocada: estas vivem só em memória e aparecem junto das reais.

export const sampleOppsStore = createStore<Opportunity[]>([]);

/** Notas das oportunidades de exemplo (as reais vêm da API). */
export const sampleNotesStore = createStore<Record<string, Note[]>>({});

/** Contatos da oportunidade: o padrão vem dos stakeholders da empresa e dá para trocar (D2). */
export type OppContacts = {
  defaultPersonId?: string;
  /** Quem recebe os e-mails. */
  emailIds: string[];
  /** Quem participa das reuniões. */
  meetingIds: string[];
};

/** Vale para qualquer oportunidade, real ou de exemplo, pelo id. */
export const oppContactsStore = createStore<Record<string, OppContacts>>({});
