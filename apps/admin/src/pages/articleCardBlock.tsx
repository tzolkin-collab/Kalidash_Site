import { createContext, useContext, useEffect, useState } from 'react';
import { BlockNoteSchema, defaultBlockSpecs } from '@blocknote/core';
import type { PartialBlock } from '@blocknote/core';
import { createReactBlockSpec } from '@blocknote/react';
import { Columns, Crop, ImagePlus, Layout, Trash2 } from 'lucide-react';
import type { Article } from '../domain';
import { formatDate } from '../lib/format';
import { uploadImageNotifying } from '../lib/blog';
import { resolveAssetUrl } from '../lib/site';
import { PhotoCropModal } from '../components/PhotoCropModal';

/* Cartão de artigo da Galeria Principal.
 *
 * É um bloco do BlockNote que aponta pra um Article real (articleId). As props são um retrato
 * do artigo — título, resumo e capa são editáveis aqui mesmo e o admin grava de volta no
 * Article quando a Galeria é salva (ver saveCardEdits em Blog.tsx). A posição do bloco no
 * documento é a ordem no site, e o primeiro cartão é o destaque (mesma regra do /blog: index 0).
 * A UI aqui é neutra (admin): o visual de verdade é o do site, visto no iframe de preview. */

export const CARD_TYPE = 'articleCard';

/** articles: artigos de verdade; flashId: cartão a destacar (clique no preview). Vai por contexto
 *  porque o BlockNote recria o DOM do bloco ao atualizar props, o que apagaria uma classe posta à mão. */
export const ArticleCardsContext = createContext<{ articles: Article[]; flashId: string | null }>({ articles: [], flashId: null });

/** Índice deste cartão entre os cartões do documento; recalcula quando o documento muda
 *  (arrastar um bloco não re-renderiza os vizinhos, então escutamos o editor). */
function useCardIndex(editor: { document: { id: string; type: string }[]; onChange: (cb: () => void) => () => void }, id: string) {
  const compute = () => editor.document.filter((b) => b.type === CARD_TYPE).findIndex((b) => b.id === id);
  const [index, setIndex] = useState(compute);
  useEffect(() => editor.onChange(() => setIndex(compute())), [editor, id]); // eslint-disable-line react-hooks/exhaustive-deps
  return index;
}

const cardMeta = (a: Article) =>
  `${a.categories?.[0] || 'Kalidash'} · ${a.publishedAt ? formatDate(a.publishedAt) : 'Em breve'}`;

/** Props de um cartão a partir do artigo (retrato no momento da sincronização). */
export const cardPropsFrom = (a: Article) => ({
  articleId: a.id,
  title: a.title,
  excerpt: a.excerpt,
  coverImageUrl: a.coverImageUrl ?? '',
  coverImagePos: a.coverImagePos ?? 50,
  meta: cardMeta(a),
  authorName: a.authorName || 'Equipe Kalidash',
});

const createArticleCard = createReactBlockSpec(
  {
    type: CARD_TYPE,
    content: 'none',
    propSchema: {
      articleId: { default: '' },
      title: { default: '' },
      excerpt: { default: '' },
      coverImageUrl: { default: '' },
      coverImagePos: { default: 50 },
      meta: { default: '' },
      authorName: { default: '' },
    },
  },
  {
    render: ({ block, editor }) => {
      const { articles, flashId } = useContext(ArticleCardsContext);
      const index = useCardIndex(editor as never, block.id);
      const p = block.props;
      const patch = (props: Partial<typeof p>) => editor.updateBlock(block, { props });

      if (!p.articleId) {
        const taken = new Set(editor.document.filter((b) => b.type === CARD_TYPE).map((b) => (b.props as { articleId: string }).articleId));
        const options = articles.filter((a) => a.published && !taken.has(a.id));
        return (
          <div className="gcard gcard-picker" contentEditable={false}>
            <span>Escolha o artigo deste cartão</span>
            <select value="" onChange={(e) => { const a = articles.find((x) => x.id === e.target.value); if (a) patch(cardPropsFrom(a)); }}>
              <option value="">{options.length ? 'Selecionar…' : 'Todos os artigos publicados já estão na galeria'}</option>
              {options.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
            </select>
            <button type="button" onClick={() => editor.removeBlocks([block])}>Remover</button>
          </div>
        );
      }

      return (
        <div className={`gcard ${flashId === block.id ? 'block-flash' : ''}`} contentEditable={false}>
          {p.coverImageUrl
            ? <img className="gcard-cover" src={resolveAssetUrl(p.coverImageUrl)} alt="" style={{ objectPosition: `50% ${p.coverImagePos}%` }} />
            : <div className="gcard-cover gcard-cover-empty">sem capa</div>}
          <div className="gcard-main">
            <div className="gcard-meta">
              {index === 0 && <em>Destaque</em>}
              <span>{p.meta}</span>
            </div>
            <input className="gcard-title" value={p.title} placeholder="Título" onChange={(e) => patch({ title: e.target.value })} />
            <textarea className="gcard-excerpt" value={p.excerpt} rows={2} placeholder="Resumo" onChange={(e) => patch({ excerpt: e.target.value })} />
            <div className="gcard-tools">
              <label>
                {p.coverImageUrl ? 'Trocar capa' : 'Adicionar capa'}
                <input
                  type="file" accept="image/*" hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadImageNotifying(file).then((url) => patch({ coverImageUrl: url })).catch(() => undefined);
                    e.target.value = '';
                  }}
                />
              </label>
              {p.coverImageUrl && (
                <span className="gcard-pos-tool" title="Ajustar corte vertical (0% topo, 100% base)">
                  <span>Corte:</span>
                  <input type="range" min={0} max={100} value={p.coverImagePos} onChange={(e) => patch({ coverImagePos: Number(e.target.value) })} />
                </span>
              )}
              <button type="button" onClick={() => editor.removeBlocks([block])}>Tirar da galeria</button>
            </div>
          </div>
        </div>
      );
    },
  },
);

/* ---------------- Bloco: Foto e Texto Lado a Lado ---------------- */
export const SPLIT_MEDIA_TYPE = 'splitMedia';

const createSplitMediaBlock = createReactBlockSpec(
  {
    type: SPLIT_MEDIA_TYPE,
    content: 'none',
    propSchema: {
      imageUrl: { default: '' },
      imageAlt: { default: '' },
      imagePos: { default: 'left' }, // 'left' | 'right'
      imageRatio: { default: '45' }, // '35' | '45' | '50'
      tag: { default: '' },
      title: { default: '' },
      text: { default: '' },
      caption: { default: '' },
    },
  },
  {
    render: ({ block, editor }) => {
      const p = block.props;
      const [cropOpen, setCropOpen] = useState(false);
      const patch = (props: Partial<typeof p>) => editor.updateBlock(block, { props });

      return (
        <div
          className={`split-editor-card pos-${p.imagePos}`}
          contentEditable={false}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Barra Superior de Controles do Bloco */}
          <div className="split-toolbar" onMouseDown={(e) => e.stopPropagation()}>
            <span className="split-badge">
              <Layout size={12} />
              <span>Foto e Texto Lado a Lado</span>
            </span>

            <div className="split-toolbar-actions">
              <span className="split-tool-group">
                <span className="text-muted" style={{ fontSize: '11px' }}>Foto:</span>
                <button
                  type="button"
                  className={`btn-tool-pill ${p.imagePos === 'left' ? 'is-active' : ''}`}
                  onClick={() => patch({ imagePos: 'left' })}
                  title="Posicionar foto na esquerda"
                >
                  Esquerda
                </button>
                <button
                  type="button"
                  className={`btn-tool-pill ${p.imagePos === 'right' ? 'is-active' : ''}`}
                  onClick={() => patch({ imagePos: 'right' })}
                  title="Posicionar foto na direita"
                >
                  Direita
                </button>
              </span>

              <span className="split-tool-group">
                <span className="text-muted" style={{ fontSize: '11px' }}>Largura:</span>
                {(['35', '45', '50'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`btn-tool-pill ${p.imageRatio === r ? 'is-active' : ''}`}
                    onClick={() => patch({ imageRatio: r })}
                    title={`Largura da foto: ${r}%`}
                  >
                    {r}%
                  </button>
                ))}
              </span>

              <button
                type="button"
                className="btn-tool-pill is-danger"
                onClick={() => editor.removeBlocks([block])}
                title="Remover este bloco"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>

          {/* Grid Lado a Lado do Editor */}
          <div className={`split-body-grid ratio-${p.imageRatio} img-${p.imagePos}`}>
            {/* Coluna da Foto */}
            <div className="split-col-media">
              {p.imageUrl ? (
                <div className="split-image-preview-box">
                  <img src={resolveAssetUrl(p.imageUrl)} alt={p.imageAlt || ''} />
                  <div className="split-image-actions">
                    <button
                      type="button"
                      className="btn btn-xs btn-solid"
                      onClick={() => setCropOpen(true)}
                      title="Cortar e enquadrar foto com proporção"
                    >
                      <Crop size={11} /> Cortar
                    </button>
                    <label className="btn btn-xs" style={{ cursor: 'pointer' }}>
                      Trocar
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadImageNotifying(file).then((url) => patch({ imageUrl: url })).catch(() => undefined);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <label className="split-image-placeholder">
                  <ImagePlus size={22} className="text-muted" />
                  <span>+ Adicionar foto do bloco</span>
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadImageNotifying(file).then((url) => patch({ imageUrl: url })).catch(() => undefined);
                      e.target.value = '';
                    }}
                  />
                </label>
              )}

              <input
                className="split-caption-input"
                value={p.caption}
                placeholder="Legenda da foto (opcional)..."
                onChange={(e) => patch({ caption: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>

            {/* Coluna do Conteúdo / Texto */}
            <div className="split-col-content">
              <input
                className="split-tag-input"
                value={p.tag}
                placeholder="TAG OU ETIQUETA (EX: ANÁLISE, MÉTRICAS)"
                onChange={(e) => patch({ tag: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
              />
              <input
                className="split-title-input"
                value={p.title}
                placeholder="Título da seção..."
                onChange={(e) => patch({ title: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
              />
              <textarea
                className="split-text-area"
                rows={4}
                value={p.text}
                placeholder="Escreva o texto explicativo que acompanha a foto..."
                onChange={(e) => patch({ text: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Modal de Corte Integrado */}
          {cropOpen && p.imageUrl && (
            <PhotoCropModal
              isOpen={cropOpen}
              imageUrl={p.imageUrl}
              aspectRatio="4:3"
              title="Cortar Foto do Bloco Lado a Lado"
              onClose={() => setCropOpen(false)}
              onApply={(newUrl) => {
                patch({ imageUrl: newUrl });
                setCropOpen(false);
              }}
            />
          )}
        </div>
      );
    },
    toExternalHTML: ({ block }) => {
      const p = block.props;
      return (
        <div className={`split-media-block ratio-${p.imageRatio} img-${p.imagePos}`} data-block="split-media">
          <div className="split-media-col">
            {p.imageUrl ? (
              <figure className="split-media-figure">
                <img src={resolveAssetUrl(p.imageUrl)} alt={p.imageAlt || p.title || ''} />
                {p.caption ? <figcaption className="split-caption">{p.caption}</figcaption> : null}
              </figure>
            ) : null}
          </div>
          <div className="split-content-col">
            {p.tag ? <span className="split-tag">{p.tag}</span> : null}
            {p.title ? <h3 className="split-title">{p.title}</h3> : null}
            {p.text ? <div className="split-text">{p.text}</div> : null}
          </div>
        </div>
      );
    },
  },
);

/* ---------------- Bloco: Duas Colunas de Texto ---------------- */
export const TWO_COLUMNS_TYPE = 'twoColumns';

const createTwoColumnsBlock = createReactBlockSpec(
  {
    type: TWO_COLUMNS_TYPE,
    content: 'none',
    propSchema: {
      colRatio: { default: '50' }, // '50' | '60-40' | '40-60'
      col1Tag: { default: '' },
      col1Title: { default: '' },
      col1Text: { default: '' },
      col2Tag: { default: '' },
      col2Title: { default: '' },
      col2Text: { default: '' },
    },
  },
  {
    render: ({ block, editor }) => {
      const p = block.props;
      const patch = (props: Partial<typeof p>) => editor.updateBlock(block, { props });

      return (
        <div
          className="columns-editor-card"
          contentEditable={false}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="split-toolbar" onMouseDown={(e) => e.stopPropagation()}>
            <span className="split-badge">
              <Columns size={12} />
              <span>Duas Colunas de Conteúdo</span>
            </span>

            <div className="split-toolbar-actions">
              <span className="split-tool-group">
                <span className="text-muted" style={{ fontSize: '11px' }}>Proporção:</span>
                <button
                  type="button"
                  className={`btn-tool-pill ${p.colRatio === '50' ? 'is-active' : ''}`}
                  onClick={() => patch({ colRatio: '50' })}
                >
                  50 / 50
                </button>
                <button
                  type="button"
                  className={`btn-tool-pill ${p.colRatio === '60-40' ? 'is-active' : ''}`}
                  onClick={() => patch({ colRatio: '60-40' })}
                >
                  60 / 40
                </button>
                <button
                  type="button"
                  className={`btn-tool-pill ${p.colRatio === '40-60' ? 'is-active' : ''}`}
                  onClick={() => patch({ colRatio: '40-60' })}
                >
                  40 / 60
                </button>
              </span>

              <button
                type="button"
                className="btn-tool-pill is-danger"
                onClick={() => editor.removeBlocks([block])}
                title="Remover colunas"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>

          <div className={`columns-body-grid ratio-${p.colRatio}`}>
            <div className="col-editor-pane">
              <input
                className="split-tag-input"
                value={p.col1Tag}
                placeholder="ETIQUETA DA COLUNA 1"
                onChange={(e) => patch({ col1Tag: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
              />
              <input
                className="split-title-input"
                value={p.col1Title}
                placeholder="Título da coluna 1..."
                onChange={(e) => patch({ col1Title: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
              />
              <textarea
                className="split-text-area"
                rows={4}
                value={p.col1Text}
                placeholder="Conteúdo da coluna 1..."
                onChange={(e) => patch({ col1Text: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>

            <div className="col-editor-pane">
              <input
                className="split-tag-input"
                value={p.col2Tag}
                placeholder="ETIQUETA DA COLUNA 2"
                onChange={(e) => patch({ col2Tag: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
              />
              <input
                className="split-title-input"
                value={p.col2Title}
                placeholder="Título da coluna 2..."
                onChange={(e) => patch({ col2Title: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
              />
              <textarea
                className="split-text-area"
                rows={4}
                value={p.col2Text}
                placeholder="Conteúdo da coluna 2..."
                onChange={(e) => patch({ col2Text: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        </div>
      );
    },
    toExternalHTML: ({ block }) => {
      const p = block.props;
      return (
        <div className={`two-columns-block ratio-${p.colRatio}`} data-block="two-columns">
          <div className="col-item">
            {p.col1Tag ? <span className="col-tag">{p.col1Tag}</span> : null}
            {p.col1Title ? <h4 className="col-title">{p.col1Title}</h4> : null}
            {p.col1Text ? <div className="col-text">{p.col1Text}</div> : null}
          </div>
          <div className="col-item">
            {p.col2Tag ? <span className="col-tag">{p.col2Tag}</span> : null}
            {p.col2Title ? <h4 className="col-title">{p.col2Title}</h4> : null}
            {p.col2Text ? <div className="col-text">{p.col2Text}</div> : null}
          </div>
        </div>
      );
    },
  },
);

export const blogSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    [CARD_TYPE]: createArticleCard(),
    [SPLIT_MEDIA_TYPE]: createSplitMediaBlock(),
    [TWO_COLUMNS_TYPE]: createTwoColumnsBlock(),
  },
});

type Card = PartialBlock<typeof blogSchema.blockSchema>;

/** Deixa os cartões do documento em dia com os artigos de verdade: atualiza o retrato, tira os
 *  cartões de artigos que não existem mais ou foram despublicados, e (com `appendMissing`)
 *  acrescenta no fim um cartão por artigo publicado que ainda não está na galeria. */
export function syncCards(blocks: Card[], articles: Article[], appendMissing: boolean): Card[] {
  const live = new Map(articles.filter((a) => a.published && a.slug !== 'blog-global').map((a) => [a.id, a]));
  const seen = new Set<string>();
  const out: Card[] = [];
  for (const b of blocks) {
    if (b.type !== CARD_TYPE) { out.push(b); continue; }
    const id = (b.props as { articleId?: string } | undefined)?.articleId ?? '';
    if (!id) { out.push(b); continue; }
    const a = live.get(id);
    if (!a || seen.has(id)) continue;
    seen.add(id);
    out.push({ ...b, props: cardPropsFrom(a) });
  }
  if (appendMissing) {
    for (const a of live.values()) if (!seen.has(a.id)) out.push({ type: CARD_TYPE, props: cardPropsFrom(a) });
  }
  return out;
}
