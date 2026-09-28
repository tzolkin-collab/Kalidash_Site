import type { Article } from '../domain';
import { API_URL } from './api';

// Cliente do blog real (Go + MySQL) — substitui o mocks/posts.ts. Sem Sanity.

const BASE = `${API_URL}/api/blog/articles`;

export async function listArticles(): Promise<Article[]> {
  const res = await fetch(BASE);
  if (!res.ok) throw new Error(`Não foi possível listar os artigos (${res.status}).`);
  return res.json();
}

export type ArticleInput = Omit<Article, 'id' | 'createdAt' | 'updatedAt' | 'publishedAt'> & { id?: string };

export async function createArticle(input: ArticleInput): Promise<Article> {
  const res = await fetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  if (!res.ok) throw new Error(await res.text() || `Não foi possível criar o artigo (${res.status}).`);
  return res.json();
}

export async function updateArticle(id: string, input: ArticleInput): Promise<Article> {
  const res = await fetch(BASE, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...input, id }) });
  if (!res.ok) throw new Error(await res.text() || `Não foi possível salvar o artigo (${res.status}).`);
  return res.json();
}

export async function deleteArticle(id: string): Promise<void> {
  const res = await fetch(`${BASE}?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await res.text() || `Não foi possível excluir o artigo (${res.status}).`);
}

/** Sobe a imagem pro R2 (a API redimensiona e comprime) e devolve a URL pública. */
export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_URL}/api/blog/upload`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(await res.text() || `Não foi possível subir a imagem (${res.status}).`);
  const data = await res.json();
  return data.url as string;
}
