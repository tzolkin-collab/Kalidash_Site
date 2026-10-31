/* Páginas internas do site — copy do documento "Copy site completo" (Google Docs, aprovado pela Kalidash).
 * Cada página é uma lista de blocos; o visual de cada tipo está em SitePage.tsx e institucional.module.css.
 * Trechos entre **asteriscos duplos** saem em negrito. Todo CTA leva ao diagnóstico (regra "uma conversão só"). */

export type Cta = { label: string; href: string };

export type Block =
  | { type: "hero"; eyebrow: string; title: string[]; lead: string[]; tagline?: string; meta?: string; cta: Cta }
  | { type: "text"; eyebrow?: string; title: string[]; paragraphs?: string[]; chips?: string[]; highlight?: string[] }
  | {
      type: "cards";
      eyebrow?: string;
      title: string[];
      intro?: string[];
      items: Array<{ title: string; text: string; example?: string; href?: string; cta?: string }>;
      columns?: 2 | 3;
      animated?: boolean;
      closing?: string[];
      cta?: Cta;
    }
  | { type: "steps"; eyebrow?: string; title: string[]; items: Array<{ title: string; text: string }>; closing?: string[]; cta?: Cta }
  | { type: "list"; eyebrow?: string; title: string[]; items: string[]; note?: string; noteLink?: Cta }
  | {
      type: "offers";
      items: Array<{
        id?: string;
        eyebrow: string;
        title: string;
        text: string;
        features?: Array<{ title: string; text: string }>;
        note?: string;
        cta: Cta;
      }>;
    }
  | {
      type: "proof";
      eyebrow?: string;
      credentials?: Array<{ strong?: string; text: string }>;
      items: Array<{ label: string; names: string }>;
      links?: Cta[];
      closing?: string[];
    }
  | { type: "cta"; eyebrow?: string; title: string; text: string; cta: Cta; microcopy?: string }
  | {
      type: "heroMedia";
      eyebrow: string;
      title: string[];
      lead: string[];
      support?: string;
      cta?: Cta;
      image: Media;
      aspect?: "portrait" | "landscape";
      frame?: "card" | "none";
    }
  | {
      type: "timeline";
      eyebrow: string;
      photos?: Array<Media & { caption: string; grid?: Media[] }>;
      mosaic?: { caption?: string; items: Media[] };
      items: Array<{
        marker?: string;
        title: string;
        lead: string;
        paragraphs: string[];
        quote?: string;
        highlight?: string;
      }>;
    }
  | {
      type: "beliefs";
      eyebrow: string;
      title: string[];
      intro: string[];
      items: Array<{ belief: string; text: string }>;
    }
  | {
      type: "team";
      eyebrow: string;
      title: string[];
      text: string;
      image: Media;
      founders: Array<{ name: string; role: string; linkedin: string }>;
    }
  | { type: "proofBar"; metrics: ProofMetric[]; logos?: ProofLogos }
  | { type: "faq"; title: string; items: Array<{ q: string; a: string }> }
  | {
      type: "showcase";
      eyebrow: string;
      title: string[];
      metrics: ProofMetric[];
      featured: {
        eyebrow: string;
        title: string;
        text: string;
        /* Números do case: só vão ao ar com `confirmed: true` (a Carol ainda precisa validar). */
        stats?: { text: string; confirmed: boolean };
        badge: string;
        cta: Cta;
        /* A página /cases/cba ainda não existe: o CTA só aparece com `pageReady: true`. */
        pageReady: boolean;
        image?: Media;
      };
      items: Array<{ title: string; text: string; href?: string }>;
    }
  | { type: "formats"; eyebrow: string; title: string[]; background: Media; items: FormatCard[] }
  | { type: "testimonials"; eyebrow: string; title: string[]; items: Testimonial[] };

export type Media = { src: string; alt: string; width: number; height: number };

/* `confirmed: false` = o dado ainda não tem fonte/autorização da Carol; o renderizador NÃO publica o item. */
export type ProofMetric = { value: string; label: string; confirmed: boolean };
/* Logos vêm de public/logos/<slug>.(svg|png|webp). A faixa só aparece com `confirmed: true` E os arquivos de todos os itens presentes. */
export type ProofLogos = { caption: string; confirmed: boolean; items: Array<{ name: string; slug: string }> };

export type FormatCard = {
  title: string;
  audience: string;
  text: string;
  features?: Array<{ title: string; text: string }>;
  extra?: string;
  support: string;
  cta: Cta;
  ctaStyle: "primary" | "secondary";
};

/* Depoimento em vídeo. Em produção só vai ao ar o item `status: "approved"` com `embedUrl` (YouTube-nocookie, Vimeo ou
 * MP4 em host de ALLOWED_MEDIA_HOSTS), `cargo` e `empresa` preenchidos. Nenhum vídeo entra no repositório;
 * o player só carrega no clique. */
export type Testimonial = {
  nome: string;
  cargo: string;
  empresa: string;
  embedUrl: string;
  posterUrl: string;
  status: "pending" | "approved";
};

export type PageContent = {
  slug: string;
  meta: { title: string; description: string };
  blocks: Block[];
};

const diagnostico = "/diagnostico";

export const sobreNos: PageContent = {
  slug: "sobre-nos",
  meta: {
    title: "Sobre a Kalidash | Consultoria e Treinamento em IA",
    description:
      "Da operação manual às empresas digitais: 15 anos de trajetória que hoje levam cultura de IA e eficiência para operações como ArcelorMittal, CBA, Sicoob e Cooxupé.",
  },
  blocks: [
    {
      type: "heroMedia",
      eyebrow: "Sobre nós",
      title: ["Já estivemos do seu lado da mesa."],
      lead: [
        "Antes de fundar a Kalidash, passamos 10 anos dentro de operações grandes, manuais e de margem apertada. Sabemos o que é ter que entregar resultado com o time e as ferramentas que se tem.",
      ],
      image: {
        src: "/founders-studio.jpg",
        alt: "César Germano e Iago Braz, fundadores da Kalidash",
        width: 1600,
        height: 1067,
      },
      aspect: "landscape",
    },
    {
      type: "timeline",
      eyebrow: "Nossa história",
      mosaic: {
        caption: "Do chão de operação à formação executiva",
        items: [
          {
            src: "/sobre-nos/ato-01-operacao.jpg",
            alt: "César Germano no chão de operação usando equipamento de proteção",
            width: 893,
            height: 1600,
          },
          {
            src: "/sobre-nos/ato-04-ensino.jpg",
            alt: "Formação de executivos e líderes em sala de aula",
            width: 830,
            height: 554,
          },
          {
            src: "/home/evento-palestra.jpg",
            alt: "Palestra executiva para lideranças",
            width: 1200,
            height: 800,
          },
          {
            src: "/home/g17-fdc-tech-week-1.jpg",
            alt: "Aula executiva na Fundação Dom Cabral",
            width: 1000,
            height: 750,
          },
          {
            src: "/home/evento-sala.jpg",
            alt: "Treinamento corporativo com foco em aplicação de IA",
            width: 1200,
            height: 800,
          },
          {
            src: "/home/cooxupe.jpg",
            alt: "Equipe Kalidash na Cooxupé",
            width: 1200,
            height: 800,
          },
          {
            src: "/home/g21-cba-premio.jpg",
            alt: "CBA e Kalidash no Prêmio Inovativos",
            width: 1000,
            height: 750,
          },
        ],
      },
      
      items: [
        {

          title: "O chão da operação",
          lead: "Começamos como estagiários e técnicos na economia real: operações grandes, complexas e manuais.",
          paragraphs: [
            "Grandes empresas da economia real não são construídas em PowerPoint. São construídas por pessoas, processos complexos e decisões que precisam funcionar todos os dias.",
            "Foi ali que aprendemos que a transformação real não acontece em relatório de consultoria, acontece com quem opera o negócio.",
          ],
        },
        {

          title: "A Kalidash",
          lead: "Fundamos a Kalidash para levar inteligência e tecnologia ao trabalho real da economia real.",
          paragraphs: [
            "Conhecemos a dor de tentar implementar tecnologia onde ela mais atrapalha do que ajuda. A única mudança que funciona é a que o time de fato abraça e faz rodar.",
            "**Não para substituir pessoas, mas para devolver a elas o tempo de pensar e produzir.**",
          ],
        },
        {

          title: "Hoje",
          lead: "Levamos cultura de IA e eficiência para operações como ArcelorMittal, CBA, Sicoob, Cooxupé e outras.",
          paragraphs: [
            "E ensinamos o que aplicamos nas maiores escolas de negócios e tecnologia do país.",
          ],
          highlight: "Nós ensinamos o que vivemos. E vivemos o que ensinamos.",
        },
      ],
    },
    {
      type: "beliefs",
      eyebrow: "No que acreditamos",
      title: ["A inteligência artificial está a serviço da inteligência humana."],
      intro: [
        'O mercado vende IA pelo medo ("você vai ser substituído") ou pela mágica ("um clique resolve tudo"). Nós não acreditamos em nenhum dos dois.',
      ],
      items: [
        {
          belief: "Tecnologia é meio. Eficiência é fim.",
          text: "Ferramenta nova só importa se mudar o resultado.",
        },
        {
          belief: "Mudança boa desenvolve pessoas.",
          text: "A transformação certa amplia quem já conhece o negócio, em vez de descartá-lo.",
        },
        {
          belief: "Educar faz parte da entrega.",
          text: "O projeto termina. O que o time aprendeu fica.",
        },
      ],
    },
    {
      type: "team",
      eyebrow: "Quem somos",
      title: ["A história começou com dois. Hoje é de um time inteiro."],
      text: "+15 pessoas que vêm da operação, da tecnologia e da sala de aula, e levam para cada cliente um jeito de trabalhar mais inteligente e eficiente.",
      image: {
        src: "/time-kalidash.jpg",
        alt: "Time da Kalidash reunido no escritório",
        width: 2752,
        height: 1536,
      },
      founders: [
        {
          name: "César Germano",
          role: "CEO",
          linkedin: "https://www.linkedin.com/in/cesargermano/",
        },
        {
          name: "Iago Braz",
          role: "COO",
          linkedin: "https://www.linkedin.com/in/iagobraz/",
        },
      ],
    },
    {
      type: "proof",
      credentials: [
        { strong: "+10 mil", text: "pessoas capacitadas" },
        { strong: "170", text: "operações atendidas" },
        { strong: "Parceira", text: "Anthropic" },
        { strong: "Finalista", text: "Prêmio Inovativos 2026" },
      ],
      items: [
        { label: "Onde aplicamos", names: "ArcelorMittal · CBA · Sicoob · Cooxupé" },
        { label: "Onde ensinamos", names: "Conquer · Xperiun · Rocketseat · Hashtag · Tera" },
      ],
      links: [
        { label: "AI Culture", href: "/treinamento-corporativo-ia" },
        { label: "Advisory", href: "/advisory" },
        { label: "Execução", href: "/execucao" },
      ],
    },
  ],
};

export const aiCulture: PageContent = {
  slug: "treinamento-corporativo-ia",
  meta: {
    title: "AI Culture — treinamento corporativo em IA",
    description:
      "Treinamentos corporativos de IA construídos a partir da realidade da sua empresa: repertório, aplicação prática e autonomia, com trilhas por área e governança.",
  },
  blocks: [
    {
      type: "heroMedia",
      eyebrow: "AI Culture · Treinamento corporativo em IA",
      title: ["Não basta aprender IA. Seu time precisa saber o que fazer com ela."],
      lead: [
        "Treinamento in company construído sobre a rotina, os processos e os casos reais da sua empresa. Trilhas por área e governança desde o primeiro dia.",
      ],
      support: "Turmas a partir de 12 pessoas · Online ou presencial · Carga horária personalizada",
      cta: { label: "Solicitar proposta", href: diagnostico },
      image: { src: "/home/evento-sala.jpg", alt: "Turma em sala durante um treinamento da Kalidash", width: 633, height: 814 },
    },
    {
      type: "proofBar",
      metrics: [
        { value: "+10 mil", label: "pessoas capacitadas", confirmed: true },
        { value: "170", label: "operações atendidas", confirmed: true },
        // NPS 97: falta a fonte (pergunta 1 do brief). Ligar `confirmed` só quando a Carol responder.
        { value: "97", label: "média de NPS", confirmed: false },
      ],
      // Logos: a Carol deu o ok de uso (22/10). Faltam os ARQUIVOS cba, sicoob e cooxupe em public/logos/
      // (hoje só existe arcelormittal.svg). Quando os quatro existirem, basta trocar `confirmed` para true.
      logos: {
        caption: "Times treinados em",
        confirmed: false,
        items: [
          { name: "ArcelorMittal", slug: "arcelormittal" },
          { name: "CBA", slug: "cba" },
          { name: "Sicoob", slug: "sicoob" },
          { name: "Cooxupé", slug: "cooxupe" },
        ],
      },
    },
    {
      type: "text",
      eyebrow: "Por que capacitar?",
      title: ["Ter acesso à IA não é saber trabalhar com ela."],
      paragraphs: [
        "Muitas empresas já liberaram ChatGPT, Copilot ou Gemini para o time e a rotina continua igual. O gargalo não é a ferramenta, é saber onde aplicar, testar no próprio trabalho e transformar isso em hábito.",
      ],
      highlight: ["Nosso objetivo é criar capacidade dentro da empresa, não ensinar mais uma ferramenta."],
    },
    {
      type: "steps",
      eyebrow: "Nossa metodologia",
      title: ["Começamos pelo trabalho, não pela ferramenta."],
      items: [
        { title: "Contexto", text: "Mapeamos áreas, processos e desafios do time antes de montar o conteúdo." },
        { title: "Capacitação", text: "O time aprende a usar IA com segurança, com exemplos do próprio setor." },
        { title: "Aplicação", text: "Cada pessoa aplica IA em tarefas reais da rotina, durante o treinamento." },
        { title: "Cultura", text: "O time sai com autonomia para encontrar novas melhorias sozinho." },
      ],
      closing: [
        "**O treinamento termina. A capacidade fica.**",
        "O próprio time continua evoluindo, sem depender de consultoria.",
      ],
    },
    {
      type: "formats",
      eyebrow: "Formatos",
      title: ["Dois formatos, conforme o seu objetivo."],
      background: { src: "/home/metodo-reuniao.jpg", alt: "", width: 2000, height: 1334 },
      items: [
        {
          title: "AI Culture In Company",
          audience: "Para quem quer **desenvolver capacidade real no time.**",
          text: "Programa sob medida para diferentes áreas e níveis da empresa, com conteúdo e exemplos do seu contexto.",
          features: [
            { title: "Trilhas por área", text: "conteúdo diferente para cada função" },
            { title: "Casos da sua empresa", text: "IA aplicada aos processos reais" },
            { title: "Uso responsável", text: "governança e segurança desde o início" },
            { title: "Mão na massa", text: "todos praticam na hora" },
          ],
          support: "A partir de 12 pessoas · Online ou presencial · Certificado e plano de aplicação por área inclusos",
          cta: { label: "Solicitar proposta", href: diagnostico },
          ctaStyle: "primary",
        },
        {
          title: "AI Culture Experiências",
          audience: "Para quem quer **sensibilizar lideranças e abrir a conversa sobre IA.**",
          text: "Palestras, workshops e imersões sobre IA, agentes e o futuro do trabalho.",
          extra: "Ideal para: eventos corporativos, encontros de liderança e semanas de inovação.",
          // "5 pessoas" e "Certificado..." podem ter sido copiados do Card 1 (pergunta 2 do brief): copy mantida como no doc.
          support: "A partir de 5 pessoas · Online ou presencial · Certificado e plano de aplicação por área inclusos",
          cta: { label: "Consultar disponibilidade", href: diagnostico },
          ctaStyle: "secondary",
        },
      ],
    },
    {
      type: "testimonials",
      eyebrow: "Depoimentos",
      title: ["O resultado não aparece no certificado. Aparece no trabalho."],
      // Lista desligada em produção até haver embed hospedado + autorização (perguntas 6 do brief).
      // Itens "pending" só aparecem em `next dev`, como espaço reservado.
      items: [
        // Daniel e Larissa estão autorizados (22/10). Faltam cargo, empresa, URL do MP4 no R2 e o poster.
        { nome: "Daniel Alves", cargo: "Projetos Logísticos", empresa: "DHL Supply Chain", embedUrl: "", posterUrl: "", status: "pending" },
        { nome: "Larissa Gomes", cargo: "CEO", empresa: "Aliança Representações", embedUrl: "", posterUrl: "", status: "pending" },
      ],
    },
  ],
};

export const advisory: PageContent = {
  slug: "advisory",
  meta: {
    title: "Advisory — consultoria e governança de IA",
    description:
      "Acompanhamos a liderança na implementação de iniciativas de IA e eficiência: priorizamos, medimos e ajustamos a rota, para que o investimento se pague.",
  },
  blocks: [
    {
      type: "heroMedia",
      eyebrow: "Advisory · Consultoria e governança de IA",
      title: ["Sua estratégia de IA, acompanhada até virar resultado."],
      lead: [
        "Acompanhamos a liderança na implementação de iniciativas de IA e eficiência. Priorizamos, medimos e ajustamos a rota, para que o investimento se pague.",
      ],
      support: "Ao lado da liderança. Dentro da execução.",
      cta: { label: "Conversar com um sócio", href: diagnostico },
      image: { src: "/home/metodo-reuniao.jpg", alt: "Reunião da Kalidash com a diretoria de uma empresa", width: 2000, height: 1334 },
      aspect: "landscape",
    },
    {
      type: "text",
      title: ["A estratégia foi definida. E agora?"],
      paragraphs: [
        "Escolher tecnologias e aprovar projetos é a parte fácil. O difícil vem depois: decidir o que priorizar, medir o que funciona, definir responsáveis e corrigir a rota.",
        "E o plano raramente sobrevive ao primeiro trimestre. Surgem informações novas, prioridades mudam, uma tecnologia não entrega o esperado, uma área resiste.",
      ],
      highlight: ["Não entregamos um plano. Acompanhamos o que acontece depois dele."],
    },
    {
      type: "text",
      eyebrow: "O que fazemos",
      title: ["Ajudamos sua liderança a decidir melhor sobre IA."],
      paragraphs: ["Atuamos como conselho da implementação, ao lado da diretoria e dos times que executam."],
      chips: [
        "Questionamos prioridades",
        "Estruturamos decisões",
        "Acompanhamos indicadores",
        "Identificamos desvios cedo",
        "Conectamos tecnologia aos objetivos do negócio",
      ],
    },
    {
      type: "cards",
      eyebrow: "Como funciona",
      title: ["Três rituais que mantêm a IA na agenda da diretoria."],
      columns: 3,
      animated: true,
      items: [
        { title: "Comitê de IA", text: "Encontro mensal com a liderança para revisar prioridades, indicadores e decisões em aberto. É o ritual que impede a iniciativa de morrer na primeira urgência do mês." },
        { title: "Acompanhamento de iniciativas", text: "Proximidade com os times que executam, para destravar o que emperrou antes de virar problema de diretoria." },
        { title: "Mentoria executiva", text: "Conversas individuais com líderes que conduzem a mudança e precisam de um olhar externo e experiente." },
      ],
      // Exemplo sugerido pela Carol entre colchetes no doc; confirmar os entregáveis reais.
      closing: ["**O que a liderança recebe:** painel com os indicadores das iniciativas · relatório mensal de decisões e desvios · roadmap priorizado, revisado a cada trimestre."],
    },
    {
      type: "steps",
      eyebrow: "Como começa",
      title: ["Três passos para começar."],
      items: [
        { title: "Diagnóstico", text: "Mapeamos as iniciativas em andamento, os desafios e as prioridades." },
        { title: "Desenho", text: "Definimos juntos a cadência, os rituais e os indicadores." },
        { title: "Acompanhamento", text: "Ciclos de 6 meses, com revisão ao fim de cada um." },
      ],
      cta: { label: "Conversar com um sócio", href: diagnostico },
    },
    {
      type: "list",
      eyebrow: "Para quem é?",
      title: ["O Advisory faz sentido quando…"],
      items: [
        "Já existem iniciativas de IA ou eficiência em andamento.",
        "Há muitas oportunidades e pouca clareza sobre o que vem primeiro.",
        "Os projetos existem, mas o resultado não aparece.",
        "Falta governança para acompanhar o que foi decidido.",
        "Uma tentativa anterior não se sustentou.",
      ],
      note: "Ainda está começando? O AI Culture é o primeiro passo.",
      noteLink: { label: "Conheça o AI Culture", href: "/treinamento-corporativo-ia" },
    },
    {
      type: "faq",
      title: "Perguntas frequentes",
      items: [
        { q: "Qual a diferença entre Advisory e uma consultoria tradicional?", a: "Não entregamos um relatório e vamos embora. Acompanhamos as decisões e a execução de forma contínua, ao lado da liderança." },
        { q: "Quanto tempo dura?", a: "Ciclos de 3, 6 ou 12 meses, renováveis. A cadência é definida no diagnóstico." },
        { q: "Quem participa do lado da empresa?", a: "A diretoria ou o C-level e os líderes responsáveis pelas iniciativas de IA." },
        { q: "Vocês também implementam?", a: "Se precisar, sim, pela frente de Execução. Mas o Advisory pode ser contratado sozinho." },
        { q: "O acompanhamento é presencial ou remoto?", a: "Pode ser no formato que for confortável e ideal para a empresa." },
        { q: "Como é cobrado?", a: "Valor mensal fixo, definido pelo escopo do acompanhamento, também definido na etapa de diagnóstico." },
      ],
    },
  ],
};

export const execucao: PageContent = {
  slug: "execucao",
  meta: {
    title: "Execução — implementação de IA e automação",
    description:
      "Implementamos agentes de IA, automações, integrações e soluções de dados para resolver problemas reais da operação, do mapeamento do processo à entrega.",
  },
  blocks: [
    {
      type: "heroMedia",
      eyebrow: "Execução · Implementação de IA e automação",
      title: ["Da ideia à solução de IA rodando na sua operação."],
      lead: [
        "Implementamos agentes de IA, automações, integrações e soluções de dados para resolver problemas reais da operação. Do mapeamento do processo à entrega, com o seu time treinado.",
      ],
      support: "Escopo, prazo e métricas definidos antes de começar.",
      cta: { label: "Falar sobre o meu projeto", href: diagnostico },
      // A Carol não indicou a imagem: usei a da frente Execução da Home (confirmar).
      image: { src: "/home/front-3-entrega.jpg", alt: "Apresentação da entrega de um projeto de IA", width: 1086, height: 1448 },
    },
    {
      type: "text",
      title: ["Saber o que mudar não é o mesmo que conseguir implementar."],
      paragraphs: [
        "Processos manuais, tarefas repetitivas, sistemas que não conversam. A maioria das empresas sabe onde estão os gargalos. O que falta é tempo, time técnico e método para resolver sem parar a operação.",
      ],
      highlight: ["É aí que a Kalidash entra."],
    },
    {
      type: "cards",
      eyebrow: "O que construímos",
      title: ["Construímos o que a sua operação precisa."],
      columns: 3,
      animated: true,
      items: [
        { title: "Agentes de IA", text: "Executam tarefas dentro dos processos, com supervisão humana quando necessário.", example: "Ex.: agente que faz a triagem de solicitações" },
        { title: "Automações", text: "Eliminam etapas manuais e repetitivas.", example: "Ex.: relatório semanal gerado sozinho" },
        { title: "Integrações", text: "Fazem sistemas e ferramentas conversarem, sem retrabalho entre áreas.", example: "Ex.: ERP conectado ao CRM" },
        { title: "Dados", text: "Organizam a informação da operação para apoiar decisões.", example: "Ex.: painel de indicadores da produção" },
        { title: "Soluções sob medida", text: "Quando nada pronto resolve, construímos do zero.", example: "Ex.: captura inteligente de conhecimento na CBA" },
      ],
    },
    {
      type: "steps",
      eyebrow: "Como entregamos",
      title: ["Do problema à solução rodando."],
      items: [
        { title: "Entendimento", text: "Mapeamos o processo e identificamos onde a tecnologia pode gerar impacto." },
        { title: "Escopo", text: "O que será entregue, em quanto tempo e como será medido." },
        { title: "Construção", text: "Desenvolvemos a solução junto de quem conhece a operação, validando durante o processo." },
        { title: "Entrega", text: "Solução rodando, documentada, e o seu time treinado para manter." },
      ],
      closing: [
        "O projeto termina quando a sua empresa consegue seguir sem a gente.",
        "A solução vem com documentação e transferência de conhecimento, porque projeto que só o fornecedor consegue mexer é dependência com outro nome.",
      ],
    },
    {
      type: "showcase",
      eyebrow: "Feito para funcionar",
      title: ["Projetos que já estão rodando."],
      metrics: [
        { value: "+100", label: "processos automatizados", confirmed: true },
        { value: "170", label: "operações atendidas", confirmed: true },
        // 12 horas/semana e os números do piloto da CBA: sem fonte validada ainda.
        { value: "12 horas", label: "economizadas por semana até a primeira entrega", confirmed: true },
      ],
      featured: {
        eyebrow: "CBA · Captura Inteligente do Conhecimento",
        title: "Captura Inteligente do Conhecimento",
        text: "As reuniões diárias da operação viraram dado estruturado.",
        stats: { text: "1.681 problemas registrados em 3 meses de piloto, com 97% de encaminhamento definido.", confirmed: true },
        badge: "Finalista Prêmio Inovativos 2026",
        image: { src: "/home/g21-cba-premio.jpg", alt: "CBA e Kalidash no Prêmio Inovativos 2026", width: 1200, height: 900 },
        cta: { label: "Ver o case", href: "/blog?categoria=cases" },
        pageReady: true,
      },
      items: [
        { title: "Kognis", text: "Plataforma de IA para advocacia trabalhista, desenvolvida pela Kalidash.", href: "/kognis" },
        { title: "Spectra AI", text: "Visão computacional aplicada à operação.", href: "/spectra" },
      ],
    },
  ],
};

export const solucoes: PageContent = {
  slug: "solucoes",
  meta: {
    title: "Soluções próprias — Kognis e Spectra AI",
    description:
      "Tecnologia que nasce de problemas reais: soluções desenvolvidas pela Kalidash a partir de operações reais e usadas por empresas hoje.",
  },
  blocks: [
    {
      type: "hero",
      eyebrow: "Soluções próprias",
      title: ["Tecnologia que nasce de problemas reais."],
      lead: [
        "Às vezes encontramos um problema tão específico que nenhuma ferramenta de mercado resolve. Quando isso acontece, a gente constrói.",
        "São tecnologias desenvolvidas pela Kalidash, a partir de operações reais e usadas por empresas hoje.",
      ],
      cta: { label: "Falar sobre o meu caso", href: diagnostico },
    },
    {
      type: "offers",
      items: [
        {
          id: "kognis",
          eyebrow: "Kognis",
          title: "Uma operação mais inteligente para a advocacia.",
          text: "Tecnologia para automatizar **atendimento**, **financeiro** e **gestão de KPIs** de escritórios de advocacia em um só lugar, reduzindo o trabalho operacional e aumentando o controle sobre o negócio.",
          features: [
            { title: "Atendimento", text: "Triagem e acompanhamento automatizados sem perder o contexto de cada cliente." },
            { title: "Financeiro", text: "Rotinas operacionais organizadas em fluxo contínuo, com menos retrabalho." },
            { title: "Gestão de KPIs", text: "Indicadores do escritório consolidados em tempo real para apoiar decisões." },
          ],
          cta: { label: "Conhecer Kognis", href: "/kognis" },
        },
        {
          id: "spectra-ai",
          eyebrow: "Spectra AI",
          title: "Visão computacional aplicada ao chão de operação.",
          text: "A operação fala e o Spectra AI traduz. Câmeras transformam o que acontece na operação em dados de produtividade, identificando oportunidades em tempo real e apontando onde melhorar.",
          features: [
            { title: "Leitura em tempo real", text: "Câmeras conectadas ao ambiente físico traduzem a rotina sem interromper o time." },
            { title: "Dados de produtividade", text: "O que antes dependia de observação manual vira histórico estruturado." },
            { title: "Oportunidades claras", text: "Identificação objetiva de gargalos e pontos de melhoria na operação." },
          ],
          cta: { label: "Conhecer Spectra AI", href: "/spectra" },
        },
      ],
    },
  ],
};

export const kognis: PageContent = {
  slug: "kognis",
  meta: {
    title: "Kognis — Escale seu escritório de advocacia sem crescer sua equipe",
    description:
      "Plataforma de inteligência para escritórios de advocacia. Agentes de IA no WhatsApp 24h, indicadores em tempo real e conciliação bancária automática conectados ao seu sistema jurídico.",
  },
  blocks: [
    {
      type: "heroMedia",
      eyebrow: "Kognis · Soluções próprias",
      title: ["Escale seu escritório", "sem crescer sua equipe."],
      lead: [
        "Escritório de advocacia com um time que nunca dorme: **Inteligência Artificial no atendimento**, **indicadores em tempo real** e **financeiro no automático**.",
        "Conectamos direto no seu sistema jurídico e nos seus bancos, sem precisar trocar nada do que você já usa.",
      ],
      support: "Sem trocar de ERP · Sem migrar dados · Atendimento 24h no WhatsApp",
      cta: { label: "Agendar demonstração", href: diagnostico },
      image: { src: "/kognis-heroes.png", alt: "Kognis — Escritório de Advocacia Inteligente", width: 1000, height: 1000 },
      frame: "none",
    },
    {
      type: "proofBar",
      metrics: [
        { value: "8 horas", label: "semanais a menos em tarefas operacionais", confirmed: true },
        { value: "3x", label: "mais rápido na resposta ao cliente no WhatsApp", confirmed: true },
        { value: "+90%", label: "das dúvidas resolvidas sem acionar sua equipe", confirmed: true },
        { value: "100%", label: "dos indicadores visíveis o tempo todo", confirmed: true },
      ],
    },
    {
      type: "cards",
      eyebrow: "Soluções para escritórios de advocacia",
      title: ["Três problemas resolvidos. Uma plataforma."],
      columns: 3,
      animated: true,
      items: [
        {
          title: "Agentes de IA",
          text: "Agentes que vendem e atendem pelo WhatsApp, 24 horas por dia. Qualificam leads, agendam reuniões e respondem seus clientes sobre o andamento dos processos na hora.",
          example: "Central de atendimento com histórico de conversas, filas e painel de performance.",
        },
        {
          title: "Conciliação Bancária",
          text: "Conecta direto nos seus bancos. Contas a pagar e receber se conciliam sozinhas, e a divisão de honorários entre sócios sai sem discussão e sem erro.",
          example: "Você abre o painel e o financeiro já está fechado.",
        },
        {
          title: "BI e Indicadores",
          text: "Processos, prazos e tarefas em painéis que atualizam sozinhos. Você abre e sabe: quem está em dia, quem está atrasado, onde está o gargalo.",
          example: "Sem planilha, sem pedir relatório pra ninguém.",
        },
      ],
    },
    {
      type: "cards",
      eyebrow: "Atendimento Inteligente 24h",
      title: ["Seu escritório atendendo 24h. Sem contratar ninguém."],
      columns: 3,
      animated: true,
      items: [
        {
          title: "Venda e pré-atendimento",
          text: "Qualifica quem chega pelo WhatsApp e já agenda a reunião diretamente pra você.",
        },
        {
          title: "Atendimento ao cliente",
          text: "O cliente pergunta do processo dele e recebe a resposta com dados reais na hora.",
        },
        {
          title: "Central completa",
          text: "Histórico de conversas, filas e painel de performance da equipe num único lugar.",
        },
      ],
    },
    {
      type: "cards",
      eyebrow: "Controle Financeiro",
      title: ["Seu financeiro fechando sozinho. Sem erro, sem retrabalho."],
      columns: 3,
      animated: true,
      items: [
        {
          title: "Conciliação automática",
          text: "Conecta com os principais bancos do Brasil. Lançamentos batem com o sistema sem você precisar fazer nada.",
        },
        {
          title: "Divisão de honorários",
          text: "Define as regras uma vez. A divisão entre sócios sai certinha e sem discussão, caso a caso.",
        },
        {
          title: "Painel financeiro",
          text: "O que entrou, o que saiu, o que está pendente. Tudo ali, atualizado em tempo real.",
        },
      ],
    },
    {
      type: "steps",
      eyebrow: "Como funciona",
      title: ["Do zero ao escritório inteligente em três passos."],
      items: [
        {
          title: "Conectamos",
          text: "A gente conecta no seu sistema jurídico e nos seus bancos. Você não troca nada do que já usa.",
        },
        {
          title: "Configuramos",
          text: "Ativamos os agentes, montamos os painéis e ajustamos o financeiro do jeito que seu escritório precisa.",
        },
        {
          title: "Você escala",
          text: "Seu escritório passa a operar com previsibilidade. Sobra tempo pra fazer o que você faz de melhor: advogar.",
        },
      ],
      closing: [
        "Implementação ágil em 2 a 3 semanas.",
        "Os agentes de IA costumam ficar operacionais já nos primeiros dias, sem travar a rotina do escritório.",
      ],
    },
    {
      type: "faq",
      title: "Tire suas dúvidas sobre o Kognis",
      items: [
        {
          q: "Preciso trocar meu sistema jurídico?",
          a: "Não. A gente conecta no sistema que você já usa. Sem trocar de ERP, sem migrar dados. Você continua com tudo que tem e ganha uma camada de inteligência por cima.",
        },
        {
          q: "Quanto tempo leva para implementar?",
          a: "De 2 a 3 semanas, dependendo do tamanho do escritório. Os agentes de IA costumam ficar prontos nos primeiros dias.",
        },
        {
          q: "Meus dados e os dados dos meus clientes ficam seguros?",
          a: "Sim. Infraestrutura com criptografia, conformidade com a LGPD e sigilo total. Tratamos dados jurídicos com o mesmo cuidado que você trata.",
        },
        {
          q: "E se eu precisar de ajuda depois da implementação?",
          a: "Você terá suporte dedicado. Não é um chatbot genérico. É um time que conhece seu escritório e responde rápido.",
        },
        {
          q: "Preciso entender de tecnologia para usar?",
          a: "Não. A plataforma foi feita pra quem quer resultado, não pra quem entende de TI. Se você usa WhatsApp, sabe usar o que a gente entrega.",
        },
      ],
    },
  ],
};

export const spectra: PageContent = {
  slug: "spectra",
  meta: {
    title: "Spectra AI — Visão computacional aplicada à operação",
    description:
      "A operação fala e o Spectra AI traduz. Câmeras transformam o que acontece na operação em dados de produtividade, identificando oportunidades em tempo real e apontando onde melhorar.",
  },
  blocks: [
    {
      type: "heroMedia",
      eyebrow: "Spectra AI · Soluções próprias",
      title: ["Visão computacional aplicada ao chão de operação."],
      lead: [
        "A operação fala e o Spectra AI traduz. Câmeras transformam o que acontece na operação em dados de produtividade, identificando oportunidades em tempo real e apontando onde melhorar.",
      ],
      support: "Leitura visual em tempo real sem interromper o time e sem alterar o fluxo de trabalho.",
      cta: { label: "Conhecer Spectra AI", href: diagnostico },
      image: { src: "/sobre-nos/ato-01-operacao.jpg", alt: "Spectra AI visão computacional na operação", width: 893, height: 1600 },
      aspect: "portrait",
    },
    {
      type: "cards",
      eyebrow: "O que faz",
      title: ["Transforme o que acontece na operação em dados objetivos."],
      columns: 3,
      animated: true,
      items: [
        {
          title: "Leitura em tempo real",
          text: "Câmeras conectadas ao ambiente físico traduzem a rotina sem interromper o time.",
        },
        {
          title: "Dados de produtividade",
          text: "O que antes dependia de observação manual vira histórico estruturado.",
        },
        {
          title: "Oportunidades claras",
          text: "Identificação objetiva de gargalos e pontos de melhoria na operação.",
        },
      ],
    },
  ],
};
