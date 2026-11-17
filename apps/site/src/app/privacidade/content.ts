/* Política de Privacidade da Kalidash, transcrita do documento oficial (public/politica-privacidade.pdf).
 * O texto é jurídico: qualquer mudança aqui precisa vir de uma nova versão do documento da Kalidash,
 * e o PDF em public/ deve ser trocado junto. */

export type PolicyBlock = { p: string } | { list: string[] } | { item: { label: string; text: string } };

export interface PolicySection {
  id: string;
  title: string;
  blocks: PolicyBlock[];
}

export const policy = {
  company: "Kalidash Consultoria em Dados, Automação e IA Ltda.",
  lastUpdate: "Agosto de 2026",
  email: "privacidade@kalidash.com",
  dpo: "Iago Braz",
  pdf: "/politica-privacidade.pdf",
  sections: [
    {
      id: "introducao",
      title: "1. Introdução",
      blocks: [
        {
          p: "A Kalidash Consultoria em Dados, Automação e IA Ltda. ('Kalidash') está comprometida com a proteção dos dados pessoais de seus clientes, parceiros, colaboradores e terceiros, em conformidade com a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais — LGPD) e demais normas aplicáveis.",
        },
        {
          p: "Esta política descreve como coletamos, utilizamos, armazenamos, compartilhamos e protegemos dados pessoais no contexto dos nossos serviços de consultoria, implementação de soluções de dados, automação e inteligência artificial, bem como em nossas atividades educacionais.",
        },
      ],
    },
    {
      id: "quem-somos",
      title: "2. Quem Somos",
      blocks: [
        {
          p: "A Kalidash é uma consultoria especializada em dados, automação e inteligência artificial, com foco na economia real brasileira — indústria, distribuição, construção e serviços B2B. Atuamos na implementação de soluções de dados, automação de processos e inteligência artificial aplicada à operação dos nossos clientes.",
        },
        {
          p: "Também atuamos em educação corporativa e acadêmica, ministrando cursos, treinamentos e programas de pós-graduação em instituições parceiras.",
        },
      ],
    },
    {
      id: "dpo",
      title: "3. Encarregado de Proteção de Dados (DPO)",
      blocks: [
        { p: "O responsável pela proteção de dados pessoais na Kalidash é:" },
        {
          list: [
            "Nome: Iago Braz",
            "E-mail: privacidade@kalidash.com",
            "O DPO é o ponto de contato para questões relacionadas ao tratamento de dados pessoais, exercício de direitos dos titulares e comunicação com a Autoridade Nacional de Proteção de Dados (ANPD).",
          ],
        },
      ],
    },
    {
      id: "dados-coletados",
      title: "4. Dados Pessoais que Coletamos",
      blocks: [
        { p: "No contexto dos nossos serviços e atividades, podemos coletar e tratar os seguintes tipos de dados pessoais:" },
        {
          item: {
            label: "Dados de identificação e contato",
            text: "nome, e-mail, telefone, cargo e empresa, fornecidos voluntariamente por clientes, parceiros e alunos.",
          },
        },
        {
          item: {
            label: "Dados operacionais dos clientes",
            text: "informações coletadas durante a execução de projetos de consultoria, como gravações de áudio de reuniões operacionais, registros de processos, documentos e dados de sistemas dos clientes, conforme escopo contratual.",
          },
        },
        {
          item: {
            label: "Dados de navegação",
            text: "informações técnicas coletadas automaticamente em nosso site, como endereço IP, tipo de navegador e páginas acessadas, por meio de cookies e tecnologias similares.",
          },
        },
        {
          item: {
            label: "Dados educacionais",
            text: "informações de matrícula, participação e desempenho de alunos em cursos e treinamentos ministrados pela Kalidash ou em parceria com instituições de ensino.",
          },
        },
      ],
    },
    {
      id: "finalidade",
      title: "5. Finalidade do Tratamento",
      blocks: [
        { p: "Os dados pessoais são tratados para as seguintes finalidades:" },
        {
          list: [
            "Execução de contratos de prestação de serviços de consultoria, automação e inteligência artificial.",
            "Desenvolvimento e implementação de soluções tecnológicas para os clientes.",
            "Captura, processamento e estruturação de informações operacionais dos clientes para fins de gestão do conhecimento e melhoria de processos.",
            "Comunicação com clientes, parceiros e prospects sobre nossos serviços.",
            "Gestão de programas educacionais, cursos e treinamentos.",
            "Cumprimento de obrigações legais e regulatórias.",
            "Melhoria contínua dos nossos serviços e do nosso site.",
          ],
        },
      ],
    },
    {
      id: "base-legal",
      title: "6. Base Legal",
      blocks: [
        { p: "O tratamento de dados pessoais pela Kalidash se fundamenta nas seguintes bases legais previstas na LGPD:" },
        {
          list: [
            "Execução de contrato (Art. 7º, V): para o cumprimento das obrigações contratuais com clientes e parceiros.",
            "Legítimo interesse (Art. 7º, IX): para atividades de prospecção comercial, melhoria dos serviços e operações internas que não prejudiquem os direitos do titular.",
            "Consentimento (Art. 7º, I): quando aplicável, para coleta de dados específicos mediante autorização expressa do titular.",
            "Obrigação legal (Art. 7º, II): para cumprimento de obrigações legais ou regulatórias.",
          ],
        },
      ],
    },
    {
      id: "compartilhamento",
      title: "7. Compartilhamento de Dados",
      blocks: [
        { p: "Os dados pessoais podem ser compartilhados com:" },
        {
          list: [
            "Provedores de serviços de tecnologia: serviços de armazenamento em nuvem, plataformas de inteligência artificial e ferramentas de automação utilizados na prestação dos nossos serviços.",
            "Parceiros educacionais: instituições de ensino parceiras, quando necessário para a gestão de programas educacionais.",
            "Autoridades competentes: quando exigido por lei ou ordem judicial.",
            "Todos os provedores e parceiros são selecionados com base em sua conformidade com padrões de segurança e privacidade. Para transferências internacionais de dados, exigimos cláusulas contratuais padrão ou mecanismos equivalentes de proteção.",
          ],
        },
        { p: "A Kalidash não vende, aluga ou comercializa dados pessoais a terceiros." },
      ],
    },
    {
      id: "seguranca",
      title: "8. Segurança dos Dados",
      blocks: [
        {
          p: "A Kalidash adota medidas técnicas e administrativas para proteger os dados pessoais contra acesso não autorizado, destruição, perda, alteração ou divulgação indevida, incluindo:",
        },
        {
          list: [
            "Criptografia de dados em trânsito (HTTPS/TLS) e em repouso.",
            "Controle de acesso baseado em credenciais individuais e, quando aplicável, autenticação multifator (MFA).",
            "Firewalls e sistemas de detecção de intrusão nos sistemas e dispositivos utilizados.",
            "Atualizações automáticas de segurança em todos os sistemas.",
            "Acesso remoto exclusivamente via canais criptografados (VPN).",
            "Monitoramento contínuo da disponibilidade e integridade dos sistemas.",
            "Plano de resposta a incidentes de segurança documentado e atualizado.",
          ],
        },
      ],
    },
    {
      id: "retencao",
      title: "9. Retenção de Dados",
      blocks: [
        {
          p: "Os dados pessoais são retidos pelo período necessário para cumprir as finalidades para as quais foram coletados, respeitando os seguintes critérios:",
        },
        {
          list: [
            "Dados de projetos de consultoria: retidos enquanto vigente o contrato de prestação de serviços e, após o término, pelo prazo necessário para cumprimento de obrigações legais ou contratuais.",
            "Dados educacionais: retidos conforme exigência das instituições de ensino parceiras e da legislação educacional aplicável.",
            "Dados de navegação: retidos por até 12 meses.",
            "Após o término do prazo de retenção, os dados são eliminados de forma segura.",
          ],
        },
      ],
    },
    {
      id: "direitos",
      title: "10. Direitos dos Titulares",
      blocks: [
        { p: "Nos termos da LGPD, os titulares de dados pessoais têm os seguintes direitos:" },
        {
          list: [
            "Confirmação da existência de tratamento de dados pessoais.",
            "Acesso aos dados pessoais tratados.",
            "Correção de dados incompletos, inexatos ou desatualizados.",
            "Anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos.",
            "Portabilidade dos dados a outro fornecedor de serviço, quando aplicável.",
            "Eliminação dos dados pessoais tratados com consentimento do titular.",
            "Informação sobre o compartilhamento de dados com terceiros.",
            "Informação sobre a possibilidade de não fornecer consentimento e as consequências da negativa.",
            "Revogação do consentimento, quando aplicável.",
            "Para exercer qualquer desses direitos, entre em contato com nosso DPO pelo e-mail privacidade@kalidash.com. As solicitações serão atendidas em até 15 dias úteis.",
          ],
        },
      ],
    },
    {
      id: "cookies",
      title: "11. Cookies",
      blocks: [
        {
          p: "Nosso site pode utilizar cookies e tecnologias similares para melhorar a experiência de navegação, analisar tráfego e personalizar conteúdo. O visitante pode configurar seu navegador para recusar cookies, embora isso possa afetar a funcionalidade do site.",
        },
      ],
    },
    {
      id: "alteracoes",
      title: "12. Alterações nesta Política",
      blocks: [
        {
          p: "Esta política pode ser atualizada periodicamente para refletir mudanças nos nossos processos de tratamento de dados ou na legislação aplicável. A versão mais recente estará sempre disponível nesta página.",
        },
        { p: "Última atualização: Agosto de 2026." },
      ],
    },
    {
      id: "contato",
      title: "13. Contato",
      blocks: [
        { p: "Para dúvidas, solicitações ou reclamações sobre o tratamento de dados pessoais pela Kalidash:" },
        {
          list: [
            "Kalidash Consultoria em Dados, Automação e IA LTDA.",
            "E-mail: privacidade@kalidash.com",
            "DPO: Iago Braz",
          ],
        },
      ],
    },
  ] as PolicySection[],
};
