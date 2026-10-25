export type Note = {
  id: string;
  content: string;
  type: string;
  created_at: string;
  authorName?: string;
  authorAvatar?: string;
};

export type Opportunity = {
  id: string;
  title: string;
  value: number;
  stage: string;
  priority: string;
  tags: string[];
  pipeline?: string;
  created_at?: string;
  /** Quando foi para Ganho (a API grava ao mover; nula em oportunidades abertas). */
  wonAt?: string | null;
  /** Só no front: linha de lead exibida junto das oportunidades ("Ver leads"). */
  isLead?: boolean;
  /** Criada no protótipo (qualificar um lead ou o formulário de nova oportunidade): não existe na API. */
  isSample?: boolean;
  origin?: 'INBOUND' | 'OUTBOUND';
  leadId?: string;
  ownerName?: string;

  // Campos personalizados: variáveis de um jsonb (a API ainda não os envia).
  customData?: Record<string, unknown>;

  // Relacionais (B2C / B2B)
  companyId?: string;
  companyName?: string;
  companyLogo?: string;

  contactId?: string;
  contactName?: string;
  contactAvatar?: string;

  ownerId?: string;
  /** Responsável na equipe (id do membro, com o login e o CRM ligados). ownerId é o vínculo antigo. */
  ownerMemberId?: string;
  ownerAvatar?: string;
};
