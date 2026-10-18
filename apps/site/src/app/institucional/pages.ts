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
  | { type: "cta"; eyebrow?: string; title: string; text: string; cta: Cta; microcopy?: string };

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
      type: "hero",
      eyebrow: "AI Culture",
      title: ["Seu time não precisa apenas aprender IA.", "Precisa aprender o que fazer com ela."],
      lead: [
        "Treinamentos corporativos de IA construídos a partir da realidade da sua empresa.",
        "Desenvolvemos repertório, aplicação prática e autonomia para que os times usem IA no trabalho real, com trilhas por área e governança desde o início.",
      ],
      meta: "Turmas a partir de 12 pessoas · Online ou Presencial",
      cta: { label: "Solicitar proposta para o meu time", href: diagnostico },
    },
    {
      type: "text",
      eyebrow: "Por que capacitar?",
      title: ["Ter acesso à IA não significa saber trabalhar com ela."],
      paragraphs: [
        "Uma empresa pode disponibilizar ChatGPT, Copilot ou outras ferramentas para todo o time e, ainda assim, continuar trabalhando praticamente da mesma forma.",
        "O desafio está em fazer as pessoas entenderem onde aplicar, experimentarem na prática e enxergarem oportunidades no próprio trabalho.",
        "O objetivo é desenvolver capacidade dentro da empresa. **Não ensinar mais uma ferramenta.**",
      ],
    },
    {
      type: "steps",
      eyebrow: "Nossa metodologia",
      title: ["A gente começa pelo trabalho, não pela ferramenta."],
      items: [
        { title: "Contexto", text: "Entendemos como o trabalho acontece. Conhecemos os times, áreas, processos e desafios que fazem parte da rotina." },
        { title: "Capacitação", text: "Desenvolvemos repertório para usar IA com segurança e propósito. As pessoas aprendem possibilidades que fazem sentido para o próprio contexto." },
        { title: "Aplicação", text: "Levamos a IA para problemas reais. O aprendizado acontece sobre situações, tarefas e processos que o time realmente executa." },
        { title: "Cultura", text: "Criamos autonomia para continuar evoluindo. O time passa a reconhecer oportunidades, testar novas possibilidades e incorporar a IA à rotina." },
      ],
      closing: [
        "O treinamento termina. A capacidade permanece.",
        "O objetivo não é criar dependência da Kalidash. **É fazer com que o próprio time consiga continuar encontrando oportunidades de melhoria.**",
      ],
    },
    {
      type: "cards",
      eyebrow: "O que muda",
      title: ["Quando o time aprende a trabalhar de outra forma, a operação muda junto."],
      columns: 2,
      items: [
        { title: "Pessoas", text: "Mais repertório para usar IA no trabalho real." },
        { title: "Processos", text: "Menos trabalho repetitivo e novas formas de executar." },
        { title: "Liderança", text: "Mais clareza sobre onde a IA pode gerar valor e onde não deve ser aplicada." },
        { title: "Cultura", text: "Um time que passa a enxergar IA como parte do trabalho, não como uma ferramenta isolada." },
      ],
      cta: { label: "Quero desenvolver meu time", href: diagnostico },
    },
    {
      type: "offers",
      items: [
        {
          eyebrow: "AI Culture · In Company",
          title: "Uma capacitação construída para a realidade da sua empresa.",
          text: "Treinamento corporativo personalizado para desenvolver o uso prático de IA nos diferentes níveis e áreas da organização. Conteúdo, exemplos e aplicações conectados ao contexto real do time.",
          features: [
            { title: "Trilhas por área", text: "Conteúdos e aplicações diferentes para diferentes funções e necessidades." },
            { title: "Casos reais da empresa", text: "A IA aplicada sobre situações e processos que fazem parte da rotina." },
            { title: "Uso responsável e governança", text: "Orientações para usar IA com segurança, contexto e responsabilidade." },
            { title: "Aplicação prática", text: "Menos teoria. Mais experimentação sobre o trabalho real." },
            { title: "Turmas a partir de 12 pessoas", text: "O formato foi pensado para desenvolver capacidade de forma coletiva e criar uma mudança que se espalha pelo time." },
          ],
          cta: { label: "Solicitar proposta", href: diagnostico },
        },
        {
          eyebrow: "AI Culture · Experiências",
          title: "Para despertar repertório, provocar novas ideias e acelerar a experimentação.",
          text: "Palestras, workshops, aulas e experiências sobre **Inteligência Artificial, agentes e novas formas de trabalhar**, para empresas que querem sensibilizar lideranças, provocar seus times ou abrir uma conversa sobre o futuro do trabalho.",
          note: "Para eventos, encontros de liderança, semanas de inovação e momentos de sensibilização.",
          cta: { label: "Consultar disponibilidade", href: diagnostico },
        },
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
