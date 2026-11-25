import { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { API_URL } from '../lib/api';
import { useCrmMode } from '../lib/crmMode';
import { editRecord } from '../lib/edit';
import { logChange, show } from '../lib/history';
import { pushErro, pushNotificacao } from '../lib/notify';
import { PRIORITY_OPTIONS, updateBody } from '../lib/opportunityApi';
import { useStore } from '../lib/store';
import { CATEGORY_META, CATEGORY_ORDER, categoryOf, groupTags, knownTags, searchTags, tagKey } from '../lib/tagCatalog';
import type { TagCategory } from '../lib/tagCatalog';
import { saveTagCategory, useTagCatalog } from '../lib/tagSync';
import { ENTITY_LABEL, FIELD_KIND_LABEL, buildChanges, fieldKindOf, finalAction, groupPlan, planMigration } from '../lib/tagMigration';
import type { Action, Choice, Group, Item, Target } from '../lib/tagMigration';
import { useOpportunities } from '../lib/useOpportunities';
import { leadsStore } from '../mocks/leads';
import { peopleStore } from '../mocks/people';
import { Badge, EmptyState, PopupDialog } from './ui';
import TagChip from './TagChip';

// Aba "Tags" de Configurações. Duas partes:
//  1. Tags que parecem campos (Novo, Urgente, Inbound…): propõe passar para o campo certo ou só tirar a tag. Nada muda
//     sem a pessoa confirmar cada grupo; tudo fica no histórico do registro.
//  2. Catálogo: todas as tags que existem, por categoria (Perfil do cliente, Evento, Geral), com busca e contagem de uso.

const SUGGESTED_LABEL: Record<Action, string> = {
  MOVE: 'Mover para o campo e tirar a tag',
  REMOVE: 'Tirar a tag (o campo já diz isso)',
  KEEP: 'Manter a tag (sugestão)',
};

const plural = (n: number, entity: Group['entity']) => `${n} ${n === 1 ? ENTITY_LABEL[entity].one : ENTITY_LABEL[entity].many}`;
const priorityName = (p?: string) => PRIORITY_OPTIONS.find((o) => o.value === p)?.label ?? p ?? '';

export default function TagsAdmin() {
  const crmMode = useCrmMode();
  const api = crmMode === 'api';
  const { opportunities, loading, reload } = useOpportunities();
  const [leads] = useStore(leadsStore);
  const [people] = useStore(peopleStore);
  const catalog = useTagCatalog();

  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: number; failed: string[] } | null>(null);
  const [search, setSearch] = useState('');

  const targets = useMemo<Target[]>(() => [
    ...opportunities.filter((o) => !o.isLead).map((o): Target => ({ entity: 'opportunity', id: o.id, name: o.title, tags: o.tags ?? [], priority: o.priority || undefined })),
    ...leads.filter((l) => !l.archivedAt).map((l): Target => ({ entity: 'lead', id: l.id, name: l.name, tags: l.tags, origin: l.origin, sourceName: l.sourceName })),
    ...people.filter((p) => !p.archivedAt).map((p): Target => ({ entity: 'person', id: p.id, name: p.name, tags: p.tags })),
  ], [opportunities, leads, people]);

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

  // ---- aplicar ----
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
    setResult({ ok, failed });
    if (failed.length) pushErro('Algumas alterações não foram salvas', failed.slice(0, 3).join(' · '));
    else pushNotificacao('Tags migradas', `${ok} ${ok === 1 ? 'registro atualizado' : 'registros atualizados'}.`);
  };

  // ---- catálogo ----
  const usage = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of targets) for (const tag of new Set(t.tags.map(tagKey))) m.set(tag, (m.get(tag) ?? 0) + 1);
    return m;
  }, [targets]);
  const real = useMemo(() => knownTags(catalog, targets.flatMap((t) => t.tags)).filter((n) => fieldKindOf(n) === null), [catalog, targets]);
  const catalogGroups = useMemo(() => groupTags(searchTags(real, catalog, search), catalog), [real, catalog, search]);

  const setCategory = async (name: string, category: TagCategory) => {
    const err = await saveTagCategory(name, category, api);
    if (err) pushErro('Não foi possível guardar a categoria', `${err} Vale só nesta sessão.`);
  };

  return (
    <div className="settings-pane form-stack">
      {/* ---- 1. Tags que parecem campos ---- */}
      <section className="panel-card">
        <h2 className="section-title" style={{ margin: '0 0 4px', fontSize: 16 }}>Tags que parecem campos</h2>
        <p className="text-sm text-muted" style={{ margin: '0 0 16px' }}>
          Status, prioridade e origem têm campo próprio e não deveriam ser tag. Tag é para descrever o contato, como B2B ou Evento. Abaixo, o que encontrei e o que sugiro para cada caso. Nada muda sem você aplicar, e cada mudança fica no histórico do registro.
        </p>

        {loading && groups.length === 0 ? (
          <p className="text-sm text-muted">Procurando nas oportunidades, leads e pessoas…</p>
        ) : groups.length === 0 ? (
          <EmptyState title="Nenhuma tag parece campo">Todas as tags em uso descrevem o contato. Não há nada para migrar.</EmptyState>
        ) : (
          <>
            <ul className="row-list" style={{ margin: 0 }}>
              {groups.map((g) => (
                <li key={g.key} className="row-item tm-row">
                  <div className="tm-main">
                    <div className="tm-head">
                      <TagChip name={g.tag} />
                      <Badge tone="neutral">{FIELD_KIND_LABEL[g.kind]}</Badge>
                      <span className="text-sm">em <strong>{plural(g.items.length, g.entity)}</strong></span>
                    </div>
                    <span className="text-xs text-muted">{g.note}</span>
                    <details className="tm-records">
                      <summary className="text-xs">Ver {g.items.length === 1 ? 'o registro' : 'os registros'}</summary>
                      <span className="text-xs text-muted">{g.items.map((i) => i.name).join(' · ')}</span>
                    </details>
                  </div>
                  <select
                    className="select select-sm tm-choice"
                    aria-label={`O que fazer com “${g.tag}” em ${ENTITY_LABEL[g.entity].many}`}
                    value={choices[g.key] ?? 'SUGGESTED'}
                    onChange={(e) => setChoices((c) => ({ ...c, [g.key]: e.target.value as Choice }))}
                  >
                    <option value="SUGGESTED">{SUGGESTED_LABEL[g.action]}</option>
                    {g.action !== 'REMOVE' && <option value="REMOVE">Só tirar a tag</option>}
                    {g.action !== 'KEEP' && <option value="KEEP">Manter a tag</option>}
                  </select>
                </li>
              ))}
            </ul>
            <div className="tm-footer">
              <span className="text-sm">
                {changes.length === 0
                  ? 'Nada marcado para mudar.'
                  : <><strong>{changes.length} {changes.length === 1 ? 'registro' : 'registros'}</strong> {changes.length === 1 ? 'será alterado' : 'serão alterados'}: {removedTags} {removedTags === 1 ? 'tag sai' : 'tags saem'}{movedPriorities ? `, ${movedPriorities} ${movedPriorities === 1 ? 'prioridade passa' : 'prioridades passam'} para o campo` : ''}.</>}
              </span>
              <button type="button" className="btn btn-solid" disabled={changes.length === 0 || busy} onClick={() => setConfirming(true)}>Aplicar…</button>
            </div>
          </>
        )}
        {result && (
          <div className="notice" role="status" style={{ marginTop: 12 }}>
            <span><Check size={14} style={{ verticalAlign: '-2px' }} /> {result.ok} {result.ok === 1 ? 'registro atualizado' : 'registros atualizados'}{result.failed.length ? `; ${result.failed.length} falharam: ${result.failed.slice(0, 2).join(' · ')}` : '.'}</span>
            <button type="button" className="icon-btn bare" onClick={() => setResult(null)} aria-label="Dispensar">×</button>
          </div>
        )}
      </section>

      {/* ---- 2. Catálogo ---- */}
      <section className="panel-card">
        <h2 className="section-title" style={{ margin: '0 0 4px', fontSize: 16 }}>Catálogo de tags</h2>
        <p className="text-sm text-muted" style={{ margin: '0 0 12px' }}>
          Todas as tags que existem, por categoria. A categoria define como a tag aparece e onde ela é listada no “+ Tag”.
          {!api && ' Sem a API ligada, as categorias valem só nesta sessão.'}
        </p>
        <div className="toolbar" style={{ marginBottom: 8 }}>
          <label className="search-box" style={{ maxWidth: 360 }}>
            <Search size={14} aria-hidden="true" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar tag ou categoria…" aria-label="Buscar tag ou categoria" />
          </label>
        </div>
        {catalogGroups.length === 0 ? (
          <EmptyState title={search ? 'Nenhuma tag encontrada' : 'Ainda não há tags'}>{search ? 'Tente outro nome ou o nome de uma categoria.' : 'As tags criadas nas fichas aparecem aqui.'}</EmptyState>
        ) : catalogGroups.map((g) => (
          <div key={g.category} className="tm-cat">
            <h3 className="tm-cat-head">{CATEGORY_META[g.category].label} <span className="text-xs text-muted">· {CATEGORY_META[g.category].hint}</span></h3>
            <ul className="row-list" style={{ margin: 0 }}>
              {g.tags.map((name) => {
                const n = usage.get(tagKey(name)) ?? 0;
                return (
                  <li key={name} className="row-item tm-row">
                    <div className="tm-main"><TagChip name={name} category={g.category} /></div>
                    <span className="text-xs text-muted">{n === 0 ? 'sem uso' : `em ${n} ${n === 1 ? 'registro' : 'registros'}`}</span>
                    <select className="select select-sm tm-choice" aria-label={`Categoria de “${name}”`} value={categoryOf(name, catalog)} onChange={(e) => void setCategory(name, e.target.value as TagCategory)}>
                      {CATEGORY_ORDER.map((c) => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}
                    </select>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>

      {confirming && (
        <PopupDialog
          title="Aplicar a migração das tags?"
          tone="warning"
          description={`${changes.length} ${changes.length === 1 ? 'registro será alterado' : 'registros serão alterados'}: ${removedTags} ${removedTags === 1 ? 'tag sai' : 'tags saem'}${movedPriorities ? ` e ${movedPriorities} ${movedPriorities === 1 ? 'prioridade passa' : 'prioridades passam'} para o campo` : ''}. Cada mudança fica no histórico do registro. Para desfazer, é preciso recolocar a tag à mão.`}
          onClose={() => { if (!busy) setConfirming(false); }}
          footer={(
            <>
              <button type="button" className="btn" disabled={busy} onClick={() => setConfirming(false)}>Cancelar</button>
              <button type="button" className="btn btn-solid" disabled={busy} onClick={() => void run()}>{busy ? 'Aplicando…' : 'Aplicar'}</button>
            </>
          )}
        />
      )}
    </div>
  );
}
