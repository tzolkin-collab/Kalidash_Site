/* Assunto com que a pessoa chega ao formulário: cada CTA de página leva `?interesse=<chave>` e o formulário mostra
 * o nome e o envia junto com o lead. Só nomes que já existem no menu e nas páginas; nenhum texto novo. */
export const INTERESTS: Record<string, string> = {
  "ai-culture": "AI Culture",
  "ai-culture-in-company": "AI Culture In Company",
  "ai-culture-experiencias": "AI Culture Experiências",
  advisory: "Advisory",
  execucao: "Execução",
  solucoes: "Soluções próprias",
  kognis: "Kognis",
  spectra: "Spectra AI",
};

export const formHref = (key: keyof typeof INTERESTS | string) => `/diagnostico?interesse=${encodeURIComponent(key)}`;
