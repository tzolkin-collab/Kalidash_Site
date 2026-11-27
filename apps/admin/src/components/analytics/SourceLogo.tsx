import { Globe, Mail, Megaphone, Search, Send } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ProviderLogo } from '../ProviderLogo';
import { PROVIDER_LOGO, providerOfChannel } from '../../lib/brandLogos';

/** Canais sem dono ganham um ícone neutro, para toda linha ter a mesma coluna de logo. */
const NEUTRAL: Record<string, LucideIcon> = { outbound: Send, busca: Search, email: Mail, direto: Globe, indicacao: Globe, __untracked: Globe };

export function BrandLogo({ provider, name, size = 20 }: { provider: string; name: string; size?: number }) {
  return <ProviderLogo name={name} logoUri={PROVIDER_LOGO[provider]} size={size} />;
}

/** Logo do canal: provedor quando há um; favicon do site do projeto conectado; senão um ícone neutro. */
export function ChannelLogo({ channel, name, domain, size = 20 }: { channel: string; name: string; domain?: string; size?: number }) {
  const provider = providerOfChannel(channel);
  if (provider) return <BrandLogo provider={provider} name={name} size={size} />;
  if (domain) return <ProviderLogo name={name} domain={domain} size={size} />;
  const Icon = NEUTRAL[channel] ?? (channel.startsWith('projeto_') ? Globe : Megaphone);
  return (
    <span className="provider-logo" style={{ width: size, height: size }} aria-hidden>
      <Icon size={Math.round(size * 0.65)} />
    </span>
  );
}

export const SiteLogo = ({ size = 20 }: { size?: number }) => <BrandLogo provider="site" name="Site" size={size} />;
