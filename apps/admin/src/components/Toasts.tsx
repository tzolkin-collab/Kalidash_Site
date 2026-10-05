import { TriangleAlert, X } from 'lucide-react';
import { useAvisos, useActiveToasts, dismissToast } from '../lib/notify';

/** Toasts de Aviso (notificacoes.md §4): canto inferior esquerdo, some sozinho, sempre com cópia no histórico de avisos. */
export default function ToastHost() {
  const [avisos] = useAvisos();
  const [activeIds] = useActiveToasts();
  const active = activeIds.map((id) => avisos.find((a) => a.id === id)).filter((a): a is NonNullable<typeof a> => Boolean(a));
  if (active.length === 0) return null;

  return (
    <div className="toast-host" role="region" aria-label="Avisos">
      {active.map((a) => (
        <div key={a.id} className={`toast ${a.category === 'erro' ? 'toast-error' : 'toast-warning'}`} role="alert">
          <TriangleAlert size={16} className="toast-icon" />
          <div className="toast-body">
            <div className="toast-title">{a.title}</div>
            <div className="toast-detail">{a.detail}</div>
          </div>
          <button type="button" className="toast-close" onClick={() => dismissToast(a.id)} aria-label="Dispensar aviso"><X size={14} /></button>
        </div>
      ))}
    </div>
  );
}
