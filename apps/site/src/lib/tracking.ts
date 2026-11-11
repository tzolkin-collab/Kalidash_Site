/* Atribuição e conversão dos formulários do site (camada navegador).
 *
 * - UTMs e ids de clique (gclid, fbclid, gbraid, wbraid) são guardados ao chegar ao site, não lidos só na hora
 *   do envio: quem entra pela Home com UTM e converte em /diagnostico continua atribuído.
 *   · último toque (utm_*, ids de clique): troca inteiro quando chega uma nova campanha; expira em 90 dias.
 *   · primeiro toque (first_utm_*, landing_page, first_seen_at): gravado uma vez e nunca sobrescrito.
 * - Cada envio de formulário leva um event_id (newEventId), repetido nas novas tentativas do mesmo envio.
 *   A API usa esse id para não gravar o lead duas vezes e para a Meta juntar o Pixel com a API de Conversões.
 * - Conversão: o Pixel dispara Lead com o mesmo event_id. O GA4 conta generate_lead por UMA camada só: se a API
 *   avisar que envia pelo Measurement Protocol (serverSide.ga4), o navegador não dispara.
 * A camada servidor está em apps/api/tracking.go. */

const LAST_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid", "gbraid", "wbraid"] as const;
const STORE_KEY = "kld_attr";
const REFERRER_KEY = "kld_referrer";
const LAST_TOUCH_TTL_MS = 90 * 24 * 60 * 60 * 1000;

type Touch = Partial<Record<(typeof LAST_KEYS)[number], string>> & { at?: number; fbclid_at?: number };
interface Stored {
  first?: Touch & { landing_page?: string };
  last?: Touch;
}

function readStore(): Stored {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "{}") as Stored;
  } catch {
    return {};
  }
}

function writeStore(s: Stored) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* modo privado ou armazenamento bloqueado: segue só com a URL */
  }
}

function touchFromUrl(search: string): Touch {
  const q = new URLSearchParams(search);
  const t: Touch = {};
  for (const k of LAST_KEYS) {
    const v = q.get(k)?.trim();
    if (v) t[k] = v.slice(0, 300);
  }
  return t;
}

const hasTouch = (t: Touch) => LAST_KEYS.some((k) => t[k]);

/* Chamado a cada página vista (components/Analytics). Grava primeiro e último toque. */
export function captureAttribution() {
  if (typeof window === "undefined") return;
  const now = Date.now();
  const store = readStore();
  const touch = touchFromUrl(window.location.search);

  if (hasTouch(touch)) {
    touch.at = now;
    if (touch.fbclid) touch.fbclid_at = store.last?.fbclid === touch.fbclid ? store.last.fbclid_at ?? now : now;
    store.last = touch;
  }
  if (!store.first) {
    store.first = { ...touch, at: now, landing_page: window.location.pathname + window.location.search };
  }
  writeStore(store);

  // Referência externa da sessão (navegação interna não conta como origem).
  try {
    if (!sessionStorage.getItem(REFERRER_KEY) && document.referrer) {
      const ref = new URL(document.referrer);
      if (ref.host !== window.location.host) sessionStorage.setItem(REFERRER_KEY, document.referrer.slice(0, 500));
    }
  } catch {
    /* sem sessionStorage */
  }
}

function cookie(name: string): string {
  const m = document.cookie.match(new RegExp(`(?:^|;)\\s*${name.replace(/[.$?*|{}()[\]\\/+^]/g, "\\$&")}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : "";
}

/* _ga = "GA1.1.<rand>.<ts>" → client_id "<rand>.<ts>". */
function gaClientId(): string {
  const parts = cookie("_ga").split(".");
  return parts.length >= 4 ? `${parts[parts.length - 2]}.${parts[parts.length - 1]}` : "";
}

/* _ga_<ID> = "GS1.1.<session>.…" (formato antigo) ou "GS2.1.s<session>$o1$g1…" (atual) → session_id. */
function gaSessionId(): string {
  const id = (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "").replace(/^G-/, "");
  if (!id) return "";
  const parts = cookie(`_ga_${id}`).split(".");
  if (parts.length < 3) return "";
  const raw = parts[2].startsWith("s") ? parts[2].slice(1).split("$")[0] : parts[2];
  return /^\d+$/.test(raw) ? raw : "";
}

/* Atribuição completa do envio. A URL atual vence o último toque guardado (o anúncio mais recente). */
export function getAttribution(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const now = Date.now();
  const store = readStore();
  const current = touchFromUrl(window.location.search);
  const last: Touch = hasTouch(current)
    ? { ...current, fbclid_at: current.fbclid && store.last?.fbclid === current.fbclid ? store.last.fbclid_at : now }
    : store.last && store.last.at && now - store.last.at < LAST_TOUCH_TTL_MS
      ? store.last
      : {};

  const attr: Record<string, string> = {
    page_url: window.location.href.split("#")[0],
    device: window.innerWidth < 768 ? "mobile" : "desktop",
  };
  for (const k of LAST_KEYS) if (last[k]) attr[k] = last[k] as string;
  if (last.fbclid && last.fbclid_at) attr.fbclid_at = String(last.fbclid_at);

  const first = store.first;
  if (first) {
    if (first.utm_source) attr.first_utm_source = first.utm_source;
    if (first.utm_medium) attr.first_utm_medium = first.utm_medium;
    if (first.utm_campaign) attr.first_utm_campaign = first.utm_campaign;
    if (first.landing_page) attr.landing_page = first.landing_page;
    if (first.at) attr.first_seen_at = new Date(first.at).toISOString();
  }

  let referrer = "";
  try {
    referrer = sessionStorage.getItem(REFERRER_KEY) || "";
  } catch {
    /* sem sessionStorage */
  }
  if (!referrer && document.referrer && !document.referrer.startsWith(window.location.origin)) referrer = document.referrer;
  if (referrer) attr.referrer = referrer;

  try {
    const fbp = cookie("_fbp");
    if (fbp) attr._fbp = fbp;
    // _fbc: o cookie do Pixel; sem ele (Pixel bloqueado no clique), monta a partir do fbclid guardado.
    const fbc = cookie("_fbc") || (last.fbclid ? `fb.1.${last.fbclid_at ?? now}.${last.fbclid}` : "");
    if (fbc) attr._fbc = fbc;
    const cid = gaClientId();
    if (cid) attr.ga_client_id = cid;
    const sid = gaSessionId();
    if (sid) attr.ga_session_id = sid;
  } catch {
    /* cookies bloqueados */
  }
  return attr;
}

export function newEventId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {
    /* contexto inseguro (http sem localhost) */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`;
}

interface LeadResponse {
  ok?: boolean;
  eventId?: string;
  duplicate?: boolean;
  pending?: boolean;
  serverSide?: { meta?: boolean; ga4?: boolean };
}

type Win = Window & {
  fbq?: (...args: unknown[]) => void;
  gtag?: (...args: unknown[]) => void;
  dataLayer?: unknown[];
};

/* Conversão no navegador, depois que a API confirmou o lead. Reenvio já registrado (duplicate) ou ainda em
 * andamento (pending) não dispara de novo: a 1ª resposta e a camada servidor já cobrem. */
export function trackLead(eventId: string, formName: string, res: LeadResponse, extra: Record<string, unknown> = {}) {
  if (typeof window === "undefined" || res.duplicate || res.pending) return;
  const w = window as Win;
  const id = res.eventId || eventId;
  try {
    w.fbq?.("track", "Lead", { content_name: formName }, { eventID: id });
  } catch {
    /* Pixel bloqueado: a API de Conversões cobre */
  }
  if (!res.serverSide?.ga4) {
    try {
      w.gtag?.("event", "generate_lead", { form_name: formName, event_id: id });
    } catch {
      /* gtag bloqueado */
    }
  }
  try {
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push({ event: "lead_form_submitted", form_name: formName, event_id: id, ...extra });
  } catch {
    /* sem dataLayer */
  }
}
