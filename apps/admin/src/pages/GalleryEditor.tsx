import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Layers,
  Sparkles,
  Star,
  Tag,
  Check,
  Search,
} from 'lucide-react';
import type { Article, BlogCategory } from '../domain';
import { updateArticle, type ArticleInput } from '../lib/blog';
import { PreviewFrame } from '../components/PreviewFrame';
import { Badge, Page, PageHeader } from '../components/ui';

type GalleryItemState = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImageUrl?: string;
  coverImagePos?: number;
  categories: string[];
  authorName: string;
  publishedAt?: string;
  visible: boolean;
};

function parseHeroFromHtml(html: string): { eyebrow: string; title: string; description: string } {
  if (!html || !html.trim()) {
    return {
      eyebrow: 'O BLOG',
      title: 'A operação\nna era dos agentes.',
      description:
        'A Kalidash constrói software, infraestrutura e capacidades para empresas que entenderam que a próxima década não é sobre inteligência, mas sobre ação. O AI Culture Blog é onde documentamos a transição da teoria para a operação no chão de fábrica da IA corporativa.',
    };
  }
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const pFirst = doc.querySelector('p');
    const h1 = doc.querySelector('h1');
    const allP = Array.from(doc.querySelectorAll('p, div'));
    const descEl = allP.length > 1 ? allP[allP.length - 1] : doc.querySelector('div');

    const eyebrow = pFirst?.textContent?.trim() || 'O BLOG';
    const title = h1
      ? h1.innerHTML.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim()
      : 'A operação\nna era dos agentes.';
    const description = descEl?.textContent?.trim() || '';

    return {
      eyebrow: eyebrow || 'O BLOG',
      title: title || 'A operação\nna era dos agentes.',
      description,
    };
  } catch {
    return {
      eyebrow: 'O BLOG',
      title: 'A operação\nna era dos agentes.',
      description: '',
    };
  }
}

function extractCuratedIds(bodyJson?: string): string[] {
  if (!bodyJson) return [];
  try {
    const parsed = JSON.parse(bodyJson);
    if (!Array.isArray(parsed)) return [];
    const ids: string[] = [];
    for (const block of parsed) {
      if (block?.type === 'articleCard' && block.props?.articleId) {
        ids.push(block.props.articleId);
      }
    }
    return ids;
  } catch {
    return [];
  }
}

export default function GalleryEditor({
  article,
  articles,
  blogCategories,
  onCategoriesChange: _onCategoriesChange,
  onBack,
  onSaved,
}: {
  article: Article;
  articles: Article[];
  blogCategories: BlogCategory[];
  onCategoriesChange: (cats: BlogCategory[]) => void;
  onBack: () => void;
  onSaved: (saved: Article) => void;
}) {
  const initialHero = useMemo(() => parseHeroFromHtml(article.body), [article.body]);

  const [eyebrow, setEyebrow] = useState(initialHero.eyebrow);
  const [title, setTitle] = useState(initialHero.title);
  const [description, setDescription] = useState(initialHero.description);

  // Reúne todas as categorias existentes do catálogo e dos artigos
  const allAvailableCategories = useMemo(() => {
    const set = new Set<string>();
    blogCategories.forEach((c) => {
      if (c.name && c.name.trim()) set.add(c.name.trim());
    });
    articles.forEach((a) => {
      (a.categories ?? []).forEach((c) => {
        if (c && c.trim()) set.add(c.trim());
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [blogCategories, articles]);

  // Organiza os artigos publicados na ordem curada existente
  const [items, setItems] = useState<GalleryItemState[]>(() => {
    const published = articles.filter(
      (a) => a.published && a.slug !== 'blog-global' && a.slug !== 'artigo-teste-template',
    );
    const curatedIds = extractCuratedIds(article.bodyJson);
    const curatedSet = new Set(curatedIds);

    const ordered: GalleryItemState[] = [];
    // 1. Adiciona na ordem curada
    for (const id of curatedIds) {
      const match = published.find((a) => a.id === id);
      if (match) {
        ordered.push({
          id: match.id,
          title: match.title,
          slug: match.slug,
          excerpt: match.excerpt,
          coverImageUrl: match.coverImageUrl,
          coverImagePos: match.coverImagePos,
          categories: match.categories ?? [],
          authorName: match.authorName,
          publishedAt: match.publishedAt,
          visible: true,
        });
      }
    }
    // 2. Adiciona o restante dos publicados que não estavam na lista curada
    for (const a of published) {
      if (!curatedSet.has(a.id)) {
        ordered.push({
          id: a.id,
          title: a.title,
          slug: a.slug,
          excerpt: a.excerpt,
          coverImageUrl: a.coverImageUrl,
          coverImagePos: a.coverImagePos,
          categories: a.categories ?? [],
          authorName: a.authorName,
          publishedAt: a.publishedAt,
          visible: true,
        });
      }
    }
    return ordered;
  });

  const [searchFilter, setSearchFilter] = useState('');
  const [previewCategorySlug, setPreviewCategorySlug] = useState<string | null>(null);
  const [view, setView] = useState<'edit' | 'split' | 'preview'>('split');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const notifyChange = () => {
    setDirty(true);
    setSavedSuccess(false);
    setTick((t) => t + 1);
  };

  // Reordenação de artigos
  const moveItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    setItems(next);
    notifyChange();
  };

  const setAsFeatured = (index: number) => {
    if (index === 0) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.unshift(moved);
    setItems(next);
    notifyChange();
  };

  const toggleVisibility = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, visible: !item.visible } : item)),
    );
    notifyChange();
  };

  // Permite selecionar qualquer categoria OU voltar para "Sem categoria"
  const changePrimaryCategory = (id: string, newCat: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const trimmed = newCat.trim();
        if (!trimmed) {
          // Limpa completamente para "Sem categoria"
          return { ...item, categories: [] };
        }
        const rest = item.categories.filter((c) => c.toLowerCase() !== trimmed.toLowerCase());
        return { ...item, categories: [trimmed, ...rest] };
      }),
    );
    notifyChange();
  };

  // Payload gerado em tempo real para o iframe do site (/preview/blog)
  const buildPayload = () => {
    const formattedTitle = title.trim().replace(/\n/g, '<br>');
    const heroHtml = `<p>${eyebrow.trim()}</p><h1>${formattedTitle}</h1><div>${description.trim()}</div>`;

    const visibleItems = items.filter((a) => a.visible);
    const galleryItems = visibleItems.map((a) => {
      const words = (a.excerpt || '').replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
      const readMins = Math.max(1, Math.ceil(words / 200));
      const category = a.categories?.[0] || 'Kalidash';
      const dateStr = a.publishedAt
        ? new Date(a.publishedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
        : 'Hoje';

      return {
        id: a.id,
        title: a.title,
        excerpt: a.excerpt,
        coverImageUrl: a.coverImageUrl || null,
        coverImagePos: a.coverImagePos ?? 50,
        categories: a.categories ?? [],
        meta: `${category} · ${readMins} min · ${dateStr}`,
        authorName: a.authorName || 'Equipe Kalidash',
        href: '#',
      };
    });

    return {
      heroHtml,
      items: galleryItems,
      categoriesCatalog: blogCategories.map((c) => ({
        name: c.name,
        slug: c.slug,
        description: c.description,
        hidden: c.hidden,
      })),
      activeCategorySlug: previewCategorySlug,
    };
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);

    try {
      const formattedTitle = title.trim().replace(/\n/g, '<br>');
      const heroHtml = `<p>${eyebrow.trim()}</p><h1>${formattedTitle}</h1><div>${description.trim()}</div>`;

      // Monta os blocos de cartões na ordem curada
      const cardBlocks = items
        .filter((a) => a.visible)
        .map((a) => ({
          type: 'articleCard',
          props: {
            articleId: a.id,
            title: a.title,
            excerpt: a.excerpt,
            coverImageUrl: a.coverImageUrl || '',
            coverImagePos: a.coverImagePos ?? 50,
            category: a.categories[0] || '',
            meta: '',
            authorName: a.authorName,
          },
        }));

      // Bloco do hero + cartões salvos no bodyJson (compatível com a API Go e o sync de galeria)
      const bodyJson = JSON.stringify([
        { type: 'paragraph', content: [{ type: 'text', text: eyebrow.trim() }] },
        { type: 'heading', props: { level: 1 }, content: [{ type: 'text', text: title.trim() }] },
        { type: 'paragraph', content: [{ type: 'text', text: description.trim() }] },
        ...cardBlocks,
      ]);

      const input: ArticleInput = {
        title: 'Galeria principal',
        slug: 'blog-global',
        excerpt: description.trim().slice(0, 200),
        body: heroHtml,
        bodyJson,
        coverImagePos: article.coverImagePos ?? 50,
        featured: false,
        published: true,
        authorName: article.authorName || 'Equipe Kalidash',
        categories: article.categories ?? [],
        seoTitle: article.seoTitle,
        seoDescription: article.seoDescription,
      };

      // Atualiza mudanças de categoria feitas nos artigos (incluindo esvaziar para "Sem categoria")
      for (const item of items) {
        const original = articles.find((orig) => orig.id === item.id);
        const origFirst = (original?.categories?.[0] ?? '').trim().toLowerCase();
        const itemFirst = (item.categories[0] ?? '').trim().toLowerCase();
        if (original && origFirst !== itemFirst) {
          await updateArticle(item.id, {
            ...original,
            categories: item.categories,
          }).catch(() => undefined);
        }
      }

      const result = await updateArticle(article.id, input);
      setDirty(false);
      setSavedSuccess(true);
      onSaved(result);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Falha ao salvar a galeria.');
    } finally {
      setSaving(false);
    }
  };

  // Atalho de teclado Ctrl+S / Cmd+S para salvar
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        void handleSave();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [eyebrow, title, description, items, saving]);

  const filteredItems = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.slug.toLowerCase().includes(q) ||
        a.categories.some((c) => c.toLowerCase().includes(q)),
    );
  }, [items, searchFilter]);

  const featuredArticle = items.find((a) => a.visible);

  return (
    <Page>
      <PageHeader
        title="Galeria Principal do Blog"
        subtitle={
          <>
            <Badge tone="success">Página Inicial /blog</Badge>
            {savedSuccess ? (
              <span style={{ color: '#10b981', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Check size={14} /> Salvo com sucesso!
              </span>
            ) : dirty ? (
              <span className="text-muted" style={{ color: '#d97706', fontWeight: 500 }}>
                ● Alterações não salvas (Ctrl+S para salvar)
              </span>
            ) : null}
            {saveError && <span style={{ color: '#ef4444' }}>{saveError}</span>}
          </>
        }
        actions={
          <>
            <button type="button" className="btn" onClick={onBack}>
              Voltar
            </button>
            <button
              type="button"
              className="btn btn-solid"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? 'Salvando…' : 'Salvar Galeria'}
            </button>
          </>
        }
      />

      <div className="editor-layout no-sidebar">
        <div className="form-stack editor-main">
          {/* BARRA SUPERIOR DE CONTROLES E PRÉVIA */}
          <div className="editor-super-bar">
            <div className="super-bar-left">
              <div className="editor-views" role="tablist" aria-label="Modo de visualização">
                {(['edit', 'split', 'preview'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="tab"
                    aria-selected={view === v}
                    className={`btn btn-sm ${view === v ? 'btn-solid' : ''}`}
                    onClick={() => setView(v)}
                  >
                    {{ edit: 'Formulário', split: 'Lado a lado', preview: 'Pré-visualizar' }[v]}
                  </button>
                ))}
              </div>
            </div>

            <div className="super-bar-right">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="text-xs text-muted">Testar filtro no preview:</span>
                <button
                  type="button"
                  className={`btn btn-xs ${previewCategorySlug === null ? 'btn-solid' : ''}`}
                  onClick={() => {
                    setPreviewCategorySlug(null);
                    setTick((t) => t + 1);
                  }}
                >
                  Todos
                </button>
                {blogCategories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`btn btn-xs ${previewCategorySlug === c.slug ? 'btn-solid' : ''}`}
                    onClick={() => {
                      setPreviewCategorySlug(c.slug);
                      setTick((t) => t + 1);
                    }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="editor-split" data-view={view}>
            {/* PAINEL ESQUERDO: LAYOUT FECHADO E ESTRUTURADO */}
            <div className="editor-pane">
              <div className="gallery-editor-pane">
                {/* 1. SEÇÃO HERO / ABERTURA EDITORIAL */}
                <div className="gallery-card">
                  <div className="gallery-card-header">
                    <h3 className="gallery-card-title">
                      <Sparkles size={18} style={{ color: 'var(--accent)' }} />
                      Abertura Editorial (Hero da Galeria)
                    </h3>
                    <Badge tone="accent" variant="line">Cabeçalho</Badge>
                  </div>
                  <p className="gallery-card-desc">
                    O cabeçalho do blog no site é organizado em duas colunas no desktop: chapéu + título na esquerda e descrição institucional na direita com divisória visual.
                  </p>

                  <div className="gallery-hero-grid">
                    {/* Coluna 1: Chapéu e Título */}
                    <div className="gallery-hero-col">
                      <div>
                        <div className="gallery-input-label">
                          <span>Chapéu / Tagline</span>
                          <span style={{ color: 'var(--accent)', textTransform: 'none' }}>— Linha de marca</span>
                        </div>
                        <input
                          id="gallery-eyebrow"
                          className="input"
                          value={eyebrow}
                          onChange={(e) => {
                            setEyebrow(e.target.value);
                            notifyChange();
                          }}
                          placeholder="Ex: O BLOG ou Inteligência aplicada ao trabalho"
                          style={{
                            width: '100%',
                            fontFamily: 'var(--font-title, sans-serif)',
                            fontSize: '12px',
                            fontWeight: 700,
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                            color: 'var(--accent)',
                          }}
                        />
                      </div>

                      <div>
                        <div className="gallery-input-label">
                          <span>Título Principal (H1)</span>
                          <span style={{ textTransform: 'none', fontWeight: 400 }}>Quebre com Enter</span>
                        </div>
                        <textarea
                          id="gallery-title"
                          className="input"
                          rows={3}
                          value={title}
                          onChange={(e) => {
                            setTitle(e.target.value);
                            notifyChange();
                          }}
                          placeholder="Ex: A operação&#10;na era dos agentes."
                          style={{
                            width: '100%',
                            fontSize: '17px',
                            fontWeight: 700,
                            lineHeight: '1.3',
                            resize: 'vertical',
                          }}
                        />
                      </div>
                    </div>

                    {/* Coluna 2: Descrição */}
                    <div className="gallery-hero-col gallery-hero-col-desc">
                      <div>
                        <div className="gallery-input-label">
                          <span>Descrição Institucional</span>
                          <span style={{ textTransform: 'none', fontWeight: 400 }}>Coluna direita</span>
                        </div>
                        <textarea
                          id="gallery-description"
                          className="input"
                          rows={6}
                          value={description}
                          onChange={(e) => {
                            setDescription(e.target.value);
                            notifyChange();
                          }}
                          placeholder="Ex: A Kalidash constrói software, infraestrutura e capacidades para empresas..."
                          style={{
                            width: '100%',
                            fontSize: '13px',
                            lineHeight: '1.6',
                            resize: 'vertical',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. ARTIGO EM DESTAQUE */}
                <div className="gallery-card">
                  <div className="gallery-card-header">
                    <h3 className="gallery-card-title">
                      <Star size={18} style={{ color: '#eab308' }} />
                      Artigo em Destaque Principal
                    </h3>
                    <Badge tone="warning">★ Topo da Vitrine</Badge>
                  </div>
                  <p className="gallery-card-desc">
                    O primeiro artigo visível da galeria ganha o formato expandido no topo da grade do site, com imagem ampliada e resumo em evidência.
                  </p>

                  {featuredArticle ? (
                    <div className="gallery-featured-banner">
                      {featuredArticle.coverImageUrl ? (
                        <img
                          src={featuredArticle.coverImageUrl}
                          alt=""
                          className="gallery-featured-thumb"
                        />
                      ) : (
                        <div className="gallery-featured-thumb-empty">Sem capa</div>
                      )}

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#b45309',
                              background: '#fef3c7',
                              padding: '2px 8px',
                              borderRadius: '999px',
                            }}
                          >
                            <Star size={11} fill="currentColor" /> Destaque Principal
                          </span>
                          {featuredArticle.categories[0] ? (
                            <span className="text-xs text-muted" style={{ fontWeight: 600 }}>
                              {featuredArticle.categories[0]}
                            </span>
                          ) : (
                            <span className="text-xs text-muted" style={{ fontStyle: 'italic' }}>
                              Sem categoria
                            </span>
                          )}
                        </div>
                        <strong
                          style={{
                            display: 'block',
                            fontSize: '14px',
                            fontWeight: 700,
                            lineHeight: '1.35',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            color: 'var(--text-primary)',
                          }}
                        >
                          {featuredArticle.title}
                        </strong>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                          <span className="text-xs text-muted mono">/blog/{featuredArticle.slug}</span>
                          <span className="text-xs text-muted">· {featuredArticle.authorName}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-muted text-xs">Nenhum artigo publicado visível na galeria.</div>
                  )}

                  <div style={{ marginTop: '16px' }}>
                    <div className="gallery-input-label">
                      <span>Trocar Artigo em Destaque</span>
                      <span style={{ textTransform: 'none', fontWeight: 400 }}>Move para a posição #1</span>
                    </div>
                    <select
                      id="gallery-featured-select"
                      className="select"
                      value={featuredArticle?.id ?? ''}
                      onChange={(e) => {
                        const targetId = e.target.value;
                        const idx = items.findIndex((a) => a.id === targetId);
                        if (idx >= 0) setAsFeatured(idx);
                      }}
                      style={{ width: '100%', height: '36px', fontSize: '13px' }}
                    >
                      {items.map((a, i) => (
                        <option key={a.id} value={a.id}>
                          {i === 0 ? '★ [Atual] ' : `#${i + 1} `}
                          {a.title} ({a.categories[0] || 'Sem categoria'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 3. ORDEM E CURADORIA DA GRADE */}
                <div className="gallery-card">
                  <div className="gallery-card-header">
                    <h3 className="gallery-card-title">
                      <Layers size={18} style={{ color: 'var(--accent)' }} />
                      Curadoria e Ordem dos Artigos
                    </h3>
                    <Badge tone="neutral">
                      {items.filter((a) => a.visible).length} visíveis · {items.filter((a) => !a.visible).length} ocultos
                    </Badge>
                  </div>
                  <p className="gallery-card-desc">
                    Defina a posição de cada postagem na grade pública. Você pode mudar a ordem pelas setas, definir novo destaque ou alterar/remover a categoria do artigo direto aqui.
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      marginBottom: '16px',
                    }}
                  >
                    <div style={{ position: 'relative', flex: 1 }}>
                      <Search
                        size={14}
                        style={{
                          position: 'absolute',
                          left: '10px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: 'var(--text-muted)',
                        }}
                      />
                      <input
                        type="text"
                        className="input"
                        placeholder="Buscar por título ou slug..."
                        value={searchFilter}
                        onChange={(e) => setSearchFilter(e.target.value)}
                        style={{ width: '100%', paddingLeft: '32px', height: '32px', fontSize: '12px' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {filteredItems.map((item) => {
                      const actualIndex = items.findIndex((a) => a.id === item.id);
                      const isFirst = actualIndex === 0;
                      const isLast = actualIndex === items.length - 1;
                      const hasCategory = item.categories.length > 0 && item.categories[0].trim() !== '';

                      return (
                        <div
                          key={item.id}
                          className={`gallery-row ${isFirst ? 'is-featured' : ''} ${!item.visible ? 'is-hidden' : ''}`}
                        >
                          {/* Posição */}
                          <div
                            className={`gallery-rank-badge ${isFirst ? 'is-star' : ''}`}
                            title={isFirst ? 'Artigo em Destaque' : `Posição #${actualIndex + 1}`}
                          >
                            {isFirst ? '★' : `#${actualIndex + 1}`}
                          </div>

                          {/* Capa */}
                          {item.coverImageUrl ? (
                            <img
                              src={item.coverImageUrl}
                              alt=""
                              className="gallery-thumb-sm"
                            />
                          ) : (
                            <div className="gallery-thumb-empty-sm" />
                          )}

                          {/* Título e Info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: 600,
                                fontSize: '13px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                color: 'var(--text-primary)',
                              }}
                              title={item.title}
                            >
                              {item.title}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                              <span className="text-xs text-muted mono">/blog/{item.slug}</span>
                              {!item.visible && (
                                <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600 }}>
                                  (Oculto da vitrine)
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Seletor de Categoria com opção clara de "Sem categoria" */}
                          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Tag size={12} style={{ color: hasCategory ? 'var(--accent)' : 'var(--text-muted)' }} />
                            <select
                              aria-label={`Categoria de ${item.title}`}
                              value={hasCategory ? item.categories[0] : ''}
                              onChange={(e) => changePrimaryCategory(item.id, e.target.value)}
                              className="select"
                              style={{
                                height: '28px',
                                fontSize: '11.5px',
                                padding: '0 8px',
                                maxWidth: '145px',
                                borderRadius: '6px',
                                fontWeight: hasCategory ? 600 : 400,
                                color: hasCategory ? 'var(--text-primary)' : 'var(--text-muted)',
                                background: hasCategory ? 'transparent' : 'var(--bg-surface-hover)',
                              }}
                            >
                              <option value="">Sem categoria</option>
                              {allAvailableCategories.map((name) => (
                                <option key={name} value={name}>
                                  {name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Ações de Reordenação e Visibilidade */}
                          <div className="gallery-row-actions">
                            {!isFirst && (
                              <button
                                type="button"
                                className="btn btn-xs"
                                title="Promover a Destaque Principal"
                                onClick={() => setAsFeatured(actualIndex)}
                              >
                                <Star size={12} />
                              </button>
                            )}

                            <button
                              type="button"
                              className="btn btn-xs"
                              title="Subir posição"
                              disabled={isFirst}
                              onClick={() => moveItem(actualIndex, 'up')}
                            >
                              <ArrowUp size={12} />
                            </button>

                            <button
                              type="button"
                              className="btn btn-xs"
                              title="Descer posição"
                              disabled={isLast}
                              onClick={() => moveItem(actualIndex, 'down')}
                            >
                              <ArrowDown size={12} />
                            </button>

                            <button
                              type="button"
                              className={`btn btn-xs ${item.visible ? '' : 'btn-danger'}`}
                              title={item.visible ? 'Ocultar da galeria pública' : 'Exibir na galeria pública'}
                              onClick={() => toggleVisibility(item.id)}
                            >
                              {item.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {filteredItems.length === 0 && (
                      <div className="text-muted text-xs" style={{ textAlign: 'center', padding: '32px' }}>
                        Nenhum artigo encontrado com o termo "{searchFilter}".
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* PAINEL DIREITO: PRÉ-VISUALIZAÇÃO EM TEMPO REAL NO IFRAME */}
            <div className="editor-preview-pane">
              <PreviewFrame
                kind="gallery"
                tick={tick}
                getPayload={buildPayload}
                onFocus={() => {}}
              />
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
}
