/* Conteúdo da Home — fonte de verdade para textos, links e imagens.
 * Copy atualizada em 09/10/2026 a partir do documento aprovado pela Kalidash. */

export const config = {
  leadEndpoint: process.env.NEXT_PUBLIC_LEAD_ENDPOINT ?? "",
  // Links enviados pela Kalidash em 02/10/2026. O WhatsApp pode ser trocado por variável de ambiente.
  whatsappUrl: process.env.NEXT_PUBLIC_WHATSAPP_URL ?? "https://wa.link/9b5sl1",
  social: {
    instagram: "https://www.instagram.com/kalidash.ai/",
    linkedin: "https://www.linkedin.com/company/kalidash/",
    youtube: "https://www.youtube.com/@KalidashIA",
    facebook: "",
  },
};

export const nav = [
  { label: "O desafio", href: "#desafio" },
  { label: "O que fazemos", href: "#o-que-fazemos" },
  { label: "Experiência", href: "#experiencia" },
  { label: "Cases", href: "#cases" },
  { label: "Blog", href: "/blog" },
  { label: "Contato", href: "#diagnostico" },
];

export const hero = {
  eyebrow: "Aceleradora de eficiência operacional",
  title: "Prepare sua operação para a era dos agentes.",
  paragraphs: [
    "A Inteligência Artificial está deixando de apenas responder para também executar tarefas e participar de processos.",
    "A Kalidash prepara pessoas, processos e tecnologia para essa mudança, conectando agentes, automação e novas formas de trabalhar à operação real da empresa, para gerar eficiência e escala de verdade.",
  ],
  primaryCta: { label: "Preparar minha operação", href: "#diagnostico" },
  secondaryCta: { label: "Conhecer a Kalidash", href: "#experiencia" },
  stats: [
    { value: "+10 mil", label: "pessoas capacitadas" },
    { value: "170", label: "operações atendidas" },
    { value: "+500", label: "pessoas por operação" },
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
  watermark: "Falta de controle",
  title: "O problema não é apenas tecnológico.",
  subtitle: "É operacional. É cultural. É humano.",
  text: "Quando pessoas, processos e tecnologia não trabalham juntos, a execução trava e as decisões demoram. Ferramenta nova não resolve isso: muda-se o jeito de trabalhar.",
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
      text: "Pessoas, processos e tecnologia trabalhando em ritmos diferentes.",
    },
  ],
};

export const fronts = {
  eyebrow: "O que fazemos",
  title: "Nem toda empresa começa no mesmo lugar.",
  paragraphs: [
    "Algumas precisam preparar as pessoas. Outras precisam identificar onde existe potencial de eficiência. Outras já sabem o que fazer e precisam de capacidade para colocar em prática.",
    "Por isso, a Kalidash atua em três frentes que podem funcionar de forma independente ou integrada.",
  ],
  items: [
    {
      number: "01",
      name: "AI Culture",
      title: "Prepare seu time para uma nova forma de trabalhar.",
      text: "O programa de treinamento corporativo em IA e cultura de IA para grandes operações. Mais do que ensinar ferramentas, desenvolvemos repertório, autonomia e novos hábitos de trabalho para que as pessoas incorporem IA à rotina e passem a identificar oportunidades de melhoria por conta própria.",
      closing: "Capacitação é onde a transformação começa.",
      link: { label: "Conheça os treinamentos", href: "#diagnostico" },
      image: { src: "/home/evento-palestra.jpg", alt: "Treinamento corporativo conduzido pela Kalidash" },
    },
    {
      number: "02",
      name: "Advisory",
      title: "Transforme sem perder o rumo.",
      text: "Acompanhamos a liderança na implementação da inovação com governança, ajudando a priorizar, decidir, medir e manter a transformação conectada aos objetivos do negócio.",
      closing: "Advisory é onde a transformação ganha direção e continuidade.",
      link: { label: "Conheça o Advisory", href: "#diagnostico" },
      image: { src: "/home/metodo-reuniao.jpg", alt: "Liderança acompanhando indicadores com a Kalidash" },
    },
    {
      number: "03",
      name: "Execução",
      title: "Quando a transformação precisa sair do papel.",
      text: "Entramos na operação para implementar agentes, automações, integrações, dados e soluções de IA quando a empresa precisa de capacidade adicional para fazer acontecer.",
      closing: "Execução transforma estratégia em operação.",
      link: { label: "Conheça a Execução", href: "#diagnostico" },
      image: { src: "/home/evento-ai-os.jpg", alt: "Framework de agentes e operação da Kalidash" },
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
  link: { label: "Conheça nossos cases", href: "#cases" },
  image: { src: "/home/cooxupe.jpg", alt: "Equipe reunida na escadaria da Cooxupé" },
};

export const testimonial = {
  eyebrow: "Quem viveu a transformação",
  title: "O que muda quando a tecnologia chega ao trabalho real.",
  quote: "Entregaram além da nossa expectativa e também do acordo. É assim que você surpreende clientes.",
  author: "André",
  role: "CMO da Tô Garantido",
};

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

export const footer = {
  text: "Preparamos pessoas, processos e tecnologia para a era dos agentes.",
  columns: [
    {
      title: "A Kalidash",
      links: [
        { label: "O que fazemos", href: "#o-que-fazemos" },
        { label: "Experiência", href: "#experiencia" },
        { label: "Blog", href: "/blog" },
      ],
    },
    {
      title: "Contato",
      links: [
        { label: "Diagnóstico", href: "#diagnostico" },
        { label: "Cases", href: "#cases" },
      ],
    },
    {
      title: "Termos de uso",
      links: [
        { label: "Privacidade", href: "/politica-privacidade.pdf", external: true },
        { label: "Divulgação responsável", href: "/politica-vulnerabilidades.pdf", external: true },
      ],
    },
  ],
  copyright: "© 2026 Kalidash. Todos os direitos reservados.",
};
