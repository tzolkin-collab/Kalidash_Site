import { useEffect, useState } from 'react';
import { initials } from '../lib/people';

// Logo do provedor de um agente MCP (claude.ai, ChatGPT, Cursor…): a logo que o cliente mandou no registro OAuth,
// ou o favicon do site do provedor. Se nada carregar, as iniciais do nome.

export function providerLogoSrc(logoUri?: string, domain?: string): string | undefined {
  if (logoUri) return logoUri;
  if (domain) return `https://${domain}/favicon.ico`;
  return undefined;
}

export function ProviderLogo({ name, logoUri, domain, size = 28 }: { name: string; logoUri?: string; domain?: string; size?: number }) {
  const src = providerLogoSrc(logoUri, domain);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return (
    <span className="provider-logo" style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }} aria-hidden>
      {src && !failed ? <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : <span>{initials(name || '?')}</span>}
    </span>
  );
}
