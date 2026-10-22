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
        { nome: "Daniel", cargo: "", empresa: "", embedUrl: "", posterUrl: "", status: "pending" },
        { nome: "Larissa", cargo: "", empresa: "", embedUrl: "", posterUrl: "", status: "pending" },
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
      type: "cta",
      title: "Advisory não cria dependência. Cria autonomia.",
      text: "Não acreditamos em transformação que depende para sempre de quem a implementou. Conte o que a sua empresa está tentando transformar, vamos entender o cenário e onde a Kalidash pode ajudar.",
      cta: { label: "Solicitar diagnóstico", href: diagnostico },
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
        { value: "12 horas", label: "economizadas por semana até a primeira entrega", confirmed: false },
      ],
      featured: {
        eyebrow: "CBA · Captura Inteligente do Conhecimento",
        title: "Captura Inteligente do Conhecimento",
        text: "As reuniões diárias da operação viraram dado estruturado.",
        stats: { text: "1.681 problemas registrados em 3 meses de piloto, com 97% de encaminhamento definido.", confirmed: false },
        badge: "Finalista Prêmio Inovativos 2026",
        cta: { label: "Ver o case", href: "/cases/cba" },
        pageReady: false,
      },
      items: [
        { title: "Kognis", text: "Plataforma de IA para advocacia trabalhista, desenvolvida pela Kalidash.", href: "/solucoes#kognis" },
        { title: "Spectra AI", text: "Visão computacional aplicada à operação.", href: "/solucoes#spectra-ai" },
      ],
    },
    {
      type: "cta",
      title: "Tem um processo que precisa mudar?",
      text: "Conte o que acontece hoje na sua operação. Entendemos o problema antes de propor a solução, e você recebe escopo, prazo e investimento em poucas horas.",
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
