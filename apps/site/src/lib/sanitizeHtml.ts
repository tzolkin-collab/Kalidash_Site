import sanitize from "sanitize-html";

/* Defesa em profundidade para o HTML que vem da API (corpo dos artigos e hero da galeria).
 *
 * A origem é o editor autenticado do admin (BlockNote → blocksToHTMLLossy), então o risco é baixo,
 * mas o site renderiza esse HTML com dangerouslySetInnerHTML: se a conta do admin, a API ou o banco
 * forem comprometidos, um <script> ou um onerror= viraria XSS em todos os visitantes.
 *
 * A allowlist cobre tudo que o editor emite (levantado no artigo-template, que usa todos os blocos)
 * e o que article.module.css estiliza. O que não está aqui é descartado: scripts, handlers on*,
 * javascript: em links e iframes fora dos provedores de vídeo abaixo.
 *
 * Só roda no servidor (páginas /blog e /blog/[slug]). O preview do admin recebe o rascunho por
 * postMessage de uma origem já validada e não passa por aqui. */

const VIDEO_HOSTS = ["www.youtube.com", "www.youtube-nocookie.com", "player.vimeo.com"];

const OPTIONS: sanitize.IOptions = {
  allowedTags: [
    "p", "br", "hr", "div", "span",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "strong", "b", "em", "i", "u", "s", "del", "mark", "sub", "sup", "small",
    "a", "ul", "ol", "li", "blockquote", "pre", "code",
    "table", "colgroup", "col", "thead", "tbody", "tfoot", "tr", "th", "td",
    "figure", "figcaption", "img", "picture", "source", "video", "audio",
    "details", "summary", "iframe",
    // Checklist do editor (somente <input type="checkbox">, ver exclusiveFilter).
    "input",
  ],
  allowedAttributes: {
    "*": ["class", "id", "data-*", "style", "title", "lang", "dir", "role", "aria-*"],
    a: ["href", "target", "rel", "name"],
    img: ["src", "srcset", "sizes", "alt", "width", "height", "loading", "decoding"],
    source: ["src", "srcset", "type", "media"],
    video: ["src", "controls", "poster", "preload", "loop", "muted", "playsinline", "width", "height"],
    audio: ["src", "controls", "preload", "loop"],
    td: ["colspan", "rowspan", "colwidth"],
    th: ["colspan", "rowspan", "colwidth"],
    col: ["span", "width"],
    ol: ["start", "type"],
    li: ["value"],
    input: ["type", "checked", "disabled"],
    details: ["open"],
    iframe: ["src", "width", "height", "title", "allow", "allowfullscreen", "frameborder", "loading"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["http", "https", "data"] },
  allowedSchemesAppliedToAttributes: ["href", "src", "poster"],
  allowProtocolRelative: false,
  allowedIframeHostnames: VIDEO_HOSTS,
  allowedStyles: {
    "*": {
      color: [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s.,%]+\)$/i, /^[a-z]+$/i],
      "background-color": [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s.,%]+\)$/i, /^[a-z]+$/i],
      "text-align": [/^(left|right|center|justify)$/],
    },
  },
  transformTags: {
    // Links que abrem em outra aba sempre ganham rel seguro (evita window.opener).
    a: (tagName, attribs) =>
      attribs.target === "_blank"
        ? { tagName, attribs: { ...attribs, rel: "noopener noreferrer" } }
        : { tagName, attribs },
  },
  // Qualquer <input> que não seja checkbox é descartado.
  exclusiveFilter: (frame) =>
    frame.tag === "input" && String(frame.attribs.type ?? "").toLowerCase() !== "checkbox",
};

export function sanitizeArticleHtml(html: string | null | undefined): string {
  if (!html) return "";
  return sanitize(html, OPTIONS);
}
