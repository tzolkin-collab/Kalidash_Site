import type { Article, BlogCategory } from '../domain';
import { API_URL } from './api';
import { pushErro } from './notify';
import { checkUploadFile } from './uploadCheck';

// Cliente do blog real (Go + MySQL) — substitui o mocks/posts.ts. Sem Sanity.

const BASE = `${API_URL}/api/blog/articles`;

export async function listArticles(): Promise<Article[]> {
  const res = await fetch(BASE, { credentials: 'include' });
  if (!res.ok) throw new Error(`Não foi possível listar os artigos (${res.status}).`);
  return res.json();
}

export type ArticleInput = Omit<Article, 'id' | 'createdAt' | 'updatedAt' | 'publishedAt'> & { id?: string };

export async function createArticle(input: ArticleInput): Promise<Article> {
  const res = await fetch(BASE, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await res.text() || `Não foi possível criar o artigo (${res.status}).`);
  return res.json();
}

export async function updateArticle(id: string, input: ArticleInput): Promise<Article> {
  const res = await fetch(BASE, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, id }),
  });
  if (!res.ok) throw new Error(await res.text() || `Não foi possível salvar o artigo (${res.status}).`);
  return res.json();
}

export async function deleteArticle(id: string): Promise<void> {
  const res = await fetch(`${BASE}?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await res.text() || `Não foi possível excluir o artigo (${res.status}).`);
}

export type SlugAvailability = {
  available: boolean;
  slug: string;
  reason?: 'taken' | 'reserved' | 'empty' | string;
};

/** Verifica se um slug é válido, não reservado e se não colide com outros artigos. */
export async function checkSlugAvailable(slug: string, exceptId?: string): Promise<SlugAvailability> {
  const params = new URLSearchParams();
  params.set('slug', slug);
  if (exceptId) params.set('exceptId', exceptId);
  const res = await fetch(`${API_URL}/api/blog/slug-available?${params.toString()}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Não foi possível verificar a disponibilidade do slug (${res.status}).`);
  return res.json();
}

/** Sobe a imagem pro R2 (a API redimensiona e comprime) e devolve a URL pública. */
export async function uploadImage(file: File): Promise<string> {
  const problem = checkUploadFile(file);
  if (problem) throw new Error(problem);
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_URL}/api/blog/upload`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
  if (!res.ok) throw new Error(await res.text() || `Não foi possível subir a imagem (${res.status}).`);
  const data = await res.json();
  return data.url as string;
}

/** Igual a uploadImage, mas avisa na caixa de notificações quando falha (para quem não mostra o erro sozinho, como o BlockNote). */
export async function uploadImageNotifying(file: File): Promise<string> {
  try {
    return await uploadImage(file);
  } catch (e) {
    pushErro('Não consegui subir a imagem', e instanceof Error ? e.message : 'Erro desconhecido.');
    throw e;
  }
}

export type BlogSettings = {
  preTitle: string;
  titlePrefix: string;
  titleSpan: string;
  description: string;
};

export async function getBlogSettings(): Promise<BlogSettings> {
  const res = await fetch(`${API_URL}/api/blog/settings`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Não foi possível carregar as configurações do blog (${res.status}).`);
  return res.json();
}

export async function updateBlogSettings(settings: BlogSettings): Promise<BlogSettings> {
  const res = await fetch(`${API_URL}/api/blog/settings`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error(await res.text() || `Não foi possível salvar as configurações do blog (${res.status}).`);
  return res.json();
}

const CATEGORIES_BASE = `${API_URL}/api/blog/categories`;

export type BlogCategoryInput = {
  id?: string;
  name: string;
  slug?: string;
  description?: string;
  sortOrder?: number;
  hidden?: boolean;
  seoTitle?: string;
  seoDescription?: string;
};

export async function listBlogCategories(): Promise<BlogCategory[]> {
  const res = await fetch(CATEGORIES_BASE, { credentials: 'include' });
  if (!res.ok) throw new Error(`Não foi possível carregar as categorias (${res.status}).`);
  return res.json();
}

export async function createBlogCategory(input: BlogCategoryInput): Promise<BlogCategory> {
  const res = await fetch(CATEGORIES_BASE, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error((await res.text()) || `Não foi possível criar a categoria (${res.status}).`);
  return res.json();
}

export async function updateBlogCategory(id: string, input: BlogCategoryInput): Promise<BlogCategory> {
  const res = await fetch(CATEGORIES_BASE, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, id }),
  });
  if (!res.ok) throw new Error((await res.text()) || `Não foi possível salvar a categoria (${res.status}).`);
  return res.json();
}

export async function reorderBlogCategories(order: string[]): Promise<void> {
  const res = await fetch(CATEGORIES_BASE, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order }),
  });
  if (!res.ok) throw new Error((await res.text()) || `Não foi possível reordenar as categorias (${res.status}).`);
}

export async function deleteBlogCategory(id: string): Promise<void> {
  const res = await fetch(`${CATEGORIES_BASE}?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error((await res.text()) || `Não foi possível excluir a categoria (${res.status}).`);
}
