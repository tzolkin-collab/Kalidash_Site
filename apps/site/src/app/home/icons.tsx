import type { SVGProps } from "react";

/* Ícones de linha (traço 1.5, currentColor). Todos 24x24 de viewBox; o tamanho vem do CSS. */
const base = (p: SVGProps<SVGSVGElement>) => ({
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...p,
});

export const ChevronDown = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} strokeWidth={2}><path d="m6 9 6 6 6-6" /></svg>
);
export const ArrowRight = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M4 12h16M14 6l6 6-6 6" /></svg>
);
export const ArrowLeft = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M20 12H4M10 6l-6 6 6 6" /></svg>
);
export const ArrowDownLeft = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M18 6 6 18M6 8v10h10" /></svg>
);
export const ChartIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M4 20V6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14M4 20h16M8 16v-4M12 16V9M16 16v-2" /><path d="M18 3v4M16 5h4" /></svg>
);
export const MessageIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M7 9h10M7 13h6M8 18l-3 3v-3" /></svg>
);
export const DatabaseOffIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3M3 3l18 18" /></svg>
);
export const ShareIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M5 19 19 5M9 5h10v10M5 9v10h10" /></svg>
);
export const TargetIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><path d="m12 12 3.5 3.5" /></svg>
);
export const Menu = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} strokeWidth={2}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
);
export const Close = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} strokeWidth={2}><path d="M6 6l12 12M18 6 6 18" /></svg>
);

// Marcas: preenchidas, não de traço
export const WhatsApp = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}>
    <path d="M12.04 2a9.9 9.9 0 0 0-8.5 14.9L2 22l5.25-1.38A9.9 9.9 0 1 0 12.04 2Zm0 18.1c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 1 1 6.99 3.86Zm4.5-6.14c-.25-.12-1.46-.72-1.68-.8-.23-.08-.4-.12-.56.12-.17.25-.64.8-.78.97-.14.16-.29.18-.53.06a6.7 6.7 0 0 1-3.3-2.88c-.25-.43.25-.4.72-1.34.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.4-.42-.56-.42h-.47c-.16 0-.43.06-.65.31-.22.25-.86.84-.86 2.05s.88 2.38 1 2.55c.12.16 1.73 2.64 4.2 3.7 1.56.67 2.17.73 2.95.62.48-.07 1.46-.6 1.67-1.17.2-.58.2-1.07.14-1.17-.06-.1-.22-.16-.47-.28Z" />
  </svg>
);
export const Instagram = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}>
    <path d="M12 7.3A4.7 4.7 0 1 0 16.7 12 4.7 4.7 0 0 0 12 7.3Zm0 7.75A3.05 3.05 0 1 1 15.05 12 3.05 3.05 0 0 1 12 15.05ZM17.1 6a1.1 1.1 0 1 0 1.1 1.1A1.1 1.1 0 0 0 17.1 6ZM12 2.8c-2.5 0-2.8 0-3.8.06a6.8 6.8 0 0 0-2.3.44A4.6 4.6 0 0 0 3.3 5.9a6.8 6.8 0 0 0-.44 2.3C2.8 9.2 2.8 9.5 2.8 12s0 2.8.06 3.8a6.8 6.8 0 0 0 .44 2.3 4.6 4.6 0 0 0 2.6 2.6 6.8 6.8 0 0 0 2.3.44c1 .05 1.3.06 3.8.06s2.8 0 3.8-.06a6.8 6.8 0 0 0 2.3-.44 4.6 4.6 0 0 0 2.6-2.6 6.8 6.8 0 0 0 .44-2.3c.05-1 .06-1.3.06-3.8s0-2.8-.06-3.8a6.8 6.8 0 0 0-.44-2.3 4.6 4.6 0 0 0-2.6-2.6 6.8 6.8 0 0 0-2.3-.44C14.8 2.8 14.5 2.8 12 2.8Z" />
  </svg>
);
export const Facebook = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}>
    <path d="M13.5 21v-8h2.7l.4-3.2h-3.1V7.8c0-.9.25-1.5 1.55-1.5h1.65V3.45A22 22 0 0 0 14.3 3.3c-2.4 0-4 1.45-4 4.1v2.4H7.6V13h2.7v8Z" />
  </svg>
);
export const Youtube = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}>
    <path d="M21.6 7.2a2.5 2.5 0 0 0-1.75-1.76C18.3 5 12 5 12 5s-6.3 0-7.85.44A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.75 1.76C5.7 19 12 19 12 19s6.3 0 7.85-.44a2.5 2.5 0 0 0 1.75-1.76A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15V9l5.2 3Z" />
  </svg>
);

export const iconByName = { chart: ChartIcon, database: DatabaseOffIcon, share: ShareIcon, message: MessageIcon } as const;
