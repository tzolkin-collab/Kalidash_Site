import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronDown, Search, Tags } from 'lucide-react';
import { API_URL } from '../lib/api';
import { useCrmMode } from '../lib/crmMode';
import { editRecord } from '../lib/edit';
import { logChange, show } from '../lib/history';
import { pushErro, pushNotificacao } from '../lib/notify';
import { PRIORITY_OPTIONS, updateBody } from '../lib/opportunityApi';
import { createStore, useStore } from '../lib/store';
import { CATEGORY_META, CATEGORY_ORDER, categoryOf, groupTags, knownTags, searchTags, tagKey } from '../lib/tagCatalog';
import type { TagCategory } from '../lib/tagCatalog';
import { saveTagCategory, useTagCatalog } from '../lib/tagSync';
import { ENTITY_LABEL, FIELD_KIND_LABEL, buildChanges, fieldKindOf, finalAction, groupPlan, planMigration } from '../lib/tagMigration';
import type { Action, Choice, Group, Item, Target } from '../lib/tagMigration';
import { useOpportunities } from '../lib/useOpportunities';
import { leadsStore } from '../mocks/leads';
import { companiesStore, contactTagsStore, peopleStore } from '../mocks/people';
import { pipelinesStore } from '../mocks/pipelines';
import { tasksStore } from '../mocks/tasks';
import { PopupDialog, SidePanel } from './ui';
import TagChip from './TagChip';

// Gerenciar tags: abre como painel a partir das telas que usam tag (Leads, Pessoas, Oportunidades), não fica em
// Configurações. Mostra a lista de tags por categoria, com busca, uso e troca de categoria. Quando há tags que são
// na verdade campo (Novo, Urgente, Inbound…), aparece uma faixa "Revisar" no topo; nada muda sem confirmar.

/** Um só painel para o admin inteiro: qualquer tela abre com `openTagManager()`. O host fica no App. */
const openStore = createStore(false);
export const openTagManager = () => openStore.set(true);

/** Botão da barra de filtros das telas com tag. */
export function TagManagerButton() {
  return (
    <button type="button" className="btn btn-sm" onClick={openTagManager} title="Ver e organizar as tags por categoria">
      <Tags size={14} aria-hidden="true" /> Gerenciar tags
    </button>
  );
}

export function TagManagerHost() {
  const [open, setOpen] = useStore(openStore);
  // O painel é da tela que o abriu: trocar de tela (as rotas são por hash, lib/router.ts) fecha.
  useEffect(() => {
    if (!open) return;
    // Só o caminho conta: mudar o que vem depois do "?" (filtro, aba) não é trocar de tela.
    const screen = () => window.location.hash.split('?')[0];
    const from = screen();
    const close = () => { if (screen() !== from) setOpen(false); };
    window.addEventListener('hashchange', close);
    return () => window.removeEventListener('hashchange', close);
  }, [open, setOpen]);
  if (!open) return null;
  return <TagManagerPanel onClose={() => setOpen(false)} />;
}

const SUGGESTED_LABEL: Record<Action, string> = {
  MOVE: 'Mover para o campo',
  REMOVE: 'Tirar a tag',
  KEEP: 'Manter a tag',
};

const plural = (n: number, entity: Group['entity']) => `${n} ${n === 1 ? ENTITY_LABEL[entity].one : ENTITY_LABEL[entity].many}`;
const priorityName = (p?: string) => PRIORITY_OPTIONS.find((o) => o.value === p)?.label ?? p ?? '';

function TagManagerPanel({ onClose }: { onClose: () => void }) {
  const crmMode = useCrmMode();
  const api = crmMode === 'api';
  const { opportunities, loading, reload } = useOpportunities();
  const [leads] = useStore(leadsStore);
  const [people] = useStore(peopleStore);
  const catalog = useTagCatalog();
  const [contactTags] = useStore(contactTagsStore);
  const [tasks] = useStore(tasksStore);
  const [pipelines] = useStore(pipelinesStore);
  const [companies] = useStore(companiesStore);

  const [search, setSearch] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const targets = useMemo<Target[]>(() => [
    ...opportunities.filter((o) => !o.isLead).map((o): Target => ({ entity: 'opportunity', id: o.id, name: o.title, tags: o.tags ?? [], priority: o.priority || undefined })),
    ...leads.filter((l) => !l.archivedAt).map((l): Target => ({ entity: 'lead', id: l.id, name: l.name, tags: l.tags, origin: l.origin, sourceName: l.sourceName })),
    ...people.filter((p) => !p.archivedAt).map((p): Target => ({ entity: 'person', id: p.id, name: p.name, tags: p.tags })),
  ], [opportunities, leads, people]);

  // ---- tags que parecem campos ----
  const plan = useMemo(() => planMigration(targets), [targets]);
  const groups = useMemo(() => groupPlan(plan), [plan]);
  const groupOf = useMemo(() => {
    const m = new Map<Item, string>();
    for (const g of groups) for (const it of g.items) m.set(it, g.key);
    return m;
  }, [groups]);
  const decide = (item: Item): Action => finalAction(item, choices[groupOf.get(item) ?? ''] ?? 'SUGGESTED');
  const changes = useMemo(() => buildChanges(targets, plan, decide), [targets, plan, choices, groupOf]); // eslint-disable-line react-hooks/exhaustive-deps
  const movedPriorities = changes.filter((c) => c.patch.priority).length;
  const removedTags = changes.reduce((n, c) => n + c.removed.length, 0);
  const fieldTags = new Set(groups.map((g) => tagKey(g.tag))).size;

  const run = async () => {
    setBusy(true);
    let ok = 0;
    const failed: string[] = [];
    for (const c of changes) {
      try {
        if (c.entity === 'opportunity') {
          const o = opportunities.find((x) => x.id === c.id);
          if (!o) throw new Error('não encontrada');
          const body = updateBody(o, { tags: c.tags, ...(c.patch.priority ? { priority: c.patch.priority } : {}) });
          const res = await fetch(`${API_URL}/api/leads`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `erro ${res.status}`);
          logChange({ entity: 'opportunity', entityId: c.id, entityName: c.name, kind: 'edit', field: 'Tags', from: show(c.before), to: show(c.tags), note: 'Migração de tags para campos' });
          if (c.patch.priority) logChange({ entity: 'opportunity', entityId: c.id, entityName: c.name, kind: 'edit', field: 'Prioridade', from: show(priorityName(o.priority)), to: priorityName(c.patch.priority), note: 'Veio da tag' });
        } else if (c.entity === 'lead') {
          editRecord(leadsStore, c.id, { tags: c.tags }, { entity: 'lead', entityName: c.name, field: 'Tags', from: c.before, to: c.tags });
        } else {
          editRecord(peopleStore, c.id, { tags: c.tags }, { entity: 'person', entityName: c.name, field: 'Tags', from: c.before, to: c.tags });
        }
        ok += 1;
      } catch (err) {
        failed.push(`${c.name}: ${err instanceof Error ? err.message : 'falhou'}`);
      }
    }
    await reload();
    setBusy(false);
    setConfirming(false);
    setChoices({});
    setReviewing(false);
    if (failed.length) pushErro('Algumas alterações não foram salvas', failed.slice(0, 3).join(' · '));
    else pushNotificacao('Tags revisadas', `${ok} ${ok === 1 ? 'registro atualizado' : 'registros atualizados'}.`);
  };

  // ---- lista ----
  const usage = useMemo(() => {
    const m = new Map<string, number>();
    const bump = (tag: string) => { const k = tagKey(tag); if (k) m.set(k, (m.get(k) ?? 0) + 1); };
    for (const t of targets) for (const tag of new Set(t.tags.map(tagKey))) bump(tag);
    // Tag de tarefa e função do contato não moram em `tags`: contam as tarefas, os requisitos dos funis e os stakeholders.
    for (const t of tasks) bump(t.tag);
    for (const p of pipelines) for (const r of p.requirements) bump(r.tag);
    for (const c of companies) for (const s of c.stakeholders) bump(s.tag);
    return m;
  }, [targets, tasks, pipelines, companies]);
  const real = useMemo(() => knownTags(catalog, [...targets.flatMap((t) => t.tags), ...contactTags]).filter((n) => fieldKindOf(n) === null), [catalog, targets, contactTags]);
  const listGroups = useMemo(() => groupTags(searchTags(real, catalog, search), catalog), [real, catalog, search]);

  const setCategory = async (name: string, category: TagCategory) => {
    const err = await saveTagCategory(name, category, api);
    if (err) pushErro('Não foi possível guardar a categoria', `${err} Vale só nesta sessão.`);
  };

  return (
    <SidePanel
      title="Tags"
      subtitle={`${real.length} ${real.length === 1 ? 'tag' : 'tags'} em ${CATEGORY_ORDER.length} categorias. A categoria muda o desenho da tag e onde ela aparece no “+ Tag”.`}
      onClose={onClose}
    >
      <div className="tmg">
        {groups.length > 0 && (
          <section className="tmg-review" data-open={reviewing}>
            <button type="button" className="tmg-review-head" aria-expanded={reviewing} onClick={() => setReviewing((v) => !v)}>
              <span>
                <strong>{fieldTags} {fieldTags === 1 ? 'tag é campo' : 'tags são campo'}</strong>
                <span className="text-muted"> · status, prioridade ou origem anotados como tag</span>
              </span>
              <span className="tmg-review-cta">{reviewing ? 'Fechar' : 'Revisar'} <ChevronDown size={14} aria-hidden="true" /></span>
            </button>
            {reviewing && (
              <>
                <ul className="tmg-review-list">
                  {groups.map((g) => (
                    <li key={g.key} className="tmg-review-row">
                      <div className="tmg-review-what">
                        <TagChip name={g.tag} />
                        <ArrowRight size={13} aria-hidden="true" className="text-muted" />
                        <span className="tmg-field">{FIELD_KIND_LABEL[g.kind]}</span>
                        <span className="text-xs text-muted" title={g.items.map((i) => i.name).join(' · ')}>em {plural(g.items.length, g.entity)}</span>
                      </div>
                      <select
                        className="select select-sm"
                        aria-label={`O que fazer com “${g.tag}” em ${ENTITY_LABEL[g.entity].many}`}
                        title={g.note}
                        value={choices[g.key] ?? 'SUGGESTED'}
                        onChange={(e) => setChoices((c) => ({ ...c, [g.key]: e.target.value as Choice }))}
                      >
                        <option value="SUGGESTED">{SUGGESTED_LABEL[g.action]} (sugerido)</option>
                        {g.action !== 'REMOVE' && <option value="REMOVE">Tirar a tag</option>}
                        {g.action !== 'KEEP' && <option value="KEEP">Manter a tag</option>}
                      </select>
                    </li>
                  ))}
                </ul>
                <div className="tmg-review-foot">
                  <span className="text-xs text-muted">
                    {changes.length === 0 ? 'Nada marcado para mudar.' : `${changes.length} ${changes.length === 1 ? 'registro muda' : 'registros mudam'}. Fica no histórico de cada um.`}
                  </span>
                  <button type="button" className="btn btn-solid btn-sm" disabled={changes.length === 0 || busy} onClick={() => setConfirming(true)}>Aplicar</button>
                </div>
              </>
            )}
          </section>
        )}

        <label className="tmg-search">
          <Search size={14} aria-hidden="true" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar tag ou categoria…" aria-label="Buscar tag ou categoria" />
        </label>
        {!api && <p className="text-xs text-muted tmg-note">Modo de exemplo: as categorias valem só nesta sessão.</p>}

        {loading && real.length === 0 ? (
          <p className="text-sm text-muted">Carregando…</p>
        ) : listGroups.length === 0 ? (
          <p className="text-sm text-muted tmg-empty">{search ? 'Nenhuma tag com esse nome ou categoria.' : 'Ainda não há tags.'}</p>
        ) : listGroups.map((g) => (
          <section key={g.category} className="tmg-group" aria-label={CATEGORY_META[g.category].label}>
            <h3 className="tmg-group-head" title={CATEGORY_META[g.category].hint}>{CATEGORY_META[g.category].label}<span>{g.tags.length}</span></h3>
            <ul className="tmg-list">
              {g.tags.map((name) => {
                const n = usage.get(tagKey(name)) ?? 0;
                return (
                  <li key={name} className="tmg-row">
                    <TagChip name={name} category={g.category} />
                    <span className="tmg-use" title={n === 0 ? 'Sem uso' : `Usada ${n} ${n === 1 ? 'vez' : 'vezes'} (registros, tarefas, requisitos dos funis e funções de contato)`}>{n === 0 ? '—' : n}</span>
                    <select className="tmg-cat" aria-label={`Categoria de “${name}”`} value={categoryOf(name, catalog)} onChange={(e) => void setCategory(name, e.target.value as TagCategory)}>
                      {CATEGORY_ORDER.map((c) => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}
                    </select>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {confirming && (
        <PopupDialog
          title="Aplicar a revisão das tags?"
          tone="warning"
          description={`${changes.length} ${changes.length === 1 ? 'registro será alterado' : 'registros serão alterados'}: ${removedTags} ${removedTags === 1 ? 'tag sai' : 'tags saem'}${movedPriorities ? ` e ${movedPriorities} ${movedPriorities === 1 ? 'prioridade passa' : 'prioridades passam'} para o campo` : ''}. Para desfazer, é preciso recolocar a tag à mão.`}
          onClose={() => { if (!busy) setConfirming(false); }}
          footer={(
            <>
              <button type="button" className="btn" disabled={busy} onClick={() => setConfirming(false)}>Cancelar</button>
              <button type="button" className="btn btn-solid" disabled={busy} onClick={() => void run()}>{busy ? 'Aplicando…' : 'Aplicar'}</button>
            </>
          )}
        />
      )}
    </SidePanel>
  );
}
