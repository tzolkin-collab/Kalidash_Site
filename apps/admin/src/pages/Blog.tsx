import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getDefaultReactSlashMenuItems, SuggestionMenuController, useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { filterSuggestionItems } from '@blocknote/core';
import type { PartialBlock } from '@blocknote/core';
import { ArticleCardsContext, blogSchema, CARD_TYPE, syncCards } from './articleCardBlock';
import { pt as blockNoteLocalePt } from '@blocknote/core/locales';
import '@blocknote/mantine/style.css';
import '@blocknote/core/fonts/inter.css';
import { AlertTriangle, Plus, RefreshCw, Star, Trash2, ImagePlus } from 'lucide-react';
import type { Article } from '../domain';
import { formatDate } from '../lib/format';
import { createArticle, deleteArticle, listArticles, updateArticle, uploadImage, uploadImageNotifying, getBlogSettings, updateBlogSettings } from '../lib/blog';
import type { ArticleInput, BlogSettings } from '../lib/blog';
import { teamStore } from '../mocks/team';
import { Badge, EmptyState, Field, Page, PageHeader, Pagination, PopupDialog, SearchBox, Switch, Tabs } from '../components/ui';
import { useStore } from '../lib/store';
import { usePaged } from '../lib/usePaged';
import { CustomSelect } from '../components/ui';
import { useShell } from '../lib/shell';
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
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [tick, setTick] = useState(0); // a cada edição: reenvia o rascunho pro preview
  const [view, setView] = useState<'edit' | 'split' | 'preview'>('split');
  const [flashId, setFlashId] = useState<string | null>(null);
  const shell = useShell();
  const touch = () => { setSaved(false); setDirty(true); setTick((t) => t + 1); };

  // bodyJson é a fonte de verdade (documento nativo do BlockNote); body (HTML) é só o export pro
  // site. Artigo sem bodyJson (migrado do mock antigo, nunca passou pelo BlockNote) começa vazio
  // aqui e é preenchido logo abaixo por tryParseHTMLToBlocks — uma conversão única, na entrada.
  const isGlobal = article.slug === 'blog-global';
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

  const canSave = title.trim() !== '';

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
    <BlockNoteView editor={editor} theme={shell.dark ? 'dark' : 'light'} slashMenu={!isGlobal}>
      {isGlobal && (
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) => filterSuggestionItems([
            ...getDefaultReactSlashMenuItems(editor),
            {
              title: 'Cartão de artigo',
              subtext: 'Um artigo do blog na galeria',
              aliases: ['artigo', 'card', 'cartao', 'post'],
              group: 'Blog',
              onItemClick: () => {
                const current = editor.getTextCursorPosition().block;
                editor.insertBlocks([{ type: CARD_TYPE }], current, 'after');
              },
            },
          ], query)}
        />
      )}
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

  return (
    <Page>
      <PageHeader
        title={title || 'Novo artigo'}
        subtitle={<><Badge tone={published ? 'success' : 'neutral'}>{published ? 'Publicado' : 'Rascunho'}</Badge> {featured && <Badge tone="warning"><Star size={10} /> Destaque</Badge>} {saveError ? <span style={{ color: '#ef4444' }}>{saveError}</span> : saved && <span className="text-muted">Salvo agora.</span>}</>}
        actions={
          <>
            <button type="button" className="btn" onClick={leave}>Voltar</button>
            {!isNew && <button type="button" className="btn btn-danger" onClick={() => setDeleteDialogOpen(true)}><Trash2 size={14} /> Excluir</button>}
            <button type="button" className="btn btn-solid" disabled={!canSave || saving} onClick={save}>{saving ? 'Salvando…' : 'Salvar'}</button>
          </>
        }
      />

      <div className="editor-layout">
        <div className="form-stack editor-main">
          <div className="editor-views" role="tablist" aria-label="Modo do editor">
            {(['edit', 'split', 'preview'] as const).map((v) => (
              <button key={v} type="button" role="tab" aria-selected={view === v} className={`btn btn-sm ${view === v ? 'btn-solid' : ''}`} onClick={() => setView(v)}>
                {{ edit: 'Editar', split: 'Lado a lado', preview: 'Pré-visualizar' }[v]}
              </button>
            ))}
          </div>
          <div className="editor-split" data-view={view}>
            <div className="editor-pane">
              <div className="editor-box">
                {isGlobal ? (
                  <ArticleCardsContext.Provider value={{ articles: otherArticles, flashId }}>
                    <p className="editor-hint">Texto de abertura da página /blog e, abaixo, um cartão por artigo na ordem em que aparecem no site. O primeiro cartão é o destaque. Arraste pelo ⋮⋮ para reordenar; digite / para inserir.</p>
                    {editorView}
                  </ArticleCardsContext.Provider>
                ) : (
                  <div className="article-fields">
                    <input
                      id="field-title" className="input title-input" value={title} placeholder="Título da publicação"
                      onChange={(e) => { setTitle(e.target.value); touch(); }}
                    />
                    <textarea
                      id="field-excerpt" className="textarea" rows={2} value={excerpt} placeholder="Resumo do artigo…"
                      onChange={(e) => { setExcerpt(e.target.value); touch(); }}
                    />
                    <div id="field-cover" tabIndex={-1} className="cover-field">
                      {coverImageUrl ? (
                        <>
                          <img src={coverImageUrl} alt="Capa" style={{ objectPosition: `50% ${coverImagePos}%` }} />
                          <div className="cover-field-tools">
                            <input type="range" min="0" max="100" value={coverImagePos} onChange={(e) => { setCoverImagePos(Number(e.target.value)); touch(); }} title="Ajustar corte (cima/baixo)" />
                            <button type="button" className="btn btn-sm" onClick={() => { setCoverImageUrl(''); touch(); }}>Remover capa</button>
                          </div>
                        </>
                      ) : (
                        <button type="button" className="btn" onClick={() => { setImageUrl(''); setUploadError(null); setImageDialog('cover'); }}>
                          <ImagePlus size={16} /> Adicionar foto de capa
                        </button>
                      )}
                    </div>
                    {editorView}
                  </div>
                )}
              </div>
            </div>
            <div className="editor-preview-pane">
              <PreviewFrame kind={isGlobal ? 'gallery' : 'article'} tick={tick} getPayload={buildPayload} onFocus={onPreviewFocus} />
            </div>
          </div>
        </div>

        <aside className="form-stack editor-side">
          {slug !== 'blog-global' && (
            <div className="panel-card form-stack">
              <label className="check-row" style={{ cursor: 'pointer' }}>
                <Switch checked={published} onChange={(v) => { setPublished(v); touch(); }} label="Publicado" />
                <span style={{ marginLeft: '8px' }}><strong>{published ? 'Publicado' : 'Rascunho'}</strong><div className="text-xs text-muted">{published ? 'Já aparece no site.' : 'Só visível aqui no admin.'}</div></span>
              </label>
              <label className="check-row" style={{ cursor: 'pointer' }}>
                <Switch checked={featured} onChange={(v) => { setFeatured(v); touch(); }} label="Destaque" />
                <span style={{ marginLeft: '8px' }}><strong>Destaque</strong><div className="text-xs text-muted">Ocupa o bloco grande na lista do blog.</div></span>
              </label>
            </div>
          )}

          {slug !== 'blog-global' && (
            <div className="panel-card form-stack">
              <Field label="Endereço (slug)" hint={`/blog/${slug || 'gerado do título'}`}><input className="input mono" value={slug} onChange={(e) => { setSlug(e.target.value); touch(); }} placeholder="deixe em branco pra gerar do título" /></Field>
              <Field label="Autor">
                <div id="field-author" tabIndex={-1}><CustomSelect className="select" value={authorName} onChange={(e) => { setAuthorName(e.target.value); touch(); }}>
                  {team.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
                  {!team.some((m) => m.name === authorName) && authorName && <option value={authorName}>{authorName}</option>}
                </CustomSelect></div>
              </Field>
              <Field label="Categorias" hint="Separe por vírgula."><input id="field-categories" className="input" value={categories} onChange={(e) => { setCategories(e.target.value); touch(); }} /></Field>
            </div>
          )}

          {slug === 'blog-global' && (
            <div className="panel-card form-stack">
              <h3 className="section-title" style={{ margin: 0 }}>Galeria Principal</h3>
              <p className="text-sm text-muted">Você está editando a página /blog: o texto de abertura e a ordem dos cartões de artigo. O visual vem do site; aqui você só escolhe conteúdo e ordem.</p>
            </div>
          )}

          <div className="panel-card form-stack">
            <h3 className="section-title" style={{ margin: 0 }}>SEO</h3>
            <Field label="Título para o Google" hint={`${seoTitle.length}/60`}><input className="input" value={seoTitle} maxLength={70} onChange={(e) => { setSeoTitle(e.target.value); touch(); }} /></Field>
            <Field label="Descrição" hint={`${seoDescription.length}/160`}><textarea className="textarea" style={{ minHeight: '72px' }} value={seoDescription} maxLength={180} onChange={(e) => { setSeoDescription(e.target.value); touch(); }} /></Field>
            <div className="serp" aria-label="Prévia no Google">
              <div className="serp-url">kalidash.com.br › blog {slug !== 'blog-global' && `› ${slug || '…'}`}</div>
              <div className="serp-title">{shownTitle.slice(0, 60)}</div>
              <div className="serp-desc">{shownDescription.slice(0, 160)}</div>
            </div>
          </div>
        </aside>
      </div>

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
