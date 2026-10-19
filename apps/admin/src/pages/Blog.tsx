import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getDefaultReactSlashMenuItems, SuggestionMenuController, useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { filterSuggestionItems } from '@blocknote/core';
import type { PartialBlock } from '@blocknote/core';
import { ArticleCardsContext, blogSchema, CARD_TYPE, SPLIT_MEDIA_TYPE, TWO_COLUMNS_TYPE, syncCards } from './articleCardBlock';
import { pt as blockNoteLocalePt } from '@blocknote/core/locales';
import '@blocknote/mantine/style.css';
import '@blocknote/core/fonts/inter.css';
import { AlertTriangle, Plus, RefreshCw, Star, Trash2, ImagePlus, Divide, Globe, Tag, Link2, Clock, Columns, Crop, Layout } from 'lucide-react';
import { PhotoCropModal } from '../components/PhotoCropModal';
import type { Article } from '../domain';
import { formatDate } from '../lib/format';
import { createArticle, deleteArticle, listArticles, updateArticle, uploadImage, uploadImageNotifying, getBlogSettings, updateBlogSettings, checkSlugAvailable } from '../lib/blog';
import type { ArticleInput, BlogSettings } from '../lib/blog';
import { teamStore } from '../mocks/team';
import { Badge, EmptyState, Field, Page, PageHeader, Pagination, PopupDialog, SearchBox, Tabs } from '../components/ui';
import { useStore } from '../lib/store';
import { usePaged } from '../lib/usePaged';
import { useShell } from '../lib/shell';
import { resolveAssetUrl } from '../lib/site';
import { PreviewFrame } from '../components/PreviewFrame';
import type { PreviewFocus } from '../components/PreviewFrame';

type Filter = 'SETTINGS' | 'ALL' | 'PUBLISHED' | 'DRAFT';

const blank = (authorName: string): Article => ({
  id: 'novo', title: '', slug: '', excerpt: '', body: '', coverImagePos: 50, featured: false, published: false,
  authorName, categories: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
});

export default function Blog({ postId }: { postId?: string }) {
  const [team] = useStore(teamStore);
  const [articles, setArticles] = useState<Article[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');
  const shell = useShell();

  const reload = () => {
    listArticles()
      .then((list) => { setArticles(list); setLoadError(null); })
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Não foi possível falar com a API.'));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, []);

  const contentArticles = useMemo(() => articles?.filter((a) => a.slug !== 'blog-global'), [articles]);

  const counts = useMemo(() => ({
    ALL: contentArticles?.length ?? 0,
    PUBLISHED: contentArticles?.filter((a) => a.published).length ?? 0,
    DRAFT: contentArticles?.filter((a) => !a.published).length ?? 0,
  }), [contentArticles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (contentArticles ?? [])
      .filter((a) => (filter === 'ALL' || (filter === 'PUBLISHED') === a.published) && (!q || `${a.title} ${a.slug} ${a.categories.join(' ')}`.toLowerCase().includes(q)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [contentArticles, filter, search]);

  const paged = usePaged(filtered, 10);

  const editing = postId && postId !== 'novo'
    ? articles?.find((a) => a.id === postId)
    : postId === 'novo' ? blank(team[0]?.name ?? 'Equipe') : undefined;

  if (postId && postId !== 'novo' && articles && !editing) {
    return (
      <Page>
        <PageHeader title="Artigo não encontrado" back={{ label: 'Blog', to: '/blog' }} />
        <EmptyState title="Este artigo não existe mais">Pode ter sido excluído. Volte pro Blog e escolha outro.</EmptyState>
      </Page>
    );
  }

  if (postId && !editing) {
    // Veio direto pra edição (link salvo, refresh) antes da lista carregar, ou postId === 'novo'
    // esperando o nome de autor padrão — ambos resolvem no próximo render.
    return <Page><PageHeader title="Carregando…" /></Page>;
  }

  if (editing) {
    return (
      <ArticleEditor
        key={editing.id}
        article={editing}
        isNew={editing.id === 'novo'}
        otherArticles={(articles ?? []).filter((a) => a.id !== editing.id)}
        onBack={() => shell.navigate('/blog')}
        onSaved={(saved, isNew) => {
          setArticles((prev) => {
            const list = prev ?? [];
            return isNew ? [saved, ...list] : list.map((a) => (a.id === saved.id ? saved : a));
          });
          if (isNew) shell.navigate(`/blog/${saved.id}`);
        }}
        onDeleted={(id) => {
          setArticles((prev) => (prev ?? []).filter((a) => a.id !== id));
          shell.navigate('/blog');
        }}
      />
    );
  }

  return (
    <Page>
      <PageHeader
        title="Blog"
        subtitle="Escreva e publique os artigos do site. O site regenera as páginas sozinho (ISR), sem precisar de novo deploy."
        actions={<button type="button" className="btn btn-solid" onClick={() => shell.navigate('/blog/novo')}><Plus size={14} /> Novo artigo</button>}
      />

      {loadError && (
        <div className="task-callout" role="alert" style={{ marginBottom: '16px', borderColor: '#ef4444' }}>
          <AlertTriangle size={16} />
          <div style={{ flex: 1 }}>
            <strong>Não foi possível falar com a API.</strong>
            <div className="text-xs text-muted">{loadError} Confira se ela está no ar (<code className="mono">pnpm --filter @kalidash/api dev</code>).</div>
          </div>
          <button type="button" className="btn btn-sm" onClick={reload}><RefreshCw size={12} /> Tentar de novo</button>
        </div>
      )}

      {articles === null && !loadError ? (
        <EmptyState title="Carregando artigos…" />
      ) : (
        <>
          <Tabs
            tabs={[
              { id: 'SETTINGS' as Filter, label: 'Galeria principal' },
              { id: 'ALL' as Filter, label: 'Todos', count: counts.ALL },
              { id: 'PUBLISHED' as Filter, label: 'Publicados', count: counts.PUBLISHED },
              { id: 'DRAFT' as Filter, label: 'Rascunhos', count: counts.DRAFT }
            ]}
            value={filter}
            onChange={setFilter}
          />
          <div className="toolbar"><SearchBox value={search} onChange={setSearch} placeholder="Buscar por título, endereço ou categoria…" /></div>

          {filter === 'SETTINGS' ? (
            <div className="table-card" style={{ padding: '64px 24px', textAlign: 'center' }}>
              <div style={{ maxWidth: '400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'center' }}>
                <h3 className="text-display-md">Página Inicial do Blog</h3>
                <p className="text-body-lg text-muted">A "Galeria principal" é o espaço inicial do seu blog. Use o editor completo para formatar o texto, inserir imagens e ajustar o layout livremente antes da lista de artigos.</p>
                <button type="button" className="btn btn-solid" onClick={() => {
                  const globalArticle = articles?.find(a => a.slug === 'blog-global');
                  if (globalArticle) shell.navigate(`/blog/${globalArticle.id}`);
                  else shell.navigate('/blog/novo'); // fallback
                }}>
                  Editar Galeria Principal
                </button>
              </div>
            </div>
          ) : (
            <div className="table-card">
              <div className="table-scroll">
                <table className="data-table data-table-cards">
                  <thead><tr><th>Artigo</th><th>Status</th><th>Autor</th><th>Categorias</th><th>Atualizado</th></tr></thead>
                  <tbody>
                    {paged.rows.map((a) => (
                      <tr key={a.id} className="clickable" onClick={() => shell.navigate(`/blog/${a.id}`)}>
                        <td className="cell-block" data-label="Artigo">
                          <div className="cell-stack">
                            <span className="cell-primary">{a.featured && <Star size={12} style={{ verticalAlign: '-1px', marginRight: '4px', color: '#eab308', fill: '#eab308' }} />}{a.title || 'Sem título'}</span>
                            <span className="text-xs text-muted mono">/blog/{a.slug || '…'}</span>
                          </div>
                        </td>
                        <td data-label="Status"><Badge tone={a.published ? 'success' : 'neutral'}>{a.published ? 'Publicado' : 'Rascunho'}</Badge></td>
                        <td data-label="Autor">{a.authorName}</td>
                        <td data-label="Categorias"><div className="tag-row">{a.categories.map((t) => <span key={t} className="tag">{t}</span>)}</div></td>
                        <td className="text-muted" data-label="Atualizado">{formatDate(a.updatedAt)}</td>
                      </tr>
                    ))}
                    {filtered.length === 0 && <tr><td colSpan={5}><EmptyState title="Nenhum artigo">{articles?.length ? 'Ajuste o filtro.' : 'Comece um artigo novo.'}</EmptyState></td></tr>}
                  </tbody>
                </table>
              </div>
              <Pagination page={paged.page} pageSize={paged.pageSize} total={paged.total} onPage={paged.setPage} onPageSize={paged.setPageSize} />
            </div>
          )}
        </>
      )}
    </Page>
  );
}

export function BlogSettingsForm() {
  const [settings, setSettings] = useState<BlogSettings | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getBlogSettings().then(setSettings).catch(e => setError(e.message));
  }, []);

  if (!settings) return <div style={{ padding: '24px' }}>{error || 'Carregando...'}</div>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await updateBlogSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="stack">
      {error && <div className="task-callout" style={{ borderColor: '#ef4444' }}>{error}</div>}
      <Field label="Pre-título">
        <input type="text" className="input" value={settings.preTitle} onChange={e => setSettings({ ...settings, preTitle: e.target.value })} required />
      </Field>
      <Field label="Título (Parte 1)">
        <input type="text" className="input" value={settings.titlePrefix} onChange={e => setSettings({ ...settings, titlePrefix: e.target.value })} required />
      </Field>
      <Field label="Título (Destaque)">
        <input type="text" className="input" value={settings.titleSpan} onChange={e => setSettings({ ...settings, titleSpan: e.target.value })} required />
      </Field>
      <Field label="Descrição">
        <textarea className="input" rows={3} value={settings.description} onChange={e => setSettings({ ...settings, description: e.target.value })} required />
      </Field>
      <div style={{ marginTop: '16px' }}>
        <button type="submit" className="btn btn-solid" disabled={saving}>
          {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar configurações'}
        </button>
      </div>
    </form>
  );
}

function clientSlugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/* ------------------------------ Editor ------------------------------ */

function ArticleEditor({ article, isNew, otherArticles, onBack, onSaved, onDeleted }: { article: Article; isNew: boolean; otherArticles: Article[]; onBack: () => void; onSaved: (a: Article, isNew: boolean) => void; onDeleted: (id: string) => void }) {
  const [team] = useStore(teamStore);
  const [title, setTitle] = useState(article.title);
  const [slug, setSlug] = useState(article.slug);
  const [excerpt, setExcerpt] = useState(article.excerpt);
  const [coverImageUrl, setCoverImageUrl] = useState(article.coverImageUrl || '');
  const [coverImagePos, setCoverImagePos] = useState(article.coverImagePos ?? 50);
  const [categories, setCategories] = useState(article.categories.join(', '));
  const [authorName, setAuthorName] = useState(article.authorName);
  const [featured, setFeatured] = useState(article.featured);
  const [published, setPublished] = useState(article.published);
  const [seoTitle, setSeoTitle] = useState(article.seoTitle ?? '');
  const [seoDescription, setSeoDescription] = useState(article.seoDescription ?? '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [imageDialog, setImageDialog] = useState<'cover' | null>(null);
  const [coverCropOpen, setCoverCropOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [tick, setTick] = useState(0); // a cada edição: reenvia o rascunho pro preview
  const [view, setView] = useState<'edit' | 'split' | 'preview'>('split');
  const [seoModalOpen, setSeoModalOpen] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);
  const shell = useShell();
  const touch = () => { setSaved(false); setDirty(true); setTick((t) => t + 1); };

  const isGlobal = article.slug === 'blog-global';

  // Validação em tempo real da disponibilidade de slug
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugStatus, setSlugStatus] = useState<{ available: boolean; cleanSlug: string; reason?: string } | null>(null);

  useEffect(() => {
    if (isGlobal) return;
    const trimmed = slug.trim();
    if (!trimmed) {
      setSlugStatus(null);
      setSlugChecking(false);
      return;
    }
    setSlugChecking(true);
    const timer = setTimeout(() => {
      checkSlugAvailable(trimmed, isNew ? undefined : article.id)
        .then((res) => {
          setSlugStatus({ available: res.available, cleanSlug: res.slug, reason: res.reason });
        })
        .catch(() => {
          setSlugStatus(null);
        })
        .finally(() => {
          setSlugChecking(false);
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [slug, isGlobal, isNew, article.id]);

  const slugHint = useMemo(() => {
    if (slug.trim() === '') {
      const generated = clientSlugify(title);
      return `Gerado do título: /blog/${generated || '…'}`;
    }
    if (slugChecking) {
      return 'Verificando endereço…';
    }
    if (slugStatus) {
      if (slugStatus.available) {
        return `✓ /blog/${slugStatus.cleanSlug} (disponível)`;
      }
      if (slugStatus.reason === 'reserved') {
        return `✗ /blog/${slugStatus.cleanSlug} é um endereço reservado pelo sistema.`;
      }
      if (slugStatus.reason === 'taken') {
        return `✗ /blog/${slugStatus.cleanSlug} já está em uso por outro artigo.`;
      }
    }
    return `/blog/${slug}`;
  }, [slug, slugChecking, slugStatus, title]);

  const slugInvalid = !isGlobal && slug.trim() !== '' && slugStatus?.available === false;

  // bodyJson é a fonte de verdade (documento nativo do BlockNote); body (HTML) é só o export pro
  // site. Artigo sem bodyJson (migrado do mock antigo, nunca passou pelo BlockNote) começa vazio
  // aqui e é preenchido logo abaixo por tryParseHTMLToBlocks — uma conversão única, na entrada.
  // Na Galeria Principal o documento tem, além do texto de abertura, um cartão por artigo
  // publicado (syncCards deixa os cartões em dia com os artigos e acrescenta os que faltam).
  const initialContentRef = useRef<PartialBlock[] | undefined>(
    article.bodyJson
      ? (isGlobal ? syncCards(JSON.parse(article.bodyJson), otherArticles, true) : JSON.parse(article.bodyJson)) as PartialBlock[]
      : undefined,
  );
  const editor = useCreateBlockNote({
    schema: blogSchema,
    initialContent: initialContentRef.current as never,
    uploadFile: uploadImageNotifying,
    dictionary: blockNoteLocalePt,
  });

  useEffect(() => editor.onChange(() => touch()), [editor]);

  // useLayoutEffect (não useEffect): roda antes do primeiro paint, evita um flash de conteúdo
  // vazio enquanto o HTML legado é convertido pra blocos.
  useLayoutEffect(() => {
    if (!article.bodyJson && (article.body || isGlobal)) {
      const blocks = article.body ? editor.tryParseHTMLToBlocks(article.body) : [];
      editor.replaceBlocks(editor.document, isGlobal ? syncCards(blocks as never, otherArticles, true) as never : blocks);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Grava de volta nos artigos o que foi editado nos cartões (título, resumo, capa). */
  const saveCardEdits = async () => {
    const cards = editor.document.filter((b) => b.type === CARD_TYPE);
    for (const card of cards) {
      const p = card.props as { articleId: string; title: string; excerpt: string; coverImageUrl: string; coverImagePos: number };
      const source = otherArticles.find((a) => a.id === p.articleId);
      if (!source) continue;
      const changed = p.title !== source.title || p.excerpt !== source.excerpt
        || p.coverImageUrl !== (source.coverImageUrl ?? '') || p.coverImagePos !== source.coverImagePos;
      if (!changed) continue;
      await updateArticle(source.id, { ...source, title: p.title, excerpt: p.excerpt, coverImageUrl: p.coverImageUrl || undefined, coverImagePos: p.coverImagePos });
    }
  };

  // Os cartões não entram no HTML do hero: o site monta a grade a partir dos artigos de
  // verdade, na ordem dos cartões que estão no bodyJson.
  const heroHtml = () => editor.blocksToHTMLLossy(editor.document.filter((b) => b.type !== CARD_TYPE));

  const canSave = title.trim() !== '' && !slugInvalid && !slugChecking;

  const save = () => {
    if (!canSave || saving) return;
    setSaving(true);
    setSaveError(null);
    const input: ArticleInput = {
      title: title.trim(), slug: slug.trim(), excerpt: excerpt.trim(),
      body: heroHtml(),
      bodyJson: JSON.stringify(editor.document),
      coverImageUrl: coverImageUrl.trim() || undefined, coverImagePos, featured, published,
      authorName, categories: categories.split(',').map((t) => t.trim()).filter(Boolean),
      seoTitle: seoTitle.trim() || undefined, seoDescription: seoDescription.trim() || undefined,
    };
    const request = (isGlobal ? saveCardEdits() : Promise.resolve())
      .then(() => (isNew ? createArticle(input) : updateArticle(article.id, input)));
    request
      .then((result) => { setSaved(true); setDirty(false); onSaved(result, isNew); })
      .catch((e) => setSaveError(e instanceof Error ? e.message : 'Não foi possível salvar.'))
      .finally(() => setSaving(false));
  };

  const remove = () => {
    deleteArticle(article.id)
      .then(() => onDeleted(article.id))
      .catch((e) => setSaveError(e instanceof Error ? e.message : 'Não foi possível excluir.'));
  };

  const leave = () => {
    if (dirty) { setLeaveDialogOpen(true); return; }
    onBack();
  };

  const shownTitle = seoTitle || title || 'Título do artigo';
  const shownDescription = seoDescription || excerpt || 'A descrição que aparece no Google.';

  /* ---- Preview (iframe do site) ---- */

  // Rascunho que o site renderiza no iframe: mesmo HTML que vai ser salvo, sem salvar.
  const buildPayload = () => {
    if (isGlobal) {
      const items = editor.document
        .filter((b) => b.type === CARD_TYPE && (b.props as { articleId?: string }).articleId)
        .map((b) => {
          const p = b.props as { articleId: string; title: string; excerpt: string; coverImageUrl: string; coverImagePos: number; meta: string; authorName: string };
          return { id: p.articleId, blockId: b.id, title: p.title, excerpt: p.excerpt, coverImageUrl: p.coverImageUrl || null, coverImagePos: p.coverImagePos, meta: p.meta, authorName: p.authorName, href: '#' };
        });
      return { heroHtml: heroHtml(), items };
    }
    return {
      title, excerpt, categories: categories.split(',').map((t) => t.trim()).filter(Boolean), authorName,
      coverImageUrl: coverImageUrl || null, coverImagePos, body: heroHtml(), publishedAt: article.publishedAt ?? new Date().toISOString(),
    };
  };

  const scrollToBlock = (id: string) => {
    setFlashId(id);
    window.setTimeout(() => setFlashId((cur) => (cur === id ? null : cur)), 1400);
    const el = document.querySelector<HTMLElement>(`.bn-block-outer[data-id="${id}"]`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (el && !el.querySelector('.gcard')) {
      el.classList.add('block-flash');
      window.setTimeout(() => el.classList.remove('block-flash'), 1400);
    }
  };

  type DocNode = { id: string; type: string; content?: unknown; children?: DocNode[] };
  const blockText = (b: DocNode): string =>
    Array.isArray(b.content)
      ? (b.content as { text?: string; content?: { text?: string }[] }[]).map((c) => c.text ?? (c.content ?? []).map((x) => x.text ?? '').join('')).join('').trim()
      : '';
  const findByText = (nodes: DocNode[], text: string): DocNode | null => {
    for (const b of nodes) {
      const t = blockText(b);
      if (t && b.type !== CARD_TYPE && (t.startsWith(text.slice(0, 60)) || text.startsWith(t.slice(0, 60)))) return b;
      const inner = b.children?.length ? findByText(b.children, text) : null;
      if (inner) return inner;
    }
    return null;
  };

  const focusField = (id: string) => {
    const el = document.getElementById(id);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el?.focus();
  };

  /** Clique no preview -> foca o campo/bloco correspondente aqui no editor. */
  const onPreviewFocus = (m: PreviewFocus) => {
    setView((v) => (v === 'preview' ? 'split' : v));
    if (m.focus === 'card' && m.blockId) { scrollToBlock(m.blockId); return; }
    if (m.focus === 'hero' || m.focus === 'body') {
      const hit = m.text ? findByText(editor.document as unknown as DocNode[], m.text) : null;
      if (hit) {
        try { editor.setTextCursorPosition(hit.id, 'end'); } catch { /* bloco sem texto (imagem): só rola */ }
        editor.focus();
        scrollToBlock(hit.id);
      } else editor.focus();
      return;
    }
    const field = ({ title: 'field-title', excerpt: 'field-excerpt', cover: 'field-cover', meta: 'field-categories', author: 'field-author' } as Record<string, string>)[m.focus ?? ''];
    if (field) focusField(field);
  };

  const editorView = (
    <BlockNoteView editor={editor} theme={shell.dark ? 'dark' : 'light'} slashMenu={false}>
      <SuggestionMenuController
        triggerCharacter="/"
        getItems={async (query) => filterSuggestionItems([
          ...getDefaultReactSlashMenuItems(editor),
          {
            title: 'Linha Divisória',
            subtext: 'Separador horizontal elegante entre seções',
            aliases: ['divisor', 'linha', 'separador', 'hr', 'divider'],
            group: 'Layout e Mídia',
            icon: <Divide size={16} />,
            onItemClick: () => {
              const current = editor.getTextCursorPosition().block;
              editor.insertBlocks([{ type: 'divider' }], current, 'after');
            },
          },
          {
            title: 'Foto e Texto Lado a Lado',
            subtext: 'Imagem e texto alinhados com corte e proporção',
            aliases: ['lado a lado', 'split', 'foto texto', 'imagem texto', 'colunas'],
            group: 'Layout e Mídia',
            icon: <Layout size={16} />,
            onItemClick: () => {
              const current = editor.getTextCursorPosition().block;
              editor.insertBlocks([{ type: SPLIT_MEDIA_TYPE }], current, 'after');
            },
          },
          {
            title: 'Duas Colunas de Conteúdo',
            subtext: 'Dois blocos de texto ou tópicos lado a lado',
            aliases: ['colunas', 'duas colunas', 'grid', '2 colunas'],
            group: 'Layout e Mídia',
            icon: <Columns size={16} />,
            onItemClick: () => {
              const current = editor.getTextCursorPosition().block;
              editor.insertBlocks([{ type: TWO_COLUMNS_TYPE }], current, 'after');
            },
          },
          ...(isGlobal ? [{
            title: 'Cartão de artigo',
            subtext: 'Um artigo do blog na galeria',
            aliases: ['artigo', 'card', 'cartao', 'post'],
            group: 'Blog',
            onItemClick: () => {
              const current = editor.getTextCursorPosition().block;
              editor.insertBlocks([{ type: CARD_TYPE }], current, 'after');
            },
          }] : []),
        ], query)}
      />
    </BlockNoteView>
  );

  const addImageFromDialog = () => {
    const url = imageUrl.trim();
    if (!url) return;
    setCoverImageUrl(url);
    touch();
    setImageDialog(null);
  };

  const handleFileUpload = (file: File) => {
    setUploading(true);
    setUploadError(null);
    uploadImage(file)
      .then((url) => { setCoverImageUrl(url); touch(); setImageDialog(null); })
      .catch((e) => setUploadError(e instanceof Error ? e.message : 'Não foi possível subir a imagem.'))
      .finally(() => setUploading(false));
  };

  const togglePublished = () => {
    setPublished((p) => !p);
    touch();
  };

  const toggleFeatured = () => {
    setFeatured((f) => !f);
    touch();
  };

  const readingTime = useMemo(() => {
    let text = `${title} ${excerpt} `;
    try {
      const doc = editor.document;
      if (Array.isArray(doc)) {
        const walk = (nodes: any[]): string =>
          nodes.map((n) => {
            let s = '';
            if (Array.isArray(n.content)) s += n.content.map((c: any) => c.text || '').join(' ');
            if (n.children?.length) s += ' ' + walk(n.children);
            return s;
          }).join(' ');
        text += walk(doc);
      }
    } catch { /* no-op */ }
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 200));
  }, [title, excerpt, editor.document, tick]);

  return (
    <Page>
      <PageHeader
        title={title || (isGlobal ? 'Galeria Principal do Blog' : 'Novo artigo')}
        subtitle={
          <>
            <Badge tone={published ? 'success' : 'neutral'}>
              {published ? 'Publicado' : 'Rascunho'}
            </Badge>
            {featured && <Badge tone="warning"><Star size={10} /> Destaque</Badge>}
            {saveError ? (
              <span style={{ color: '#ef4444' }}>{saveError}</span>
            ) : saved ? (
              <span className="text-muted">Salvo agora.</span>
            ) : dirty ? (
              <span className="text-muted">Alterações não salvas</span>
            ) : null}
          </>
        }
        actions={
          <>
            <button type="button" className="btn" onClick={leave}>Voltar</button>
            {!isNew && !isGlobal && (
              <button type="button" className="btn btn-danger" onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 size={14} /> Excluir
              </button>
            )}
            <button type="button" className="btn btn-solid" disabled={!canSave || saving} onClick={save}>
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </>
        }
      />

      <div className="editor-layout no-sidebar">
        <div className="form-stack editor-main">
          {/* BARRA SUPERIOR DE CONTROLES: ACIMA DE TUDO (fora da área de edição) */}
          <div className="editor-super-bar">
            <div className="super-bar-left">
              <div className="editor-views" role="tablist" aria-label="Modo do editor">
                {(['edit', 'split', 'preview'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="tab"
                    aria-selected={view === v}
                    className={`btn btn-sm ${view === v ? 'btn-solid' : ''}`}
                    onClick={() => setView(v)}
                  >
                    {{ edit: 'Editar', split: 'Lado a lado', preview: 'Pré-visualizar' }[v]}
                  </button>
                ))}
              </div>
            </div>

            {!isGlobal && (
              <div className="super-bar-right">
                <button
                  type="button"
                  className={`status-pill ${published ? 'is-published' : 'is-draft'}`}
                  onClick={togglePublished}
                  title={published ? 'Clique para mudar para Rascunho' : 'Clique para Publicar este artigo'}
                >
                  <span className="status-dot" />
                  <span>{published ? 'Publicado' : 'Rascunho'}</span>
                </button>

                <button
                  type="button"
                  className={`feature-pill ${featured ? 'is-featured' : ''}`}
                  onClick={toggleFeatured}
                  title={featured ? 'Artigo em destaque no topo da galeria' : 'Destacar este artigo'}
                >
                  <Star size={13} fill={featured ? 'currentColor' : 'none'} />
                  <span>{featured ? 'Destaque ativo' : 'Destaque'}</span>
                </button>

                <div className="super-bar-slug" title={slugHint}>
                  <Link2 size={13} className="text-muted" />
                  <span className="slug-prefix">/blog/</span>
                  <input
                    className={`slug-input ${slugInvalid ? 'is-invalid' : slugStatus?.available ? 'is-available' : ''}`}
                    value={slug}
                    onChange={(e) => { setSlug(e.target.value); touch(); }}
                    placeholder={clientSlugify(title) || 'slug-do-artigo'}
                  />
                  {slugStatus?.available && <span className="slug-badge is-ok" title="Disponível">✓</span>}
                  {slugInvalid && <span className="slug-badge is-err" title={slugHint}>✗</span>}
                </div>

                <button
                  type="button"
                  className={`btn btn-sm super-bar-seo-btn ${seoTitle || seoDescription ? 'has-seo' : ''}`}
                  onClick={() => setSeoModalOpen(true)}
                  title="Configurar prévia e títulos para o Google"
                >
                  <Globe size={13} />
                  <span>SEO & Google</span>
                  {(seoTitle || seoDescription) && <span className="seo-dot" />}
                </button>
              </div>
            )}
          </div>

          <div className="editor-split" data-view={view}>
            <div className="editor-pane">
              <div className="editor-box">
                {isGlobal ? (
                  <ArticleCardsContext.Provider value={{ articles: otherArticles, flashId }}>
                    <div className="global-gallery-header">
                      <p className="editor-hint">
                        Você está editando a <strong>Galeria Principal</strong> (/blog): o texto de abertura e a ordem dos cartões. O primeiro cartão é o destaque. Arraste pelo <strong>⋮⋮</strong> para reordenar; digite <strong>/</strong> para inserir novos blocos.
                      </p>
                    </div>
                    {editorView}
                  </ArticleCardsContext.Provider>
                ) : (
                  <div className="article-canvas-container">
                    <article className="article-canvas">
                      {/* 1. Header Meta: Categoria, Data, Tempo de Leitura (Idêntico ao Preview do Site) */}
                      <div className="canvas-header-meta">
                        <div className="canvas-category-badge" title="Categorias do artigo separadas por vírgula">
                          <Tag size={11} />
                          <input
                            id="field-categories"
                            className="canvas-category-input"
                            value={categories}
                            onChange={(e) => { setCategories(e.target.value); touch(); }}
                            placeholder="AI Culture (digite para alterar categoria)"
                          />
                        </div>
                        <span className="canvas-meta-dot">·</span>
                        <span className="canvas-date-text">
                          {published && article.publishedAt ? formatDate(article.publishedAt) : 'Hoje'}
                        </span>
                        <span className="canvas-meta-dot">·</span>
                        <span className="canvas-reading-badge">
                          <Clock size={13} />
                          <span>{readingTime} min de leitura</span>
                        </span>
                      </div>

                      {/* 2. Título do Artigo (Grande tipografia editorial, idêntica ao h1 do site) */}
                      <textarea
                        id="field-title"
                        className="canvas-title-input"
                        rows={1}
                        value={title}
                        placeholder="Título do seu artigo..."
                        onChange={(e) => { setTitle(e.target.value); touch(); }}
                      />

                      {/* 3. Subtítulo / Resumo Editorial (idêntico ao lead/excerpt do site) */}
                      <textarea
                        id="field-excerpt"
                        className="canvas-excerpt-input"
                        rows={2}
                        value={excerpt}
                        placeholder="Adicione um resumo ou subtítulo cativante para introduzir a leitura..."
                        onChange={(e) => { setExcerpt(e.target.value); touch(); }}
                      />

                      {/* 4. Barra do Autor (Avatar com gradiente, nome selecionável e cargo 'Kalidash Intelligence') */}
                      <div className="canvas-author-bar">
                        <div className="canvas-author-profile">
                          <div className="canvas-author-avatar">
                            {authorName ? authorName.slice(0, 2).toUpperCase() : 'KD'}
                          </div>
                          <div className="canvas-author-details">
                            <div className="canvas-author-name-row">
                              <select
                                id="field-author"
                                className="canvas-author-select"
                                value={authorName}
                                onChange={(e) => { setAuthorName(e.target.value); touch(); }}
                                title="Trocar autor do artigo"
                              >
                                {team.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
                                {!team.some((m) => m.name === authorName) && authorName && <option value={authorName}>{authorName}</option>}
                              </select>
                            </div>
                            <small className="canvas-author-role">Kalidash Intelligence</small>
                          </div>
                        </div>
                      </div>

                      {/* 5. Imagem de Capa (exatamente onde fica no site: logo após o autor e antes do corpo) */}
                      <div id="field-cover" className="canvas-cover-container">
                        {coverImageUrl ? (
                          <div className="canvas-cover-card">
                            <img
                              src={resolveAssetUrl(coverImageUrl)}
                              alt={title || 'Capa do artigo'}
                              style={{ objectPosition: `50% ${coverImagePos}%` }}
                            />
                            <div className="canvas-cover-floating-tools">
                              <button
                                type="button"
                                className="btn btn-xs btn-solid"
                                onClick={() => setCoverCropOpen(true)}
                                title="Abrir estúdio de enquadramento e corte real da foto de capa"
                              >
                                <Crop size={12} /> Cortar e Enquadrar
                              </button>
                              <span className="canvas-cover-slider" title="Ajuste vertical fino (0% topo, 100% base)">
                                <span>Ajuste:</span>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={coverImagePos}
                                  onChange={(e) => { setCoverImagePos(Number(e.target.value)); touch(); }}
                                />
                              </span>
                              <button
                                type="button"
                                className="btn btn-xs"
                                onClick={() => { setImageUrl(''); setUploadError(null); setImageDialog('cover'); }}
                              >
                                Trocar foto
                              </button>
                              <button
                                type="button"
                                className="btn btn-xs btn-danger"
                                onClick={() => { setCoverImageUrl(''); touch(); }}
                              >
                                Remover capa
                              </button>
                            </div>

                            {coverCropOpen && coverImageUrl && (
                              <PhotoCropModal
                                isOpen={coverCropOpen}
                                imageUrl={coverImageUrl}
                                initialPos={coverImagePos}
                                aspectRatio="16:9"
                                title="Cortar e Enquadrar Capa do Artigo"
                                onClose={() => setCoverCropOpen(false)}
                                onApply={(newUrl, meta) => {
                                  setCoverImageUrl(newUrl);
                                  if (meta?.pos !== undefined) setCoverImagePos(meta.pos);
                                  touch();
                                  setCoverCropOpen(false);
                                }}
                              />
                            )}
                          </div>
                        ) : (
                          <div className="canvas-cover-empty">
                            <button
                              type="button"
                              className="btn-add-cover-canvas"
                              onClick={() => { setImageUrl(''); setUploadError(null); setImageDialog('cover'); }}
                            >
                              <ImagePlus size={16} />
                              <span>+ Adicionar foto de capa do artigo</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* 6. Corpo do Artigo (BlockNote fluindo naturalmente com tipografia de leitura) */}
                      <div className="canvas-body">
                        {editorView}
                      </div>
                    </article>
                  </div>
                )}
              </div>
            </div>

            <div className="editor-preview-pane">
              <PreviewFrame kind={isGlobal ? 'gallery' : 'article'} tick={tick} getPayload={buildPayload} onFocus={onPreviewFocus} />
            </div>
          </div>
        </div>
      </div>

      {/* Modal de SEO & Google */}
      {seoModalOpen && (
        <PopupDialog
          eyebrow="OTIMIZAÇÃO PARA MOTORES DE BUSCA"
          title="Configurações de SEO & Google"
          description="Defina como o artigo será exibido nos resultados de pesquisa do Google e nas redes sociais."
          onClose={() => setSeoModalOpen(false)}
          footer={<button type="button" className="btn btn-solid" onClick={() => setSeoModalOpen(false)}>Concluído</button>}
        >
          <div className="form-stack">
            <Field label="Título para o Google" hint={`${seoTitle.length}/60 caracteres recomendados`}>
              <input
                className="input"
                value={seoTitle}
                maxLength={70}
                placeholder={title || 'Título padrão do artigo'}
                onChange={(e) => { setSeoTitle(e.target.value); touch(); }}
              />
            </Field>
            <Field label="Descrição para o Google" hint={`${seoDescription.length}/160 caracteres recomendados`}>
              <textarea
                className="textarea"
                style={{ minHeight: '76px' }}
                value={seoDescription}
                maxLength={180}
                placeholder={excerpt || 'Resumo do artigo nos resultados de busca...'}
                onChange={(e) => { setSeoDescription(e.target.value); touch(); }}
              />
            </Field>
            <div className="serp" aria-label="Prévia no Google">
              <div className="serp-url">kalidash.com.br › blog {slug !== 'blog-global' && `› ${slug || clientSlugify(title) || '…'}`}</div>
              <div className="serp-title">{shownTitle.slice(0, 60)}</div>
              <div className="serp-desc">{shownDescription.slice(0, 160)}</div>
            </div>
          </div>
        </PopupDialog>
      )}

      {leaveDialogOpen && <PopupDialog
        eyebrow="ALTERAÇÕES DO ARTIGO"
        tone="warning"
        title="Sair sem salvar?"
        description="As alterações feitas neste artigo serão descartadas."
        onClose={() => setLeaveDialogOpen(false)}
        footer={<><button type="button" className="btn" onClick={() => setLeaveDialogOpen(false)}>Continuar editando</button><button type="button" className="btn btn-danger" onClick={() => { setLeaveDialogOpen(false); onBack(); }}>Sair sem salvar</button></>}
      />}

      {deleteDialogOpen && <PopupDialog
        eyebrow="EXCLUIR ARTIGO"
        tone="danger"
        title="Excluir este artigo?"
        description="Some do admin e do site na próxima regeneração. Não dá pra desfazer."
        onClose={() => setDeleteDialogOpen(false)}
        footer={<><button type="button" className="btn" onClick={() => setDeleteDialogOpen(false)}>Cancelar</button><button type="button" className="btn btn-danger" onClick={() => { setDeleteDialogOpen(false); remove(); }}>Excluir</button></>}
      />}

      {imageDialog && <PopupDialog
        eyebrow="IMAGEM DE CAPA"
        title="Adicionar capa"
        description="Escolha um arquivo do computador — a API redimensiona e comprime sozinha antes de subir pro storage — ou cole o endereço de uma imagem já publicada em outro lugar."
        onClose={() => setImageDialog(null)}
        footer={<button type="button" className="btn" onClick={() => setImageDialog(null)}>Cancelar</button>}
      >
        <div className="form-stack">
          <label className="btn btn-solid" style={{ justifyContent: 'center', opacity: uploading ? 0.6 : 1, cursor: uploading ? 'default' : 'pointer' }}>
            <input
              type="file" accept="image/*" style={{ display: 'none' }} disabled={uploading}
              onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileUpload(file); e.target.value = ''; }}
            />
            {uploading ? 'Enviando…' : <><ImagePlus size={14} /> Escolher arquivo do computador</>}
          </label>
          {uploadError && <p className="text-xs" style={{ color: '#ef4444', margin: 0 }}>{uploadError}</p>}
          <div className="text-xs text-muted" style={{ textAlign: 'center' }}>ou</div>
          <Field label="Colar uma URL">
            <div style={{ display: 'flex', gap: '8px' }}>
              <input className="input" type="url" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addImageFromDialog(); }} placeholder="https://exemplo.com/imagem.webp" style={{ flex: 1 }} />
              <button type="button" className="btn" disabled={!imageUrl.trim()} onClick={addImageFromDialog}>Usar</button>
            </div>
          </Field>
        </div>
      </PopupDialog>}
    </Page>
  );
}
