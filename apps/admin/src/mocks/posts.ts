import { createStore } from '../lib/store';
import type { Post } from '../domain';

// Dados de exemplo do CMS do blog. Ver docs/pagesClient/blog.md (o site publica com ISR).

export const postsStore = createStore<Post[]>([
  {
    id: 'post1', title: 'Como estruturar um funil de vendas B2B', slug: 'como-estruturar-um-funil-de-vendas-b2b',
    excerpt: 'Do primeiro contato à assinatura: as etapas que um funil B2B precisa ter e o que exigir em cada uma.',
    body: '<h2>Comece pela oferta</h2><p>Todo funil é desenhado para <strong>uma oferta</strong>. Misturar ofertas na mesma pipeline esconde o que funciona.</p><h2>Defina o que bloqueia cada etapa</h2><p>Antes de uma oportunidade chegar à assinatura, a empresa precisa ter CNPJ. Transforme isso em requisito, não em lembrete.</p><ul><li>Leads entram por fontes conhecidas</li><li>Cada etapa tem responsáveis e prazo</li><li>Ganho e perdido têm motivo</li></ul>',
    tags: ['Vendas', 'CRM'], status: 'PUBLISHED', author: 'Carol Sales', updatedAt: '2026-09-20T14:00:00Z', seoTitle: 'Funil de vendas B2B: etapas e requisitos', seoDescription: 'Aprenda a estruturar um funil de vendas B2B com etapas, requisitos e responsáveis claros.',
  },
  {
    id: 'post2', title: 'CRM não é planilha: 5 sinais de que é hora de trocar', slug: 'crm-nao-e-planilha',
    excerpt: 'Quando a planilha vira gargalo e o que um CRM resolve de verdade.',
    body: '<p>A planilha aguenta até a segunda pessoa editar ao mesmo tempo.</p><blockquote>O problema nunca é a ferramenta: é o histórico que ninguém consegue reconstruir.</blockquote><p>Veja os cinco sinais.</p>',
    tags: ['CRM'], status: 'PUBLISHED', author: 'Marina Alves', updatedAt: '2026-09-12T10:30:00Z', seoTitle: 'CRM ou planilha? 5 sinais de que é hora de trocar', seoDescription: 'Cinco sinais de que a planilha não dá mais conta do seu comercial.',
  },
  {
    id: 'post3', title: 'Checklist de qualificação de leads', slug: 'checklist-de-qualificacao-de-leads',
    excerpt: 'As perguntas que separam curiosos de oportunidades reais.',
    body: '<h2>Perguntas essenciais</h2><ol><li>Quem decide?</li><li>Qual o prazo?</li><li>Existe orçamento?</li></ol>',
    tags: ['Leads'], status: 'DRAFT', author: 'Carol Sales', updatedAt: '2026-09-26T16:45:00Z',
  },
  {
    id: 'post4', title: 'Inbound vs. outbound: quando usar cada um', slug: 'inbound-vs-outbound',
    excerpt: 'Duas origens de lead, duas rotinas de trabalho.',
    body: '<p>Inbound chega por uma fonte; outbound sai de alguém da equipe. Registrar a origem certa muda o que você mede.</p>',
    tags: ['Leads', 'Vendas'], status: 'SCHEDULED', author: 'Marina Alves', updatedAt: '2026-09-25T09:00:00Z', publishAt: '2026-10-05T12:00:00Z', seoDescription: 'Diferenças práticas entre inbound e outbound.',
  },
]);
