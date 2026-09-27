import type { CustomField } from '../domain';
import { formatDateTime } from '../lib/format';
import { useStore } from '../lib/store';
import { customFieldDefsStore } from '../mocks/customFields';
import type { CustomEntity } from '../mocks/customFields';
import { SelectField, TextField } from './fields';

type Props = {
  entity: CustomEntity;
  values: Record<string, unknown> | undefined;
  /** Chamado com a chave, o rótulo, o valor antigo e o novo. */
  onChange: (field: CustomField, from: unknown, to: unknown) => void;
  /** Campos extras que não vêm da definição global (ex.: os da pipeline). */
  extra?: CustomField[];
};

/** Campos personalizados do registro: cada um vira o campo certo para o tipo (texto, número, data, lista, sim ou não). */
export default function CustomFieldsSection({ entity, values, onChange, extra = [] }: Props) {
  const [defs] = useStore(customFieldDefsStore);
  const fields = [...defs[entity], ...extra];
  if (fields.length === 0) return null;
  const data = values ?? {};

  return (
    <div className="sheet-section">
      <h3 className="sheet-section-title">Campos personalizados</h3>
      {fields.map((f) => {
        const current = data[f.key];
        if (f.type === 'select') {
          return <SelectField key={f.id} label={f.label} value={typeof current === 'string' ? current : ''} empty="—" options={(f.options ?? []).map((o) => ({ value: o, label: o }))} onCommit={(v) => onChange(f, current, v || undefined)} />;
        }
        if (f.type === 'boolean') {
          return <SelectField key={f.id} label={f.label} value={current === true ? 'sim' : current === false ? 'nao' : ''} empty="—" options={[{ value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' }]} onCommit={(v) => onChange(f, current, v === '' ? undefined : v === 'sim')} />;
        }
        if (f.type === 'number') {
          return (
            <TextField key={f.id} label={f.label} value={current === undefined ? '' : String(current)} validate={(v) => (Number.isFinite(Number(v.replace(',', '.'))) ? null : 'Informe um número.')} onCommit={(v) => onChange(f, current, v === '' ? undefined : Number(v.replace(',', '.')))} />
          );
        }
        if (f.type === 'date') {
          return <TextField key={f.id} label={f.label} type="date" value={typeof current === 'string' ? current : ''} display={typeof current === 'string' ? formatDateTime(current) : undefined} onCommit={(v) => onChange(f, current, v || undefined)} />;
        }
        return <TextField key={f.id} label={f.label} value={typeof current === 'string' ? current : ''} onCommit={(v) => onChange(f, current, v || undefined)} />;
      })}
    </div>
  );
}
