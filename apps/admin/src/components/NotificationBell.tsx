import { useEffect, useRef, useState } from 'react';
import { AlertOctagon, Bell, BellRing, TriangleAlert } from 'lucide-react';
import type { Aviso, Categoria } from '../lib/notify';
import { clearAll, markAllRead, markRead, unreadCount, useAvisos } from '../lib/notify';
import { useShell } from '../lib/shell';

// Sino da barra lateral (notificacoes.md §1–2): a caixa com as três categorias na mesma linha do
// tempo, mais recente primeiro, com o contador do que não foi lido.

const CATEGORY: Record<Categoria, { label: string; Icon: typeof Bell }> = {
  erro: { label: 'Erro', Icon: AlertOctagon },
  aviso: { label: 'Aviso', Icon: TriangleAlert },
  notificacao: { label: 'Notificação', Icon: BellRing },
};

const DESTINATION: Record<NonNullable<Aviso['entityRef']>['kind'], string> = { lead: '/leads', opportunity: '/oportunidades', person: '/pessoas-empresas', company: '/pessoas-empresas' };

const ago = (iso: string) => {
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return 'agora';
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return new Date(iso).toLocaleDateString('pt-BR');
};

export default function NotificationBell({ onNavigate }: { onNavigate?: () => void }) {
  const [list] = useAvisos();
  const { navigate } = useShell();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const unread = unreadCount(list);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const go = (a: Aviso) => {
    markRead(a.id);
    if (a.entityRef) {
      navigate(DESTINATION[a.entityRef.kind]);
      setOpen(false);
      onNavigate?.();
    }
  };

  return (
    <div className="bell" ref={root}>
      <button type="button" className="nav-link bell-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Bell size={18} className="nav-icon" strokeWidth={2} /> Notificações
        {unread > 0 && <span className="bell-badge" aria-label={`${unread} não ${unread === 1 ? 'lida' : 'lidas'}`}>{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <div className="bell-panel" role="dialog" aria-label="Caixa de notificações">
          <div className="bell-head">
            <strong>Notificações</strong>
            <span className="bell-actions">
              <button type="button" className="link-btn" onClick={markAllRead} disabled={unread === 0}>Marcar todas como lidas</button>
              <button type="button" className="link-btn" onClick={clearAll} disabled={list.length === 0}>Limpar</button>
            </span>
          </div>
          {list.length === 0 ? (
            <p className="bell-empty">Nada por aqui. Erros, avisos e notificações aparecem nesta caixa.</p>
          ) : (
            <ul className="bell-list">
              {list.map((a) => {
                const { label, Icon } = CATEGORY[a.category];
                return (
                  <li key={a.id}>
                    <button type="button" className={`bell-item cat-${a.category} ${a.read ? '' : 'unread'}`} onClick={() => go(a)}>
                      <Icon size={16} className="bell-icon" aria-hidden="true" />
                      <span className="bell-text">
                        <span className="bell-title">{a.title}</span>
                        {a.detail && <span className="bell-detail">{a.detail}</span>}
                        <span className="bell-meta">{label} · {ago(a.at)}</span>
                      </span>
                      {!a.read && <span className="bell-dot" aria-hidden="true" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
