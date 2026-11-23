import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Search } from 'lucide-react';
import { CATEGORY_META, CATEGORY_ORDER, categoryOf, findTag, groupTags, searchTags, suggestCategory } from '../lib/tagCatalog';
import type { CatalogTag, TagCategory } from '../lib/tagCatalog';
import TagChip from './TagChip';
import { openTagManager } from './TagsAdmin';

// Seletor de tags: lista as tags que já existem, agrupadas por categoria, com busca (por nome ou por categoria).
// Teclado: setas movem, Enter escolhe, Esc fecha. Leitores de tela: combobox + listbox com grupos nomeados.
// Se a tag digitada não existe e a criação é permitida, a última linha cria na categoria escolhida.

type Props = {
  anchor: HTMLElement | null;
  value: string[];
  options: string[];
  catalog: CatalogTag[];
  allowCreate?: boolean;
  /** Quando a lista só aceita uma categoria (tags de tarefa, função do contato): a nova tag nasce nela, sem perguntar. */
  fixedCategory?: TagCategory;
  /** Só estas categorias aparecem e podem ser criadas (ex.: tags de lead não oferecem tags de tarefa). Sem isso, todas. */
  categories?: TagCategory[];
  onPick: (name: string) => void;
  onCreate: (name: string, category: TagCategory) => void;
  onClose: () => void;
};

const WIDTH = 300;

export default function TagPicker({ anchor, value, options, catalog, allowCreate, fixedCategory, categories = CATEGORY_ORDER, onPick, onCreate, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [createCat, setCreateCat] = useState<TagCategory | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const available = useMemo(
    () => options.filter((o) => !value.some((v) => v.toLowerCase() === o.toLowerCase()) && categories.includes(categoryOf(o, catalog))),
    [options, value, categories, catalog],
  );
  const groups = useMemo(() => groupTags(searchTags(available, catalog, query), catalog), [available, catalog, query]);
  const flat = groups.flatMap((g) => g.tags);
  const typed = query.trim();
  const canCreate = Boolean(allowCreate && typed && !findTag([...options, ...value], typed));
  const guess = suggestCategory(typed);
  const category = fixedCategory ?? createCat ?? (categories.includes(guess) ? guess : 'GENERAL');
  const total = flat.length + (canCreate ? 1 : 0);

  // posição: embaixo do botão; se não couber, em cima
  useLayoutEffect(() => {
    const place = () => {
      if (!anchor) return;
      const r = anchor.getBoundingClientRect();
      const room = window.innerHeight - r.bottom;
      const top = room < 340 && r.top > room ? Math.max(8, r.top - 340) : r.bottom + 6;
      setPos({ top, left: Math.min(Math.max(8, r.left), window.innerWidth - WIDTH - 8) });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [anchor]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (boxRef.current && !boxRef.current.contains(t) && !anchor?.contains(t)) onClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [anchor, onClose]);

  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => { document.getElementById(`${listId}-opt-${active}`)?.scrollIntoView({ block: 'nearest' }); }, [active, listId]);

  const choose = (i: number) => {
    if (i < flat.length) onPick(flat[i]);
    else if (canCreate) onCreate(typed, category);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (total ? (a + 1) % total : 0)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (total ? (a - 1 + total) % total : 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (total) choose(active); }
  };

  let index = -1;
  const node = (
    <div ref={boxRef} className="tp" style={pos ? { top: pos.top, left: pos.left, width: WIDTH } : { visibility: 'hidden' }} onKeyDown={onKeyDown}>
      <div className="tp-search">
        <Search size={14} aria-hidden="true" />
        <input
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={total ? `${listId}-opt-${active}` : undefined}
          aria-label="Buscar tag por nome ou categoria"
          placeholder="Buscar tag ou categoria…"
          value={query}
          maxLength={40}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="tp-list" id={listId} role="listbox" aria-label="Tags">
        {groups.map((g) => (
          <div key={g.category} role="group" aria-label={CATEGORY_META[g.category].label} className="tp-group">
            <div className="tp-group-head" aria-hidden="true">{CATEGORY_META[g.category].label}<span>{g.tags.length}</span></div>
            {g.tags.map((t) => {
              index += 1;
              const i = index;
              return (
                <div key={t} id={`${listId}-opt-${i}`} role="option" aria-selected={active === i} className="tp-opt" data-active={active === i} onMouseEnter={() => setActive(i)} onClick={() => choose(i)}>
                  <TagChip name={t} category={g.category} />
                </div>
              );
            })}
          </div>
        ))}
        {flat.length === 0 && !canCreate && (
          <p className="tp-empty">{typed ? 'Nenhuma tag encontrada.' : available.length === 0 ? 'Todas as tags já estão aqui.' : 'Nenhuma tag.'}</p>
        )}
        {canCreate && (
          <div className="tp-create" role="group" aria-label="Criar tag">
            <div
              id={`${listId}-opt-${flat.length}`}
              role="option"
              aria-selected={active === flat.length}
              className="tp-opt tp-opt-create"
              data-active={active === flat.length}
              onMouseEnter={() => setActive(flat.length)}
              onClick={() => choose(flat.length)}
            >
              <Plus size={14} aria-hidden="true" /> Criar “{typed}”
            </div>
            {fixedCategory ? (
              <p className="tp-create-cat">Entra em <strong>{CATEGORY_META[fixedCategory].label}</strong></p>
            ) : <label className="tp-create-cat">
              <span>na categoria</span>
              <select className="select select-sm" value={category} aria-label="Categoria da nova tag" onChange={(e) => setCreateCat(e.target.value as TagCategory)} onKeyDown={(e) => e.stopPropagation()}>
                {categories.map((c) => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}
              </select>
            </label>}
          </div>
        )}
      </div>
      <div className="tp-foot">
        <span className="tp-hint" aria-hidden="true">↑ ↓ navegar · Enter escolhe · Esc fecha</span>
        <button type="button" className="tp-manage" onClick={() => { onClose(); openTagManager(); }}>Gerenciar tags</button>
      </div>
    </div>
  );
  return createPortal(node, document.body) as unknown as React.ReactElement;
}
