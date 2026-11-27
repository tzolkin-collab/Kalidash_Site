import type { ReactNode } from 'react';
import { GROUP_LABEL } from '../../lib/channels';
import { rate } from '../../lib/acquisitionMetrics';
import type { GroupRow } from '../../lib/acquisitionMetrics';
import { costPer, isIdle, roas } from '../../lib/spend';
import type { CampaignRow } from '../../lib/spend';
import { SMALL, money, moneyOrDash, pct, times } from './format';

/** Barra de participação dentro da célula (pipeline do canal ÷ maior pipeline). */
function Share({ value, max }: { value: number; max: number }) {
  if (!max) return null;
  return <span className="an-share" aria-hidden><span style={{ width: `${Math.max(3, Math.round((value / max) * 100))}%` }} /></span>;
}

/**
 * Tabela de canais, campanhas ou peças. Com `spendOf` (investimento medido), ganha investimento, custo por lead
 * qualificado e retorno; linha com gasto e sem lead é marcada.
 */
export default function GroupTable({ rows, first, onPick, picked, spendOf, icon }: { rows: (GroupRow | CampaignRow)[]; first: string; onPick?: (k: string) => void; picked?: string; spendOf?: (r: GroupRow | CampaignRow) => number | undefined; icon?: (r: GroupRow | CampaignRow) => ReactNode }) {
  const max = Math.max(...rows.map((r) => r.pipelineCents), 0);
  const withSpend = !!spendOf;
  return (
    <div className="table-scroll">
      <table className="data-table an-table">
        <thead>
          <tr>
            <th>{first}</th>
            {withSpend && <th className="an-num">Investimento</th>}
            <th className="an-num">Leads</th><th className="an-num">Qualificados</th>
            {withSpend && <th className="an-num" title="Investimento ÷ leads qualificados">Custo / qualificado</th>}
            <th className="an-num">Pipeline gerado</th><th className="an-num">Receita</th>
            {withSpend && <th className="an-num" title="Receita ganha ÷ investimento">Retorno</th>}
            <th className="an-num">Lead → venda</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const conv = rate(r.won, r.leads);
            const group = r.group ? GROUP_LABEL[r.group] : '';
            const pick = onPick ? () => onPick(r.key) : undefined;
            const spent = spendOf?.(r);
            const idle = spent !== undefined && isIdle(r, spent);
            const other = 'otherTouchLeads' in r ? r.otherTouchLeads ?? 0 : 0;
            const onlyOther = spent !== undefined && spent > 0 && !r.leads && other > 0;
            return (
              <tr
                key={r.key}
                className={onPick ? 'clickable' : undefined}
                onClick={pick}
                onKeyDown={pick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } } : undefined}
                tabIndex={onPick ? 0 : undefined}
                aria-selected={onPick ? picked === r.key : undefined}
              >
                <td>
                  <div className="an-cell">{icon?.(r)}<div>
                  <span className="cell-primary">{r.label}</span>
                  {idle ? <span className="an-sub an-warn">Gastou sem trazer lead</span>
                    : onlyOther ? <span className="an-sub">Leads só no outro toque ({other})</span>
                    : group && group !== r.label && <span className="an-sub">{group}</span>}
                  </div></div>
                </td>
                {withSpend && <td className="an-num">{spent === undefined ? '—' : money(spent)}</td>}
                <td className="an-num">{r.leads}</td>
                <td className="an-num">{r.qualified}</td>
                {withSpend && <td className="an-num">{moneyOrDash(costPer(spent, r.qualified))}</td>}
                <td className="an-num">{money(r.pipelineCents)}<Share value={r.pipelineCents} max={max} /></td>
                <td className="an-num">{r.wonCents ? money(r.wonCents) : '—'}{r.won ? <span className="an-sub">{r.won} {r.won === 1 ? 'venda' : 'vendas'}</span> : null}</td>
                {withSpend && <td className="an-num">{times(roas(r.wonCents, spent))}</td>}
                <td className="an-num" title={conv === null ? SMALL : undefined}>{pct(conv)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
