"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { captureAttribution, tagClarityAttribution } from "@/lib/tracking";

/* GA4 (gtag.js), Meta Pixel e Microsoft Clarity carregados direto, sem GTM. Use um caminho OU o outro: com GTM
 * ligado e as tags dentro dele, deixe NEXT_PUBLIC_GA_MEASUREMENT_ID, NEXT_PUBLIC_META_PIXEL_ID e
 * NEXT_PUBLIC_CLARITY_PROJECT_ID vazios, senão cada visita conta em dobro.
 * Fora do rastreamento: /preview (a pré-visualização embutida no admin) e /admin. */
const UNTRACKED = ["/preview", "/admin"];

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/* O id do projeto vai dentro de um script inline: só aceita o formato do Clarity (letras e números). */
const CLARITY_ID = /^[a-z0-9]{6,20}$/i;

export default function Analytics({ gaId, pixelId, clarityId }: { gaId?: string; pixelId?: string; clarityId?: string }) {
  const pathname = usePathname() ?? "/";
  const firstView = useRef(true);
  const untracked = UNTRACKED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const clarity = clarityId && CLARITY_ID.test(clarityId) ? clarityId : "";

  // Guarda UTMs e ids de clique a cada página vista (primeiro e último toque, lib/tracking.ts) e marca a
  // gravação do Clarity com a campanha (a fila do snippet guarda as chamadas até o script carregar).
  useEffect(() => {
    if (untracked) return;
    captureAttribution();
    tagClarityAttribution();
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
      {clarity ? (
        <Script
          id="ms-clarity"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${clarity}");`,
          }}
        />
      ) : null}
    </>
  );
}
