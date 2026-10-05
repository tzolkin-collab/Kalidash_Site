import type { ChangeEntry, EntityKind } from '../domain';

// Como uma entrada do histórico aparece na ficha (linha do tempo) e na Auditoria. Puro e testado.

export function describeChange(h: ChangeEntry): { title: string; detail?: string } {
  switch (h.kind) {
    case 'create': return { title: 'Cadastro criado', detail: h.note };
    case 'edit': return { title: `${h.field} alterado`, detail: `${h.from} → ${h.to}` };
    case 'lifecycle': return { title: 'Ciclo de vida mudou', detail: `${h.from} → ${h.to}${h.note ? ` · ${h.note}` : ''}` };
    case 'archive': return { title: 'Arquivado', detail: h.note };
    case 'restore': return { title: 'Restaurado', detail: h.note };
    case 'reveal': return { title: `${h.field ?? 'Dado sensível'} revelado`, detail: h.note };
    case 'qualify': return { title: 'Qualificado', detail: h.note };
    case 'discard': return { title: 'Descartado', detail: h.note };
    default: return { title: 'Evento', detail: h.note };
  }
}

export const ENTITY_LABEL: Record<EntityKind, string> = { lead: 'Lead', person: 'Pessoa', company: 'Empresa', opportunity: 'Oportunidade', pipeline: 'Funil' };

/** Uma linha da tela de Auditoria: quem, o quê e em qual registro. */
export function auditRowOf(h: ChangeEntry): { id: string; at: string; actor: string; action: string; target: string } {
  const d = describeChange(h);
  return { id: h.id, at: h.at, actor: h.actor, action: d.detail ? `${d.title}: ${d.detail}` : d.title, target: `${ENTITY_LABEL[h.entity] ?? h.entity}: ${h.entityName}` };
}
