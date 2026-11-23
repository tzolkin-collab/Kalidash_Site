import { isSiteSource, shortSource } from '../lib/sourceName';

/** Fonte do lead em forma curta, com o ícone do site (public/site-icon.svg, o mesmo do site) quando vem do site. O nome completo fica no title. */
export default function SourceName({ name, prefix }: { name: string; prefix?: string }) {
  return (
    <span title={name} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
      {isSiteSource(name) && <img src="/site-icon.svg" alt="" width={14} height={14} style={{ flexShrink: 0, borderRadius: 3 }} />}
      <span>{prefix}{shortSource(name)}</span>
    </span>
  );
}
