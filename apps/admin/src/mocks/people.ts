import { createStore } from '../lib/store';
import type { Company, Person } from '../domain';

// Dados de exemplo (fase 2 do plano). Ver docs/dominio.md §5 a §7.
// Acme Corp, Agência Tzolkin, João Silva e Maria Oliveira são os mesmos das oportunidades reais.
// Documentos são fictícios.

export const peopleStore = createStore<Person[]>([
  { id: 'p1', name: 'João Silva', email: 'joao@acmecorp.com.br', phone: '(11) 3000-1000', document: '111.444.777-35', companyId: 'c1', role: 'Diretor comercial', tags: ['Decisor', 'Contato padrão'], lifecycle: 'PROSPECT', createdAt: '2026-08-12T10:00:00Z' },
  { id: 'p2', name: 'Maria Oliveira', email: 'maria.oliveira@exemplo.com.br', phone: '(21) 99999-2020', document: '529.982.247-25', tags: ['B2C', 'Indicação'], lifecycle: 'PROSPECT', createdAt: '2026-08-20T14:30:00Z' },
  { id: 'p3', name: 'Carol Sales', email: 'financeiro@agenciatzolkin.com', phone: '(11) 4000-2000', companyId: 'c2', role: 'Sócia', tags: ['Decisor', 'Contato padrão'], lifecycle: 'CLIENT', createdAt: '2026-06-02T09:00:00Z' },
  { id: 'p4', name: 'Lucas Ferraz', email: 'lucas@agenciatzolkin.com', phone: '(11) 4000-2001', companyId: 'c2', role: 'Sócio', tags: ['Técnico'], lifecycle: 'CLIENT', createdAt: '2026-06-02T09:10:00Z' },
  { id: 'p5', name: 'Fernanda Lopes', email: 'fernanda@lopesconsult.com.br', phone: '(31) 96666-5566', document: '390.533.447-05', companyId: 'c3', role: 'Fundadora', tags: ['Decisor', 'Contato padrão'], lifecycle: 'LEAD', createdAt: '2026-09-24T14:12:00Z' },
  { id: 'p6', name: 'Roberto Camargo', email: 'roberto@grupovertice.com.br', phone: '(11) 95555-0001', companyId: 'c4', role: 'Compras', tags: ['Contato padrão'], lifecycle: 'PROSPECT', createdAt: '2026-09-23T09:00:00Z' },
  { id: 'p7', name: 'Helena Prado', email: 'helena@grupovertice.com.br', phone: '(11) 95555-0002', companyId: 'c4', role: 'Financeiro', tags: ['Financeiro'], lifecycle: 'PROSPECT', createdAt: '2026-09-23T09:05:00Z' },
  { id: 'p8', name: 'Paulo Henrique Dias', email: 'paulo.dias@exemplo.com.br', phone: '(21) 97777-3344', document: '168.995.350-09', tags: ['Indicação'], lifecycle: 'LEAD', createdAt: '2026-09-26T10:30:00Z' },
  { id: 'p9', name: 'Renata Moura', email: 'renata.moura@exemplo.com.br', phone: '(11) 98888-1122', tags: ['Quente'], lifecycle: 'LEAD', createdAt: '2026-09-27T07:58:00Z' },
  { id: 'p10', name: 'Beatriz Nogueira', email: 'bia@clinicabemviver.com.br', phone: '(41) 94444-7788', companyId: 'c5', role: 'Administradora', tags: ['Decisor', 'Contato padrão'], lifecycle: 'LEAD', createdAt: '2026-09-21T11:15:00Z' },
  { id: 'p11', name: 'Tatiane Freitas', email: 'tati.freitas@exemplo.com.br', phone: '(61) 93333-9900', document: '746.971.314-01', tags: ['Cliente atual'], lifecycle: 'CLIENT', createdAt: '2026-05-10T16:00:00Z' },
  { id: 'p12', name: 'Marcos Vinícius', email: 'marcos@institutoaurora.org.br', phone: '(51) 92222-1234', companyId: 'c6', role: 'Coordenador', tags: ['Contato padrão'], lifecycle: 'LEAD', createdAt: '2026-09-25T13:40:00Z' },
  { id: 'p13', name: 'Sofia Andrade', email: 'sofia@exemplo.com.br', phone: '(71) 91111-4321', document: '905.112.660-79', tags: ['B2C'], lifecycle: 'CLIENT', createdAt: '2026-04-18T12:20:00Z' },
  { id: 'p14', name: 'Igor Tavares', email: 'igor@casadocodigo.dev', phone: '(48) 90000-5566', companyId: 'c7', role: 'CEO', tags: ['Decisor', 'Contato padrão'], lifecycle: 'LEAD', createdAt: '2026-09-22T16:20:00Z' },
]);

export const companiesStore = createStore<Company[]>([
  { id: 'c1', name: 'Acme Corp', document: '11.222.333/0001-81', status: 'ACTIVE', defaultContactId: 'p1', stakeholders: [{ personId: 'p1', description: 'Decide o orçamento da consultoria', tag: 'Decisor' }], lifecycle: 'PROSPECT', segment: 'Indústria', createdAt: '2026-08-12T10:00:00Z' },
  { id: 'c2', name: 'Agência Tzolkin', document: '12.ABC.345/01DE-35', status: 'ACTIVE', defaultContactId: 'p3', stakeholders: [{ personId: 'p3', description: 'Assina os contratos', tag: 'Decisor' }, { personId: 'p4', description: 'Cuida da parte técnica', tag: 'Técnico' }], lifecycle: 'CLIENT', segment: 'Tecnologia', createdAt: '2026-06-02T09:00:00Z' },
  { id: 'c3', name: 'Lopes Consultoria', status: 'REVIEW', defaultContactId: 'p5', stakeholders: [{ personId: 'p5', description: 'Fundadora e decisora', tag: 'Decisor' }], lifecycle: 'LEAD', segment: 'Consultoria', createdAt: '2026-09-24T14:12:00Z' },
  { id: 'c4', name: 'Grupo Vértice', document: '45.678.901/0001-23', status: 'ACTIVE', defaultContactId: 'p6', stakeholders: [{ personId: 'p6', description: 'Conduz a compra', tag: 'Compras' }, { personId: 'p7', description: 'Aprova o pagamento', tag: 'Financeiro' }], lifecycle: 'PROSPECT', segment: 'Varejo', createdAt: '2026-09-23T09:00:00Z' },
  { id: 'c5', name: 'Clínica Bem Viver', status: 'REVIEW', defaultContactId: 'p10', stakeholders: [{ personId: 'p10', description: 'Administra a clínica', tag: 'Decisor' }], lifecycle: 'LEAD', segment: 'Saúde', createdAt: '2026-09-21T11:15:00Z' },
  { id: 'c6', name: 'Instituto Aurora', document: '98.765.432/0001-10', status: 'ACTIVE', defaultContactId: 'p12', stakeholders: [{ personId: 'p12', description: 'Coordena as parcerias', tag: 'Contato padrão' }], lifecycle: 'LEAD', segment: 'Terceiro setor', createdAt: '2026-09-25T13:40:00Z' },
  { id: 'c7', name: 'Casa do Código Aberto', status: 'REVIEW', defaultContactId: 'p14', stakeholders: [{ personId: 'p14', description: 'CEO', tag: 'Decisor' }], lifecycle: 'LEAD', segment: 'Tecnologia', createdAt: '2026-09-22T16:20:00Z' },
  { id: 'c8', name: 'Vitória Alimentos', document: '33.444.555/0001-66', status: 'ACTIVE', stakeholders: [], lifecycle: 'CLIENT', segment: 'Alimentos', createdAt: '2026-03-05T08:00:00Z' },
]);

/** Tags de contato criadas pelo time, cada uma com a função que representa. */
export const contactTagsStore = createStore<string[]>(['Decisor', 'Financeiro', 'Técnico', 'Compras', 'Contato padrão', 'Stakeholder']);
