import type { StepAction } from '../domain';
import { actionLabel } from '../mocks/automations';

export const LIFECYCLE_LABEL: Record<string, string> = { LEAD: 'Lead', PROSPECT: 'Em negociação', CLIENT: 'Cliente', INACTIVE: 'Inativo' };

/** "Follow-up|Comercial" vira "Follow-up (Comercial)"; "CLIENT" vira "Cliente"; o resto fica como está. */
export function actionText(a: StepAction): string {
  const base = actionLabel(a.actionId);
  let detail = a.detail;
  if (a.actionId === 'tarefa.criar') {
    const [t, tag] = a.detail.split('|');
    detail = tag ? `${t} (${tag})` : t;
  }
  if (a.actionId === 'ciclo.definir') detail = LIFECYCLE_LABEL[a.detail] ?? a.detail;
  const delay = a.delayDays > 0 ? (a.actionId === 'tarefa.criar' ? `, prazo de ${a.delayDays} dias` : `, depois de ${a.delayDays} dias`) : '';
  return `${base}${detail ? `: ${detail}` : ''}${delay}`;
}
