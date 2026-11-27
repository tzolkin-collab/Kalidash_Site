import { Briefcase, CalendarDays, ListChecks, UserRound, X } from 'lucide-react';
import { CATEGORY_META, categoryOf } from '../lib/tagCatalog';
import type { TagCategory } from '../lib/tagCatalog';
import { useTagCatalog } from '../lib/tagSync';

// A tag desenhada pela categoria, para dar para distinguir sem ler:
//   Perfil do cliente → bloco arredondado cheio, roxo, com maleta (B2B, Enterprise…)
//   Evento            → rótulo em forma de ingresso, âmbar, com calendário (Feira, Webinar…)
//   Tarefa            → etiqueta com canto dobrado, verde-azulado, com lista (Comercial, Dados da empresa…)
//   Função do contato → pílula contornada com o círculo de pessoa, azul-acinzentado (Decisor, Financeiro…)
//   Geral             → pílula cinza simples
// Status, prioridade e origem não são tags: têm o próprio selo (components/FieldBadge.tsx), e a etapa do funil
// mantém o contorno colorido com ícone (StageBadge, components/cells.tsx).

const ICON = { PROFILE: Briefcase, EVENT: CalendarDays, TASK: ListChecks, ROLE: UserRound } as const;

export default function TagChip({ name, category, onRemove, removeDisabled, removeTitle, title }: { name: string; category?: TagCategory; onRemove?: () => void; removeDisabled?: boolean; removeTitle?: string; title?: string }) {
  const catalog = useTagCatalog();
  const cat = category ?? categoryOf(name, catalog);
  const Icon = cat === 'GENERAL' ? null : ICON[cat];
  return (
    <span className="tagc" data-cat={cat} title={title ?? `${CATEGORY_META[cat].label}: ${name}`}>
      {Icon && <Icon size={11} aria-hidden="true" className="tagc-icon" />}
      <span className="tagc-text">{name}</span>
      {onRemove && (
        <button type="button" className="tagc-x" disabled={removeDisabled} title={removeTitle ?? `Remover ${name}`} onClick={onRemove} aria-label={`Remover ${name}`}><X size={11} /></button>
      )}
    </span>
  );
}
