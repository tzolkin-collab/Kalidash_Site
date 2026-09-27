import { createStore } from '../lib/store';
import type { CustomField } from '../domain';

// Campos personalizados de lead, pessoa e empresa (a oportunidade tem os seus por pipeline).
// Os valores ficam em `customData` (jsonb) de cada registro.

export type CustomEntity = 'lead' | 'person' | 'company';

export const customFieldDefsStore = createStore<Record<CustomEntity, CustomField[]>>({
  lead: [{ id: 'lf1', key: 'campanha', label: 'Campanha', type: 'text' }],
  person: [
    { id: 'pf1', key: 'data_de_nascimento', label: 'Data de nascimento', type: 'date' },
    { id: 'pf2', key: 'canal_preferido', label: 'Canal preferido', type: 'select', options: ['E-mail', 'WhatsApp', 'Telefone'] },
  ],
  company: [{ id: 'cf-c1', key: 'numero_de_funcionarios', label: 'Número de funcionários', type: 'number' }],
});
