import { createStore } from '../lib/store';
import type { Company, Person } from '../domain';

// Dados de exemplo (fase 2 do plano). Ver docs/dominio.md §5 a §7.
// Acme Corp, Agência Tzolkin, João Silva e Maria Oliveira são os mesmos das oportunidades reais.
// Documentos são fictícios. A empresa de uma pessoa vem dos stakeholders da empresa (D2).

const person = (p: Partial<Person> & Pick<Person, 'id' | 'name' | 'email' | 'phone' | 'lifecycle' | 'createdAt'>): Person => ({ extraEmails: [], extraPhones: [], tags: [], ...p });

export const peopleStore = createStore<Person[]>([
  person({ id: 'p1', name: 'João Silva', email: 'joao@acmecorp.com.br', phone: '(11) 3000-1000', extraEmails: [{ value: 'joao.silva@gmail.com', label: 'Pessoal' }], document: '111.444.777-35', role: 'Diretor comercial', tags: ['Decisor', 'Contato padrão'], lifecycle: 'PROSPECT', lgpdBasis: 'Legítimo interesse', lgpdAt: '2026-08-12T10:00:00Z', createdAt: '2026-08-12T10:00:00Z' }),
  person({ id: 'p2', name: 'Maria Oliveira', email: 'maria.oliveira@exemplo.com.br', phone: '(21) 99999-2020', document: '529.982.247-25', tags: ['Indicação'], lifecycle: 'PROSPECT', createdAt: '2026-08-20T14:30:00Z' }),
  person({ id: 'p3', name: 'Carol Sales', email: 'financeiro@agenciatzolkin.com', phone: '(11) 4000-2000', role: 'Sócia', tags: ['Decisor', 'Contato padrão'], lifecycle: 'CLIENT', firstWonAt: '2026-06-20T09:00:00Z', createdAt: '2026-06-02T09:00:00Z' }),
  person({ id: 'p4', name: 'Lucas Ferraz', email: 'lucas@agenciatzolkin.com', phone: '(11) 4000-2001', role: 'Sócio', tags: ['Técnico'], lifecycle: 'CLIENT', firstWonAt: '2026-06-20T09:00:00Z', createdAt: '2026-06-02T09:10:00Z' }),
  person({ id: 'p5', name: 'Fernanda Lopes', email: 'fernanda@lopesconsult.com.br', phone: '(31) 96666-5566', document: '390.533.447-05', role: 'Fundadora', tags: ['Decisor', 'Contato padrão'], lifecycle: 'LEAD', createdAt: '2026-09-24T14:12:00Z' }),
  person({ id: 'p6', name: 'Roberto Camargo', email: 'roberto@grupovertice.com.br', phone: '(11) 95555-0001', role: 'Compras', tags: ['Compras', 'Contato padrão'], lifecycle: 'PROSPECT', createdAt: '2026-09-23T09:00:00Z' }),
  person({ id: 'p7', name: 'Helena Prado', email: 'helena@grupovertice.com.br', phone: '(11) 95555-0002', role: 'Financeiro', tags: ['Financeiro'], lifecycle: 'PROSPECT', createdAt: '2026-09-23T09:05:00Z' }),
  person({ id: 'p8', name: 'Paulo Henrique Dias', email: 'paulo.dias@exemplo.com.br', phone: '(21) 97777-3344', document: '168.995.350-09', tags: ['Indicação'], lifecycle: 'LEAD', createdAt: '2026-09-26T10:30:00Z' }),
  person({ id: 'p9', name: 'Renata Moura', email: 'renata.moura@exemplo.com.br', phone: '(11) 98888-1122', tags: [], lifecycle: 'LEAD', createdAt: '2026-09-27T07:58:00Z' }),
  person({ id: 'p10', name: 'Beatriz Nogueira', email: 'bia@clinicabemviver.com.br', phone: '(41) 94444-7788', role: 'Administradora', tags: ['Decisor', 'Contato padrão'], lifecycle: 'LEAD', createdAt: '2026-09-21T11:15:00Z' }),
  person({ id: 'p11', name: 'Tatiane Freitas', email: 'tati.freitas@exemplo.com.br', phone: '(61) 93333-9900', document: '746.971.314-01', tags: ['Cliente atual'], lifecycle: 'CLIENT', firstWonAt: '2026-05-10T16:00:00Z', createdAt: '2026-05-10T16:00:00Z' }),
  person({ id: 'p12', name: 'Marcos Vinícius', email: 'marcos@institutoaurora.org.br', phone: '(51) 92222-1234', role: 'Coordenador', tags: ['Contato padrão'], lifecycle: 'LEAD', createdAt: '2026-09-25T13:40:00Z' }),
  person({ id: 'p13', name: 'Sofia Andrade', email: 'sofia@exemplo.com.br', phone: '(71) 91111-4321', document: '905.112.660-30', tags: [], lifecycle: 'CLIENT', legacyClient: true, firstWonAt: '2026-04-18T12:20:00Z', createdAt: '2026-04-18T12:20:00Z' }),
  person({ id: 'p14', name: 'Igor Tavares', email: 'igor@casadocodigo.dev', phone: '(48) 90000-5566', role: 'CEO', tags: ['Decisor', 'Contato padrão'], lifecycle: 'LEAD', createdAt: '2026-09-22T16:20:00Z' }),
]);

const company = (c: Partial<Company> & Pick<Company, 'id' | 'name' | 'segment' | 'lifecycle' | 'createdAt'>): Company => {
  const { stakeholders = [], ...rest } = c;
  return { status: rest.document ? 'ACTIVE' : 'REVIEW', stakeholders, ...rest };
};

export const companiesStore = createStore<Company[]>([
  company({ id: 'c1', name: 'Acme Corp', legalName: 'Acme Corporação Ltda', document: '11.222.333/0001-81', defaultContactId: 'p1', stakeholders: [{ personId: 'p1', description: 'Decide o orçamento da consultoria', tag: 'Decisor' }], lifecycle: 'PROSPECT', segment: 'Indústria', sizeRange: '51 a 200', website: 'https://acmecorp.com.br', city: 'São Paulo', state: 'SP', createdAt: '2026-08-12T10:00:00Z' }),
  company({ id: 'c2', name: 'Agência Tzolkin', document: '12.ABC.345/01DE-35', defaultContactId: 'p3', stakeholders: [{ personId: 'p3', description: 'Assina os contratos', tag: 'Decisor' }, { personId: 'p4', description: 'Cuida da parte técnica', tag: 'Técnico' }], lifecycle: 'CLIENT', segment: 'Tecnologia', firstWonAt: '2026-06-20T09:00:00Z', createdAt: '2026-06-02T09:00:00Z' }),
  company({ id: 'c3', name: 'Lopes Consultoria', defaultContactId: 'p5', stakeholders: [{ personId: 'p5', description: 'Fundadora e decisora', tag: 'Decisor' }], lifecycle: 'LEAD', segment: 'Consultoria', createdAt: '2026-09-24T14:12:00Z' }),
  company({ id: 'c4', name: 'Grupo Vértice', document: '45.678.901/0001-75', defaultContactId: 'p6', stakeholders: [{ personId: 'p6', description: 'Conduz a compra', tag: 'Compras' }, { personId: 'p7', description: 'Aprova o pagamento', tag: 'Financeiro' }], lifecycle: 'PROSPECT', segment: 'Varejo', createdAt: '2026-09-23T09:00:00Z' }),
  company({ id: 'c5', name: 'Clínica Bem Viver', defaultContactId: 'p10', stakeholders: [{ personId: 'p10', description: 'Administra a clínica', tag: 'Decisor' }], lifecycle: 'LEAD', segment: 'Saúde', createdAt: '2026-09-21T11:15:00Z' }),
  company({ id: 'c6', name: 'Instituto Aurora', document: '98.765.432/0001-98', defaultContactId: 'p12', stakeholders: [{ personId: 'p12', description: 'Coordena as parcerias', tag: 'Contato padrão' }], lifecycle: 'LEAD', segment: 'Terceiro setor', createdAt: '2026-09-25T13:40:00Z' }),
  company({ id: 'c7', name: 'Casa do Código Aberto', defaultContactId: 'p14', stakeholders: [{ personId: 'p14', description: 'CEO', tag: 'Decisor' }], lifecycle: 'LEAD', segment: 'Tecnologia', createdAt: '2026-09-22T16:20:00Z' }),
  company({ id: 'c8', name: 'Vitória Alimentos', document: '33.444.555/0001-81', lifecycle: 'CLIENT', legacyClient: true, segment: 'Alimentos', firstWonAt: '2026-03-05T08:00:00Z', createdAt: '2026-03-05T08:00:00Z' }),
]);

/** Tags de contato criadas pelo time, cada uma com a função que representa. */
export const contactTagsStore = createStore<string[]>(['Decisor', 'Financeiro', 'Técnico', 'Compras', 'Contato padrão', 'Stakeholder', 'Indicação', 'Cliente atual', 'Quente']);

/** Empresas em que a pessoa é stakeholder (D2: a relação mora na empresa). */
export const companiesOf = (companies: Company[], personId: string) => companies.filter((c) => c.stakeholders.some((s) => s.personId === personId));
