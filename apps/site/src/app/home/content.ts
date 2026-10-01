/* Conteúdo da Home — textos, links e imagens num lugar só.
 * O visual vive em home.module.css; aqui só muda o que é palavra, link e foto.
 * Itens marcados com PENDENTE são placeholders: faltava a informação no design/briefing. */

export const config = {
  /** PENDENTE: para onde vão os leads do formulário (webhook ou rota da API). Sem isto o
   *  formulário valida, mas avisa que o envio ainda não está conectado. */
  leadEndpoint: process.env.NEXT_PUBLIC_LEAD_ENDPOINT ?? "",
  /** PENDENTE: link do WhatsApp (https://wa.me/55DDDNUMERO). Vazio = o botão leva ao formulário. */
  whatsappUrl: process.env.NEXT_PUBLIC_WHATSAPP_URL ?? "",
  social: {
    // O @ aparece na tela do slide da foto da imersão; confirmar com a Carol.
    instagram: "https://instagram.com/kalidash.metrics",
    /** PENDENTE: vazio = o ícone não aparece. */
    facebook: "",
    youtube: "",
  },
};

export const nav = [
  { label: "Para empresas", href: "#para-empresas", chevron: true },
  { label: "Sobre nós", href: "#sobre" },
  { label: "Cases", href: "#cases" },
  { label: "Blog", href: "/blog" },
  { label: "Produtos", href: "#produtos", chevron: true },
  { label: "Contato", href: "#diagnostico" },
];

export const hero = {
  chip: { emoji: "🧠", before: "Consultoria em", after: "dados, automação e IA aplicada" },
  title: "Transforme dados, processos e tecnologia em eficiência operacional",
  text: "A Kalidash entende os desafios da sua operação, organiza a base e implementa soluções que conectam sistemas, automatizam rotinas e melhoram decisões. Da estratégia à execução, com método, clareza e impacto mensurável.",
};

export const problem = {
  watermark: "Falta de controle",
  title: "O problema raramente é falta de tecnologia. É falta de conexão.",
  text: "Quando dados, sistemas e processos não trabalham juntos, a execução trava, o retrabalho aumenta e as decisões demoram. Sua empresa enfrenta alguma das situações abaixo?",
  cards: [
    { icon: "chart", title: ["Dados", "dispersos"], text: "Dados espalhados atrasam decisões e colocam os números em dúvida." },
    { icon: "database", title: ["Sistemas", "desconectados"], text: "Sistemas isolados atrasam informações e quebram o fluxo da operação." },
    { icon: "share", title: ["Decisões", "sem visão"], text: "Dados desorganizados fazem sua empresa reagir, em vez de se antecipar." },
  ],
  quote: {
    text: "Nosso time perdia horas com tarefas manuais e retrabalho. Hoje, os processos fluem e focamos no que realmente importa.",
    author: "Aline Motta",
    role: "empresária",
  },
};

export const testimonial = {
  chip: { emoji: "🤝", before: "Alguns dos nossos", after: "clientes atendidos" },
  before: "Entregaram ",
  strong: "além da nossa expectativa",
  after: " e também do acordo. É assim que você surpreende clientes.",
  author: "André",
  role: "CMO da Tô Garantido",
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

export const journey = {
  title: ["Do desafio à", "solução em operação"],
  text: "Em 3 frentes: entendemos o negócio, estruturamos a solução e executamos com dados, automação e IA.",
  watermarkLeft: "Evolução na prática",
  watermarkRight: "contínua",
  // O design mostra 1 slide (Inteligência de dados); as frentes 2 e 3 foram escritas com as palavras
  // da própria Kalidash (slide da imersão e texto de abertura). PENDENTE: a Carol aprovar ou trocar.
  slides: [
    {
      eyebrow: "Inteligência de dados",
      title: "Decisões começam com dados confiáveis",
      text: "Integramos fontes, organizamos a base e criamos dashboards que transformam indicadores dispersos em uma visão clara da operação.",
      strong: "Menos dúvida. Mais decisão.",
      link: { label: "Ver mais detalhes", href: "#diagnostico" },
      image: { src: "/home/tablet.jpg", alt: "Mãos segurando um tablet com um dashboard de dados" },
    },
    {
      eyebrow: "Automação de processos",
      title: "Rotinas que fluem sem retrabalho",
      text: "Conectamos sistemas e automatizamos as tarefas manuais e repetitivas, para o time focar no que realmente importa.",
      strong: "Menos retrabalho. Mais fluidez.",
      link: { label: "Ver mais detalhes", href: "#diagnostico" },
      image: { src: "/home/evento-mesa.jpg", alt: "Equipe trabalhando em notebooks ao redor de uma mesa" },
    },
    {
      eyebrow: "IA aplicada",
      title: "IA que potencializa pessoas",
      text: "Aplicamos inteligência artificial com governança e segurança, para ampliar a produtividade das equipes, e não para substituí-las.",
      strong: "Mesmo time. Mais resultado.",
      link: { label: "Ver mais detalhes", href: "#diagnostico" },
      image: { src: "/home/evento-ai-os.jpg", alt: "Tela com o framework AI Business OS da Kalidash" },
    },
  ],
};

export const method = {
  title: ["Método validado", "para fazer acontecer"],
  text: "Criamos um método que já foi validado por centenas de empresários. Cada projeto avança com diagnóstico, etapas claras e acompanhamento próximo, da primeira decisão ao resultado.",
  link: { label: "Conheça o método", href: "#diagnostico" },
  image: { src: "/home/metodo-reuniao.jpg", alt: "Equipe em reunião olhando um gráfico de resultados" },
  avatars: ["/home/avatar-1.jpg", "/home/avatar-2.jpg", "/home/avatar-3.jpg", "/home/avatar-4.jpg"],
};

export const cases = {
  title: ["Transformação que", "acontece de verdade"],
  text: "Operação, treinamentos e pessoas reais. Aqui, cada imagem mostra a Kalidash fazendo acontecer ao lado dos clientes.",
  link: { label: "Conheça nossos cases", href: "#cases" },
  // Legendas descritivas do que cada foto mostra (a 1ª vem do design). PENDENTE: a Carol confirmar
  // ou trocar por títulos de cases reais (cliente, evento, resultado).
  items: [
    {
      src: "/home/evento-palestra.jpg",
      alt: "Apresentação da Kalidash em uma imersão presencial",
      title: "Imersão Kalidash",
      text: "A nossa imersão presencial foi exatamente sobre isso: colocar a mão na massa, destravar processos e construir soluções reais lado a lado.",
    },
    {
      src: "/home/evento-sala.jpg",
      alt: "Sala de treinamento com participantes e telas",
      title: "Treinamento em sala",
      text: "Equipes acompanham a apresentação nas telas e praticam nos próprios notebooks, com o time da Kalidash ao lado.",
    },
    {
      src: "/home/evento-mesa.jpg",
      alt: "Equipe trabalhando em notebooks ao redor de uma mesa",
      title: "Prática com a equipe",
      text: "Atividades guiadas, direto nos processos da operação do cliente, para sair da sessão com solução funcionando.",
    },
    {
      src: "/home/cooxupe.jpg",
      alt: "Equipe reunida na escadaria da Cooxupé",
      title: "Cooxupé",
      text: "Atuação presencial junto ao time da Cooxupé, em Guaxupé (MG).",
    },
    {
      src: "/home/evento-ai-os.jpg",
      alt: "Tela com o framework AI Business OS da Kalidash",
      title: "AI Business OS",
      text: "O framework em três camadas que levamos às imersões: contexto, dados e inteligência.",
    },
  ],
};

export const diagnostico = {
  chip: { before: "Fale com o nosso", emoji: "🤝", after: "time de especialistas" },
  title: ["Agende seu Diagnóstico", "Estratégico"],
  highlight: "Gratuito",
  text: "Preencha os campos abaixo e nossa equipe entrará em contato em até 24h para agendar a melhor data para sua sessão.",
  strongBefore: "É o ",
  strong: "primeiro passo para unificar sua operação.",
  fields: {
    name: "Nome e Sobrenome*",
    email: "Seu melhor email corporativo*",
    phone: "Whatsapp com DD*",
    challenge: "Qual o seu maior desafio com dados hoje?",
    submit: "Enviar",
  },
};

export const footer = {
  text: "Especialista em soluções para empresas que querem melhorar o desempenho e tomar as melhores decisões",
  columns: [
    {
      title: "A Kalidash",
      links: [
        { label: "O que fazemos", href: "#sobre" },
        { label: "Blog", href: "/blog" },
        { label: "Contato", href: "#diagnostico" },
      ],
    },
    {
      title: "Produtos",
      links: [
        { label: "Para empresas", href: "#para-empresas" },
        { label: "Diagnóstico", href: "#diagnostico" },
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
