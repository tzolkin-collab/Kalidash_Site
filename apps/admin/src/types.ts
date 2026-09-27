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
  ownerName?: string;
  ownerAvatar?: string;
};
