import { isSiteSource, shortSource } from '../lib/sourceName';
import { SourceBadge } from './FieldBadge';

/** Fonte do lead em forma curta, no selo de Origem, com o ícone do site (public/site-icon.svg) quando vem do site. O nome completo fica no title. */
export default function SourceName({ name, prefix }: { name: string; prefix?: string }) {
  const icon = isSiteSource(name) ? <img src="/site-icon.svg" alt="" width={12} height={12} style={{ flexShrink: 0, borderRadius: 3 }} /> : undefined;
  return <SourceBadge title={name} icon={icon}>{prefix}{shortSource(name)}</SourceBadge>;
}
