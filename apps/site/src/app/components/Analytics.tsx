"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { captureAttribution } from "@/lib/tracking";

/* GA4 (gtag.js) e Meta Pixel carregados direto, sem GTM. Use um caminho OU o outro: com GTM ligado e as
 * tags de GA4/Pixel dentro dele, deixe NEXT_PUBLIC_GA_MEASUREMENT_ID e NEXT_PUBLIC_META_PIXEL_ID vazios,
 * senão cada visita conta em dobro.
 * Fora do rastreamento: /preview (a pré-visualização embutida no admin) e /admin. */
const UNTRACKED = ["/preview", "/admin"];

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export default function Analytics({ gaId, pixelId }: { gaId?: string; pixelId?: string }) {
  const pathname = usePathname() ?? "/";
  const firstView = useRef(true);
  const untracked = UNTRACKED.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // Guarda UTMs e ids de clique a cada página vista (primeiro e último toque, lib/tracking.ts).
  useEffect(() => {
    if (!untracked) captureAttribution();
  }, [pathname, untracked]);

  // PageView do Pixel nas trocas de rota do Next (a primeira já sai no script de init).
  // O GA4 não precisa disto: a medição otimizada do fluxo registra as mudanças de histórico sozinha.
  useEffect(() => {
    if (firstView.current) {
      firstView.current = false;
      return;
    }
    if (pixelId && !untracked) window.fbq?.("track", "PageView");
  }, [pathname, pixelId, untracked]);

  if (untracked) return null;

  return (
    <>
      {gaId ? (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
          <Script
            id="ga4-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`,
            }}
          />
        </>
      ) : null}
      {pixelId ? (
        <>
          <Script
            id="meta-pixel"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');fbq('track','PageView');`,
            }}
          />
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              alt=""
              src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
            />
          </noscript>
        </>
      ) : null}
    </>
  );
}
