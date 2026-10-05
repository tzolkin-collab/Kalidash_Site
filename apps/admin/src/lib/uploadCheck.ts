// Conferência do arquivo de imagem antes de gastar o envio. A API confere de novo, pelo conteúdo
// (apps/api/storage.go); isto só poupa a viagem e dá a mensagem certa. Sem dependências: testado em
// tests/uploadCheck.test.ts.
export const ACCEPTED_IMAGES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
export const MAX_UPLOAD_BYTES = 8 << 20;

export function checkUploadFile(file: { size: number; type: string }): string | null {
  if (!ACCEPTED_IMAGES.includes(file.type)) return 'Formato não aceito. Envie JPEG, PNG, GIF ou WebP (SVG não é aceito).';
  if (file.size > MAX_UPLOAD_BYTES) return 'A imagem passa de 8 MB. Reduza o arquivo e tente de novo.';
  return null;
}
