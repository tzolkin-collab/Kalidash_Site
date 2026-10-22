/* Conteúdo da Home — fonte de verdade para textos, links e imagens.
 * Copy atualizada em 09/10/2026 a partir do documento aprovado pela Kalidash. */

export const config = {
  leadEndpoint: process.env.NEXT_PUBLIC_LEAD_ENDPOINT ?? "",
  // Links enviados pela Kalidash em 02/10/2026; WhatsApp trocado em 20/10/2026 (Michelle saiu). Pode ser sobrescrito por variável de ambiente.
  whatsappUrl: process.env.NEXT_PUBLIC_WHATSAPP_URL ?? "https://wa.link/v9grih",
  social: {
    instagram: "https://www.instagram.com/kalidash.ai/",
    linkedin: "https://www.linkedin.com/company/kalidash/",
    youtube: "https://www.youtube.com/@KalidashIA",
    facebook: "",
  },
};

export type NavItem = {
  label: string;
  href: string;
  children?: Array<{ label: string; href: string; hint: string }>;
};

/* Navegação conforme "Estrutura do site" (kalidash.com é o masterbrand).
 * As rotas internas (/sobre-nos, /advisory, /execucao, /solucoes...) ainda serão criadas. */
export const nav: NavItem[] = [
  {
    label: "Para empresas",
    href: "/#o-que-fazemos",
    children: [
      { label: "AI Culture", href: "/treinamento-corporativo-ia", hint: "Carro-chefe · porta de entrada" },
      { label: "Advisory", href: "/advisory", hint: "Governança, mentorias e assessorias" },
      { label: "Execução", href: "/execucao", hint: "Mão na massa · projeto técnico" },
    ],
  },
  { label: "Sobre nós", href: "/sobre-nos" },
  { label: "Cases", href: "/#experiencia" },
  { label: "Blog", href: "/blog" },
  {
    label: "Produtos",
    href: "/solucoes",
    children: [
      { label: "Kognis", href: "/solucoes#kognis", hint: "IA para advocacia trabalhista" },
      { label: "Spectra AI", href: "/solucoes#spectra-ai", hint: "Visão computacional na operação" },
    ],
  },
];

/* CTA único e fixo no topo: todo CTA da Home leva para o mesmo lugar. */
export const navCta = { label: "Diagnóstico", href: "/diagnostico" };

export const hero = {
  eyebrow: "Aceleradora de eficiência operacional",
  title: "Prepare sua operação para a era dos agentes de IA.",
  paragraphs: [
    "Treinamos equipes, estruturamos a governança e implementamos agentes e automações em operações com mais de 500 pessoas. Eficiência medida no resultado, não na ferramenta.",
  ],
  primaryCta: { label: "Preparar minha operação", href: "/diagnostico" },
  secondaryCta: { label: "Conhecer a Kalidash", href: "/#experiencia" },
  stats: [
    { value: "10 mil", label: "pessoas capacitadas em IA" },
    { value: "170", label: "operações atendidas" },
    { value: "64", label: "projetos executados com sucesso" },
  ],
};

export const clients = [
  { name: "Neon", src: "/home/logo-neon.png" },
  { name: "Arquiteto de Bolso", src: "/home/logo-arquiteto.png" },
  { name: "Spark", src: "/home/logo-spark.png" },
  { name: "Fermec", src: "/home/logo-fermec.png" },
  { name: "Bázico", src: "/home/logo-bazico.png" },
  { name: "Control iD", src: "/home/logo-controlid.png" },
  { name: "3D Lab", src: "/home/logo-3dlab.png" },
];

export const problem = {
  watermark: "-   Inteligência Empresarial",
  title: "O problema não é só tecnológico.",
  subtitle: "É operacional, é cultural, é humano.",
  text: "Quando pessoas, processos e tecnologia andam em ritmos diferentes, a execução trava e as decisões demoram. Ferramenta nova não resolve. O que resolve é mudar o jeito de trabalhar.",
  closingFinal: "Ferramenta nova não resolve isso. Muda-se o jeito de trabalhar.",
  quote: {
    text: "Nosso time perdia horas com tarefas manuais e retrabalho. Hoje, os processos fluem e focamos no que realmente importa.",
    author: "Aline Motta",
    role: "empresária",
  },
  cards: [
    {
      icon: "chart",
      number: "01",
      title: "Trabalho manual",
      text: "Tarefas repetitivas que consomem tempo e capacidade do time.",
    },
    {
      icon: "database",
      number: "02",
      title: "IA superficial",
      text: "Ferramentas disponíveis, mas pouco conectadas aos processos e à rotina do negócio.",
    },
    {
      icon: "share",
      number: "03",
      title: "Operação desconectada",
      text: "Pessoas, processos internos e tecnologia sem a mesma prioridade nem a mesma linguagem.",
    },
  ],
  /* Depoimentos pareados aos cards 02 e 03 (exibidos no empilhamento mobile). Substituir por depoimentos reais. */
  pairedQuotes: [
    {
      text: "Já tínhamos várias ferramentas de IA, mas nenhuma mudava o resultado. A Kalidash conectou tudo à nossa rotina.",
      author: "Camila Duarte",
      role: "head de produto",
    },
    {
      text: "Hoje comercial, operação e tecnologia falam a mesma língua. As decisões deixaram de travar no meio do caminho.",
      author: "Eduardo Lima",
      role: "CEO",
    },
  ] as Array<{ text: string; author: string; role: string }>,
  hologramTags: [
    { label: "tecnologia", from: [95, 97], to: [73.5, 82.4], anchor: [61.8, 66.2] },
    { label: "execução", from: [4, 94], to: [26.5, 82.4], anchor: [38.2, 66.2] },
    { label: "decisões", from: [2, 44], to: [12, 37.6], anchor: [31, 43.8] },
  ] as Array<{ label: string; from: [number, number]; to: [number, number]; anchor: [number, number] }>,
};

export const fronts = {
  eyebrow: "O que fazemos",
  title: "Treinamento, governança e execução em IA. Três frentes, um mesmo objetivo.",
  paragraphs: [
    "Nem toda empresa começa no mesmo lugar. Algumas precisam preparar as pessoas. Outras precisam saber onde está o potencial de eficiência. Outras já sabem o que fazer e precisam de braço para executar. As três frentes funcionam juntas ou separadas na Kalidash.",
  ],
  items: [
    {
      number: "01",
      name: "AI Culture",
      title: "Prepare seu time para uma nova forma de trabalhar.",
      text: "Programa de treinamento corporativo que desenvolve repertório, autonomia e novos hábitos para que as pessoas incorporem IA à rotina e passem a encontrar melhorias por conta própria.",
      audience: "Para quem é: empresas que já liberaram ferramentas de IA, mas não viram a rotina mudar.",
      closing: "Capacitação é onde a transformação começa.",
      link: { label: "Conheça os treinamentos", href: "/treinamento-corporativo-ia" },
      image: { src: "/home/front-1-workshop.jpg", alt: "Treinamento corporativo conduzido pela Kalidash" },
    },
    {
      number: "02",
      name: "Advisory",
      title: "Transforme sem perder o rumo.",
      text: "Acompanhamos a liderança para priorizar iniciativas, decidir onde investir, medir resultado e manter a IA conectada aos objetivos do negócio.",
      audience: "Para quem é: lideranças com muitas ideias de IA na mesa e pouca clareza sobre o que vem primeiro.",
      closing: "Advisory é onde a transformação ganha direção e continuidade.",
      link: { label: "Conheça o Advisory", href: "/advisory" },
      image: { src: "/home/front-2-comite.jpg", alt: "Liderança acompanhando indicadores com a Kalidash" },
    },
    {
      number: "03",
      name: "Execução",
      title: "Quando a estratégia precisa sair do papel.",
      text: "Entramos na operação para implementar agentes, automações, integrações e soluções de dados quando a empresa precisa de capacidade extra para fazer acontecer.",
      audience: "Para quem é: times que já sabem o que querem automatizar e precisam de quem construa.",
      closing: "Execução transforma estratégia em operação.",
      link: { label: "Conheça a Execução", href: "/execucao" },
      image: { src: "/home/front-3-entrega.jpg", alt: "Framework de agentes e operação da Kalidash" },
    },
  ],
};

export const experience = {
  eyebrow: "Experiência que vem da operação real",
  title: "Não aprendemos a transformar operações olhando de fora.",
  paragraphs: [
    "Já estivemos entre a estratégia e a execução, entre quem toma a decisão e quem faz o trabalho acontecer.",
    "Nossa experiência foi construída em operações complexas, empresas da economia real e ambientes onde eficiência não é discurso, é resultado.",
  ],
  authorities: [
    {
      label: "Onde aplicamos",
      items: ["ArcelorMittal", "CBA", "Sicoob", "Cooxupé"],
      note: "Operações de mais de 500 pessoas.",
    },
    {
      label: "Onde ensinamos",
      items: ["Conquer", "Xperiun", "Rocketseat", "Hashtag", "Tera"],
      note: "As maiores escolas de negócios e tecnologia do país.",
    },
  ],
  proof: ["A gente vive o que ensina.", "E ensina o que vive."],
  closing: [
    "A IA não precisa substituir pessoas para transformar uma operação.",
    "Ela pode ampliar a capacidade de quem já faz o trabalho acontecer.",
  ],
  link: { label: "Fale com a Kalidash", href: "/diagnostico" },
  image: { src: "/home/cooxupe.jpg", alt: "Equipe reunida na escadaria da Cooxupé" },
};

/* Case em destaque (alt. 6 da Carol, 20/10/2026). A página /cases/cba ainda não existe:
 * enquanto `pageReady` for false o CTA não é exibido (evita link quebrado). */
export const caseCba = {
  eyebrow: "Case · CBA",
  title: "Captura Inteligente do Conhecimento",
  text: "O que se decidia nas reuniões diárias de rotina ficava só na memória de quem estava na sala. Criamos uma solução de IA que transcreve essas conversas, mesmo com ruído industrial, e as transforma em dado estruturado: problema, solução, criticidade e prazo, validados por quem conhece o processo.",
  badge: "Finalista Prêmio Inovativos 2026 — categoria Dados, Insights e Decisão",
  cta: { label: "Ver o case completo", href: "/cases/cba" },
  pageReady: false,
};

export const testimonial = {
  eyebrow: "Quem viveu a transformação",
  title: "O que muda quando a tecnologia chega ao trabalho real.",
  /* Alt. 8 da Carol (20/10/2026): três cards com foto, métrica e frase. Só o André é depoimento real;
   * Camila e Eduardo são os mesmos textos provisórios já usados em "O problema" e precisam ser trocados por
   * depoimentos reais, com foto e, se houver, `metric` (ex.: { value: "R$ 100 mil", label: "em 45 dias" }). */
  cards: [
    {
      quote: "Entregaram além da nossa expectativa e também do acordo. É assim que você surpreende clientes.",
      author: "André",
      role: "CMO da Tô Garantido",
      photo: "/home/avatar-andre.jpg" as string | undefined,
      metric: undefined as { value: string; label: string } | undefined,
    },
    {
      quote: "Já tínhamos várias ferramentas de IA, mas nenhuma mudava o resultado. A Kalidash conectou tudo à nossa rotina.",
      author: "Camila Duarte",
      role: "head de produto",
      photo: undefined,
      metric: undefined,
    },
    {
      quote: "Hoje comercial, operação e tecnologia falam a mesma língua. As decisões deixaram de travar no meio do caminho.",
      author: "Eduardo Lima",
      role: "CEO",
      photo: undefined,
      metric: undefined,
    },
  ],
};

/* Seção "Por trás da transformação" removida da Home em 20/10/2026 (alt. 9 da Carol); conteúdo mantido aqui por referência. */
export const people = {
  eyebrow: "Por trás da transformação",
  title: ["Tecnologia é parte da mudança.", "Pessoas fazem ela acontecer."],
  text: "Treinamentos, imersões, workshops e projetos com gente de verdade transformando o trabalho real.",
  items: [
    { src: "/home/evento-palestra.jpg", alt: "Apresentação da Kalidash em uma imersão presencial", title: "Imersões" },
    { src: "/home/evento-sala.jpg", alt: "Sala de treinamento com participantes e telas", title: "Treinamentos corporativos" },
    { src: "/home/evento-mesa.jpg", alt: "Equipe trabalhando em notebooks ao redor de uma mesa", title: "Workshops" },
    { src: "/home/cooxupe.jpg", alt: "Equipe reunida na escadaria da Cooxupé", title: "Clientes" },
    { src: "/home/metodo-reuniao.jpg", alt: "Equipe da Kalidash em reunião", title: "Projetos" },
  ],
};

export const diagnostico = {
  title: "Existe uma oportunidade de eficiência na sua operação.",
  text: "Conte um pouco sobre o momento da sua empresa e vamos entender o desafio antes de falar sobre qualquer solução.",
  microcopy: "Primeiro entendemos. Depois construímos juntos.",
  fields: {
    name: "Nome e sobrenome*",
    company: "Empresa*",
    role: "Cargo*",
    email: "E-mail corporativo*",
    phone: "WhatsApp com DDD*",
    teamSize: "Número de colaboradores na operação*",
    goal: "O que você busca?",
    challenge: "Conte um pouco mais sobre o desafio",
    submit: "Solicitar diagnóstico",
  },
  goals: [
    "Capacitar meu time em IA",
    "Estruturar uma agenda de IA e eficiência",
    "Acompanhar uma transformação em andamento",
    "Transformar um processo ou operação",
    "Conhecer a Kalidash",
  ],
};

export type FooterLink = { label: string; href?: string; external?: boolean };
export type FooterColumn = { title: string; links: FooterLink[] };

export const footer = {
  text: "Preparamos pessoas, processos e tecnologia para a era dos agentes de IA.",
  // Copy da Carol (20/10/2026). Em 22/10 o PO definiu que "Para empresas" usa os nomes do menu (AI Culture, Advisory, Execução).
  columns: [
    {
      title: "Para empresas",
      links: [
        { label: "AI Culture", href: "/treinamento-corporativo-ia" },
        { label: "Advisory", href: "/advisory" },
        { label: "Execução", href: "/execucao" },
        { label: "Diagnóstico", href: "/diagnostico" },
      ],
    },
    {
      title: "Produtos",
      links: [
        { label: "Kognis", href: "/solucoes#kognis" },
        { label: "Spectra AI", href: "/solucoes#spectra-ai" },
      ],
    },
    {
      title: "Contato",
      links: [
        { label: "comercial@kalidash.com", href: "mailto:comercial@kalidash.com" },
        { label: "Belo Horizonte, MG" },
      ],
    },
    {
      title: "Termos de uso",
      links: [
        { label: "Privacidade", href: "/politica-privacidade.pdf", external: true },
        { label: "Divulgação responsável", href: "/politica-vulnerabilidades.pdf", external: true },
      ],
    },
  ] as FooterColumn[],
  copyright: "© 2026 Kalidash. Todos os direitos reservados.",
};
