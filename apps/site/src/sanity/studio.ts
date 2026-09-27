/**
 * URL do Sanity Studio. Em desenvolvimento ele roda em localhost:3333; em
 * produção esse endereço não existe para ninguém, então o link só aparece se
 * NEXT_PUBLIC_SANITY_STUDIO_URL apontar para um Studio publicado.
 */
export const STUDIO_URL =
  process.env.NEXT_PUBLIC_SANITY_STUDIO_URL ||
  (process.env.NODE_ENV === "development" ? "http://localhost:3333" : "");

/** Link direto para editar um documento, quando há Studio acessível. */
export const studioEditUrl = (id: string, type = "article") =>
  STUDIO_URL ? `${STUDIO_URL}/intent/edit/id=${id};type=${type}` : "";
