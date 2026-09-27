import { ptBR } from './locales/easy-email-pt-br';

// Traduz os textos que o easy-email escreve direto no JSX (fora do t()) enquanto o editor
// está aberto. O que passa por t() já é traduzido pelo I18nManager (setup-easy-email-i18n.ts).
//
// O canvas do e-mail vive num Shadow DOM, então nada do que o usuário escreve é tocado aqui:
// só painéis, menus e dicas (tooltips) do editor.

const ATTRIBUTES = ['title', 'placeholder', 'aria-label'];

function translateString(text: string): string {
  // hasOwn: evita casar propriedades herdadas do objeto (ex.: um texto "constructor")
  return Object.hasOwn(ptBR, text) ? ptBR[text] : text;
}

function translateText(node: Text) {
  const raw = node.nodeValue ?? '';
  const text = raw.trim();
  if (!text) return;
  const translated = translateString(text);
  if (translated !== text) node.nodeValue = raw.replace(text, translated);
}

function translateAttributes(el: Element) {
  for (const name of ATTRIBUTES) {
    const value = el.getAttribute(name);
    if (!value) continue;
    const translated = translateString(value.trim());
    if (translated !== value.trim()) el.setAttribute(name, translated);
  }
}

function translateTree(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    translateText(root as Text);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  translateAttributes(root as Element);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) translateText(node as Text);
    else translateAttributes(node as Element);
  }
}

/** Liga a tradução do DOM. Devolve a função que desliga (use no cleanup do useEffect). */
export function startEditorDomTranslation(): () => void {
  const root = document.body;
  const options: MutationObserverInit = {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ATTRIBUTES,
  };

  const observer = new MutationObserver((records) => {
    // Desconecta enquanto escreve: as nossas próprias alterações não podem gerar novas
    // notificações. Sem isso, um texto reescrito dispara o observer de novo, para sempre.
    observer.disconnect();
    try {
      for (const record of records) {
        if (record.type === 'characterData') translateTree(record.target);
        else if (record.type === 'attributes') translateAttributes(record.target as Element);
        else record.addedNodes.forEach(translateTree);
      }
    } finally {
      observer.observe(root, options);
    }
  });

  translateTree(root);
  observer.observe(root, options);
  return () => observer.disconnect();
}
