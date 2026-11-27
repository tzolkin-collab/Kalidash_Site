// Regras puras dos criativos (sem rede), testadas em tests/creatives.test.ts.

/** O utm_content é deste criativo? */
export const belongsTo = (utmContent: string, id: string): boolean => utmContent === id || utmContent.endsWith(`_${id}`);

/** Leads cuja última campanha veio de um link do criativo. */
export function creativeLeads<T extends { archivedAt?: string; customData?: Record<string, unknown> }>(leads: T[], id: string): T[] {
  return leads.filter((l) => {
    const a = l.customData?.attribution;
    if (l.archivedAt || !a || typeof a !== 'object') return false;
    const content = (a as Record<string, unknown>).utm_content;
    return typeof content === 'string' && belongsTo(content, id);
  });
}

/** Onde o link pode ser clicado em cada lugar: a legenda do Instagram não abre link. */
export function placementTip(channelId: string): string {
  if (channelId === 'ig-bio') return 'Troque o link da bio por este e escreva "link na bio" na legenda.';
  if (channelId === 'ig-stories') return 'No stories, use o adesivo de link e cole este endereço.';
  if (channelId === 'ig-comentario' || channelId === 'ig-dm') return 'Envie este link na resposta por direct. Em comentário e legenda ele não vira clique.';
  return '';
}

/** O texto para colar: legenda e link, ou só o link quando não há legenda. */
export const captionWithLink = (caption: string, link: string): string => (caption.trim() ? `${caption.trim()}\n\n${link}` : link);
