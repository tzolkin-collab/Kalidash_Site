import { Briefcase, CalendarDays, X } from 'lucide-react';
import { CATEGORY_META, categoryOf } from '../lib/tagCatalog';
import type { TagCategory } from '../lib/tagCatalog';
import { useTagCatalog } from '../lib/tagSync';

// A tag desenhada pela categoria, para dar para distinguir sem ler:
//   Perfil do cliente → bloco arredondado cheio, roxo, com maleta (B2B, Enterprise…)
//   Evento            → rótulo em forma de ingresso, âmbar, com calendário (Feira, Webinar…)
//   Geral             → pílula cinza simples
// Status, prioridade e origem não são tags: têm o próprio selo (components/FieldBadge.tsx), e a etapa do funil
// mantém o contorno colorido com ícone (StageBadge, components/cells.tsx).

const ICON = { PROFILE: Briefcase, EVENT: CalendarDays } as const;

export default function TagChip({ name, category, onRemove, title }: { name: string; category?: TagCategory; onRemove?: () => void; title?: string }) {
  const catalog = useTagCatalog();
  const cat = category ?? categoryOf(name, catalog);
  const Icon = cat === 'PROFILE' || cat === 'EVENT' ? ICON[cat] : null;
  return (
    <span className="tagc" data-cat={cat} title={title ?? `${CATEGORY_META[cat].label}: ${name}`}>
      {Icon && <Icon size={11} aria-hidden="true" className="tagc-icon" />}
      <span className="tagc-text">{name}</span>
      {onRemove && (
        <button type="button" className="tagc-x" onClick={onRemove} aria-label={`Remover ${name}`}><X size={11} /></button>
      )}
    </span>
  );
}
