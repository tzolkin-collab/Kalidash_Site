/* Páginas internas do site — copy do documento "Copy site completo" (Google Docs, aprovado pela Kalidash).
 * Cada página é uma lista de blocos; o visual de cada tipo está em SitePage.tsx e institucional.module.css.
 * Trechos entre **asteriscos duplos** saem em negrito. Todo CTA leva ao diagnóstico (regra "uma conversão só"). */

export type Cta = { label: string; href: string };

export type Block =
  | { type: "hero"; eyebrow: string; title: string[]; lead: string[]; tagline?: string; meta?: string; cta: Cta }
  | { type: "text"; eyebrow?: string; title: string[]; paragraphs?: string[]; highlight?: string[] }
  | {
      type: "cards";
      eyebrow?: string;
      title: string[];
      intro?: string[];
      items: Array<{ title: string; text: string; href?: string; cta?: string }>;
      columns?: 2 | 3;
      closing?: string[];
      cta?: Cta;
    }
  | { type: "steps"; eyebrow?: string; title: string[]; items: Array<{ title: string; text: string }>; closing?: string[] }
  | { type: "list"; eyebrow?: string; title: string[]; items: string[]; note?: string }
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
  | { type: "proof"; eyebrow?: string; items: Array<{ label: string; names: string }>; closing?: string[] }
  | { type: "cta"; eyebrow?: string; title: string; text: string; cta: Cta; microcopy?: string }
  | {
      type: "heroMedia";
      eyebrow: string;
      title: string[];
      lead: string[];
      support?: string;
      cta: Cta;
      image: Media;
    }
  | { type: "proofBar"; metrics: ProofMetric[]; logos?: ProofLogos }
  | { type: "formats"; eyebrow: string; title: string[]; background: Media; items: FormatCard[] }
  | { type: "testimonials"; eyebrow: string; title: string[]; items: Testimonial[] };

export type Media = { src: string; alt: string; width: number; height: number };

/* `confirmed: false` = o dado ainda não tem fonte/autorização da Carol; o renderizador NÃO publica o item. */
export type ProofMetric = { value: string; label: string; confirmed: boolean };
export type ProofLogos = { caption: string; confirmed: boolean; items: Array<{ name: string; src?: string }> };

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

/* Depoimento em vídeo. Só `status: "approved"` com `embedUrl` hospedado (YouTube/Vimeo não listado) vai ao ar.
 * Nenhum arquivo de vídeo entra no repositório; o player só carrega no clique. */
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
    title: "Sobre nós",
    description:
      "A Kalidash é uma aceleradora de eficiência operacional. Desenvolvemos pessoas, redesenhamos processos e conectamos tecnologia ao trabalho real.",
  },
  blocks: [
    {
      type: "hero",
      eyebrow: "Sobre nós",
      title: ["Inteligência para operações que precisam fluir."],
      lead: [
        "A Kalidash é uma **aceleradora de eficiência operacional**. Desenvolvemos pessoas, redesenhamos processos e conectamos tecnologia ao trabalho real, em operações de mais de 500 pessoas.",
      ],
      cta: { label: "Solicitar diagnóstico", href: diagnostico },
    },
    {
      type: "cards",
      columns: 3,
      title: ["Dois mundos, uma só visão."],
      items: [
        {
          title: "Nascemos na economia real.",
          text: "Nossos fundadores começaram como estagiários e técnicos e cresceram dentro de operações grandes, complexas e manuais.",
        },
        {
          title: "Aprendemos o outro lado.",
          text: "Também passamos por empresas nativas digitais, onde dados, tecnologia e automação já faziam parte da forma de trabalhar.",
        },
        {
          title: "Hoje conectamos os dois mundos.",
          text: "Levamos para operações tradicionais a experiência de quem viveu, por dentro, a transformação digital.",
        },
      ],
    },
    {
      type: "text",
      eyebrow: "A nossa história",
      title: ["Antes de transformar operações, aprendemos a viver dentro delas…"],
      paragraphs: [
        "Grandes empresas da economia real não são construídas em PowerPoint.",
        "São construídas por pessoas, processos complexos, conhecimento acumulado e decisões que precisam funcionar todos os dias.",
        "Foi nesse ambiente que os fundadores da Kalidash começaram, há 15 anos. **Do chão da operação à liderança. Da execução à decisão. Do trabalho manual à tecnologia.**",
        "Começaram como **estagiários e técnicos**, chegaram a posições de liderança em grandes empresas, tornaram-se sócios e, hoje, são empresários.",
        "Ao mesmo tempo, viveram o outro lado da transformação em empresas nativas digitais como **RD Station, Sympla, Hotmart e PicPay**, onde dados, tecnologia e automação já faziam parte da forma de operar.",
      ],
      highlight: ["Viver esses dois mundos mudou a forma como enxergamos a inovação."],
    },
    {
      type: "cards",
      columns: 3,
      title: ["O que cada lado precisa."],
      items: [
        { title: "Quem está na operação", text: "Precisa de **soluções que funcionem.**" },
        { title: "Quem está na liderança", text: "Precisa de **resultado, escala e governança.**" },
        { title: "A tecnologia", text: "Precisa conectar os dois, não criar mais uma camada de complexidade." },
      ],
      closing: ["Foi dessa experiência que nasceu a Kalidash."],
    },
    {
      type: "text",
      eyebrow: "A mudança",
      title: ["A IA mudou a tecnologia. Ainda não mudou, sozinha, a forma como as empresas trabalham."],
      paragraphs: [
        "A Inteligência Artificial abriu uma nova possibilidade: fazer mais, com menos esforço e mais inteligência. Mas ter acesso à tecnologia não transforma uma operação.",
        "O time precisa saber **como usar.** A liderança precisa saber **onde aplicar.** E a empresa precisa criar capacidade para que a transformação continue acontecendo depois que o projeto termina.",
        "Foi aí que entendemos onde estava o nosso trabalho.",
      ],
      highlight: ["Não é só implementar tecnologia. É desenvolver capacidade."],
    },
    {
      type: "cards",
      eyebrow: "O que fazemos hoje",
      title: ["Três frentes para transformar a operação de dentro para fora."],
      columns: 3,
      items: [
        {
          title: "AI Culture",
          text: "**Capacitação que vira prática.** Desenvolvemos pessoas para usar IA de forma inteligente, aplicar a tecnologia no trabalho real e construir uma cultura que continua depois do treinamento.",
          href: "/treinamento-corporativo-ia",
          cta: "Conhecer o AI Culture",
        },
        {
          title: "Advisory",
          text: "**Estratégia para transformar com direção.** Acompanhamos a liderança na identificação de oportunidades, priorização de iniciativas e construção de governança preparada para a era dos agentes.",
          href: "/advisory",
          cta: "Conhecer o Advisory",
        },
        {
          title: "Execução",
          text: "**Mão na massa para fazer acontecer.** Redesenhamos processos e implementamos agentes, automações, integrações e soluções que colocam a tecnologia para trabalhar na operação.",
          href: "/execucao",
          cta: "Conhecer a Execução",
        },
      ],
    },
    {
      type: "proof",
      items: [
        { label: "Onde aplicamos", names: "ArcelorMittal · CBA · Sicoob · Cooxupé e outras…" },
        { label: "Onde ensinamos", names: "Conquer · Xperiun · Rocketseat · Hashtag · Tera" },
      ],
      closing: ["Nós ensinamos o que vivemos.", "E vivemos o que ensinamos."],
    },
    {
      type: "cta",
      title: "Descubra onde sua operação pode ganhar eficiência.",
      text: "Uma conversa com um especialista para identificar gargalos, oportunidades e caminhos possíveis para a sua operação.",
      cta: { label: "Solicitar diagnóstico", href: diagnostico },
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
      // Logos: falta o ok de uso e os arquivos de CBA, Sicoob e Cooxupé (pergunta 5 do brief).
      logos: {
        caption: "Times treinados em",
        confirmed: false,
        items: [
          { name: "ArcelorMittal", src: "/logos/arcelormittal.svg" },
          { name: "CBA" },
          { name: "Sicoob" },
          { name: "Cooxupé" },
        ],
      },
    },
    {
      type: "text",
      title: ["Ter acesso à IA não é saber trabalhar com ela."],
      paragraphs: [
        "Muitas empresas já liberaram ChatGPT, Copilot ou Gemini para o time e a rotina continua igual. O gargalo não é a ferramenta, é saber onde aplicar, testar no próprio trabalho e transformar isso em hábito.",
      ],
      highlight: ["Nosso objetivo é criar capacidade dentro da empresa, não ensinar mais uma ferramenta."],
    },
    {
      type: "steps",
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
        { nome: "Daniel", cargo: "Cargo (a confirmar)", empresa: "Empresa (a confirmar)", embedUrl: "", posterUrl: "", status: "pending" },
        { nome: "Larissa", cargo: "Cargo (a confirmar)", empresa: "Empresa (a confirmar)", embedUrl: "", posterUrl: "", status: "pending" },
      ],
    },
    {
      type: "cta",
      title: "Desenvolva um time que sabe o que fazer com IA.",
      text: "Conte um pouco sobre o momento da sua empresa. A gente entende o contexto, o perfil do time e os objetivos antes de falar sobre formato.",
      cta: { label: "Solicitar proposta", href: diagnostico },
    },
  ],
};

export const advisory: PageContent = {
  slug: "advisory",
  meta: {
    title: "Advisory — transformação sem perder o rumo",
    description:
      "Acompanhamos a liderança durante a implementação de iniciativas de IA e eficiência, com visão de negócio, experiência prática e governança.",
  },
  blocks: [
    {
      type: "hero",
      eyebrow: "Advisory",
      title: ["Transformação sem perder o rumo."],
      lead: [
        "A inovação não termina quando a estratégia é definida. Acompanhamos a liderança durante a implementação de iniciativas de IA e eficiência, com visão de negócio, experiência prática e governança para que a transformação avance na direção certa.",
      ],
      tagline: "Ao lado da liderança. Dentro da transformação.",
      cta: { label: "Solicitar diagnóstico", href: diagnostico },
    },
    {
      type: "text",
      title: ["A estratégia foi definida. E agora?"],
      paragraphs: [
        "Transformar uma operação exige mais do que escolher tecnologias e definir projetos.",
        "É preciso decidir **o que priorizar, acompanhar o que está funcionando, definir responsáveis e ajustar a rota quando necessário.**",
        "É nesse espaço entre estratégia e execução que o **Advisory** atua.",
      ],
    },
    {
      type: "text",
      title: ["Ajudamos sua liderança a tomar decisões melhores."],
      paragraphs: [
        "A Kalidash atua como **conselheira da transformação**, ao lado da liderança e dos times responsáveis pela implementação.",
        "**Questionamos prioridades · Estruturamos decisões · Acompanhamos indicadores · Identificamos desvios · Conectamos tecnologia aos objetivos do negócio**",
        "Projeto de transformação raramente segue o plano inicial. Informação nova aparece, prioridade muda, uma tecnologia não entrega o esperado, uma área resiste e outra encontra oportunidade maior.",
      ],
      highlight: ["Não entregamos um plano.", "Acompanhamos o que acontece depois dele."],
    },
    {
      type: "cards",
      title: ["Como isso acontece no dia a dia da sua empresa."],
      columns: 3,
      items: [
        { title: "Comitê de transformação", text: "Encontro recorrente com a liderança para revisar prioridades, indicadores e decisões em aberto. É o ritual que impede a transformação de morrer na primeira urgência do mês." },
        { title: "Acompanhamento de iniciativa", text: "Proximidade com os times que estão executando, para destravar o que emperrou antes de virar problema de diretoria." },
        { title: "Mentoria executiva", text: "Conversas individuais com líderes que estão conduzindo a transformação e precisam de um olhar externo e experiente." },
      ],
      closing: [
        "**Diagnóstico inicial.** Começamos entendendo as iniciativas em andamento, os principais desafios e as prioridades da empresa. A partir disso, definimos a forma de acompanhamento.",
      ],
      cta: { label: "Solicitar diagnóstico", href: diagnostico },
    },
    {
      type: "list",
      eyebrow: "Para quem é?",
      title: ["O Advisory faz sentido quando…"],
      items: [
        "A empresa já possui iniciativas de IA ou eficiência em andamento.",
        "A liderança precisa transformar projetos em resultados.",
        "Existem muitas oportunidades, mas pouca clareza sobre o que priorizar.",
        "A empresa precisa de governança para acompanhar a transformação.",
        "A liderança quer desenvolver capacidade interna, sem criar dependência de um fornecedor.",
        "Já houve uma tentativa anterior que não se sustentou.",
      ],
      note: "Se a empresa ainda está começando, o AI Culture pode ser o primeiro passo.",
    },
    {
      type: "cta",
      title: "Advisory não cria dependência. Cria autonomia.",
      text: "Não acreditamos em transformação que depende para sempre de quem a implementou. Conte o que a sua empresa está tentando transformar, vamos entender o cenário e onde a Kalidash pode ajudar.",
      cta: { label: "Solicitar diagnóstico", href: diagnostico },
    },
  ],
};

export const execucao: PageContent = {
  slug: "execucao",
  meta: {
    title: "Execução — da ideia à operação",
    description:
      "Implementamos IA, automação, dados e tecnologia para resolver problemas reais da operação, do processo ao sistema.",
  },
  blocks: [
    {
      type: "hero",
      eyebrow: "Execução",
      title: ["Da ideia à operação."],
      lead: [
        "Implementamos IA, automação, dados e tecnologia para resolver problemas reais da operação.",
        "A Kalidash entra na execução para transformar oportunidades em soluções funcionando, do processo ao sistema, da primeira análise à implementação.",
      ],
      tagline: "Pensamos juntos. Construímos juntos. Colocamos para funcionar.",
      cta: { label: "Falar sobre o meu projeto", href: diagnostico },
    },
    {
      type: "text",
      title: ["Saber o que precisa mudar não significa conseguir implementar."],
      paragraphs: [
        "Muitas empresas já sabem onde estão os gargalos. Existem processos manuais, tarefas repetitivas, sistemas que não conversam e oportunidades claras de automação.",
        "Mas transformar uma oportunidade em solução funcionando exige processo, tecnologia, integração e capacidade de execução. E nem sempre essa capacidade existe dentro de casa.",
        "**É aí que entramos.**",
      ],
    },
    {
      type: "cards",
      eyebrow: "O que fazemos",
      title: ["Construímos o que a sua operação precisa."],
      columns: 3,
      items: [
        { title: "Agentes de IA", text: "Agentes que executam tarefas e participam de processos, com supervisão humana onde necessário." },
        { title: "Automações", text: "Fluxos que reduzem o trabalho manual e tornam processos mais eficientes." },
        { title: "Integrações", text: "Conectamos sistemas, ferramentas e dados para fazer a operação fluir melhor." },
        { title: "Dados", text: "Organizamos dados operacionais para gerar informação e apoiar decisões." },
        { title: "Soluções sob medida", text: "Quando nenhuma solução pronta resolve o problema, construímos o que a operação precisa." },
      ],
    },
    {
      type: "text",
      eyebrow: "Nosso diferencial",
      title: ["Não começamos pela tecnologia. Começamos pelo problema."],
      paragraphs: [
        "Antes de construir qualquer solução, entendemos o processo que existe por trás dela.",
        "**Onde existe atrito? Onde existe trabalho manual? Onde a informação se perde? Onde a tecnologia gera impacto de verdade?**",
        "A partir daí, construímos junto de quem conhece a operação.",
      ],
      highlight: ["Tecnologia precisa funcionar. Mas, principalmente, precisa funcionar para quem trabalha."],
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
      type: "text",
      eyebrow: "Feito para funcionar",
      title: ["Projetos construídos para resolver problemas concretos em operações reais."],
      paragraphs: ["**+100 processos automatizados** · **170 operações atendidas** · **Operações de mais de 500 pessoas**"],
    },
    {
      type: "cta",
      title: "Tem um processo que precisa mudar?",
      text: "Vamos entender o problema antes de construir a solução. Conte o que está acontecendo na sua operação.",
      cta: { label: "Falar sobre o meu projeto", href: diagnostico },
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
          cta: { label: "Conhecer Kognis", href: diagnostico },
        },
        {
          id: "spectra-ai",
          eyebrow: "Spectra AI",
          title: "Visão computacional aplicada ao chão de operação.",
          text: "A operação fala e o Spectra AI traduz. Câmeras transformam o que acontece na operação em dados de produtividade, identificando oportunidades em tempo real e apontando onde melhorar.",
          cta: { label: "Conhecer Spectra AI", href: diagnostico },
        },
      ],
    },
    {
      type: "cta",
      eyebrow: "Onde o problema vira tecnologia",
      title: "Tem um processo na sua operação que nenhuma ferramenta de mercado resolve?",
      text: "É assim que os nossos produtos começaram.",
      cta: { label: "Falar sobre o meu caso", href: diagnostico },
    },
  ],
};
