import { useEffect } from 'react';
import type { ReactNode } from 'react';
import type { FontSize, OpenMode } from '../lib/viewSettings';

type Props = {
  mode: OpenMode;
  fontSize: FontSize;
  onClose: () => void;
  children: ReactNode;
};

/**
 * Contêiner da ficha da oportunidade, no estilo do Notion:
 *  - "side": painel lateral. A página atrás continua visível e clicável (clicar em outra
 *    linha troca a ficha).
 *  - "center": popup central, com fundo escurecido.
 */
export default function OpportunityPeek({ mode, fontSize, onClose, children }: Props) {
  // Esc fecha, exceto quando se está digitando (o campo trata o próprio Esc).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (mode === 'center') {
    return (
      <div className="peek-center-overlay" onClick={onClose}>
        <div className={`peek-center crm-scope crm-fs-${fontSize}`} role="dialog" aria-modal="true" aria-label="Oportunidade" onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      </div>
    );
  }

  return (
    <aside className={`peek-side crm-scope crm-fs-${fontSize}`} role="dialog" aria-label="Oportunidade">
      {children}
    </aside>
  );
}
