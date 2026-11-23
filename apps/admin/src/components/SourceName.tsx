import { Compass, UserPlus } from 'lucide-react';
import type { LeadOrigin } from '../domain';
import { isSiteSource, shortSource } from '../lib/sourceName';
import { SourceBadge } from './FieldBadge';

/**
 * Origem do lead num selo só: "Inbound · Formulário da LP" ou "Outbound · Iago Braz" (quem trouxe).
 * Ícone: o do site (public/site-icon.svg) quando vem do site, bússola no inbound, pessoa no outbound.
 * O texto longo é cortado no selo; o nome completo fica no title.
 */
export default function SourceName({ name, origin }: { name: string; origin: LeadOrigin }) {
  const inbound = origin === 'INBOUND';
  const icon = inbound && isSiteSource(name)
    ? <img src="/site-icon.svg" alt="" width={12} height={12} style={{ flexShrink: 0, borderRadius: 3 }} />
    : inbound ? <Compass size={11} aria-hidden="true" className="tagc-icon" /> : <UserPlus size={11} aria-hidden="true" className="tagc-icon" />;
  const label = inbound ? 'Inbound' : 'Outbound';
  const who = name?.trim();
  const title = who ? (inbound ? `Inbound. Fonte: ${who}` : `Outbound. Trazido por: ${who}`) : label;
  return <SourceBadge title={title} icon={icon}>{label}{who && <> · {inbound ? shortSource(who) : who}</>}</SourceBadge>;
}
