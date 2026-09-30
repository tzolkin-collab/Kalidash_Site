import { useEffect, useRef, useState } from 'react';
import { Monitor, Smartphone } from 'lucide-react';
import { SITE_ORIGIN, SITE_URL } from '../lib/site';

export type PreviewFocus = { focus?: string; blockId?: string; text?: string };

/** Pré-visualização = o próprio site, numa rota /preview/* dentro de um iframe. O rascunho
 *  (nada salvo) vai por postMessage; quem clica no preview avisa o que foi clicado pra
 *  gente focar o campo/bloco certo aqui no admin. Só fala com SITE_ORIGIN. */
export function PreviewFrame({ kind, tick, getPayload, onFocus }: {
  kind: 'gallery' | 'article';
  /** muda a cada edição; dispara o envio do rascunho */
  tick: number;
  getPayload: () => unknown;
  onFocus: (msg: PreviewFocus) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const latest = useRef({ getPayload, onFocus });
  latest.current = { getPayload, onFocus };

  const send = () => {
    frame.current?.contentWindow?.postMessage({ type: 'kalidash:preview', kind, payload: latest.current.getPayload() }, SITE_ORIGIN);
  };

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== SITE_ORIGIN || e.source !== frame.current?.contentWindow) return;
      const m = e.data as { type?: string; kind?: string } & PreviewFocus;
      if (m?.kind !== kind) return;
      if (m.type === 'kalidash:preview-ready') { setReady(true); setFailed(false); send(); }
      if (m.type === 'kalidash:focus') latest.current.onFocus(m);
    };
    window.addEventListener('message', onMessage);
    const timer = window.setTimeout(() => setFailed(true), 8000);
    return () => { window.removeEventListener('message', onMessage); window.clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(send, 150);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ready]);

  return (
    <div className="preview-frame">
      <div className="preview-frame-bar">
        <span className="text-xs text-muted">Pré-visualização do site{ready ? '' : ' — carregando…'}</span>
        <div className="preview-frame-devices">
          <button type="button" className={`tool-btn ${!mobile ? 'active' : ''}`} title="Desktop" onClick={() => setMobile(false)}><Monitor size={15} /></button>
          <button type="button" className={`tool-btn ${mobile ? 'active' : ''}`} title="Celular" onClick={() => setMobile(true)}><Smartphone size={15} /></button>
        </div>
      </div>
      {failed && !ready && (
        <p className="text-xs preview-frame-error">
          Não consegui carregar a pré-visualização em {SITE_URL}. O site está rodando? (em dev: <code>pnpm dev</code>; em produção, defina VITE_SITE_URL)
        </p>
      )}
      <div className="preview-frame-stage">
        <iframe
          ref={frame}
          title="Pré-visualização do site"
          src={`${SITE_URL}/preview/${kind === 'gallery' ? 'blog' : 'article'}`}
          style={{ width: mobile ? 390 : '100%' }}
        />
      </div>
    </div>
  );
}
