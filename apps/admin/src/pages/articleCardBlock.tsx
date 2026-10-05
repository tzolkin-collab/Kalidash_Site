import { createContext, useContext, useEffect, useState } from 'react';
import { BlockNoteSchema, defaultBlockSpecs } from '@blocknote/core';
import type { PartialBlock } from '@blocknote/core';
import { createReactBlockSpec } from '@blocknote/react';
import type { Article } from '../domain';
import { formatDate } from '../lib/format';
import { uploadImageNotifying } from '../lib/blog';

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
            ? <img className="gcard-cover" src={p.coverImageUrl} alt="" style={{ objectPosition: `50% ${p.coverImagePos}%` }} />
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
                <input type="range" min={0} max={100} value={p.coverImagePos} title="Ajustar corte (cima/baixo)" onChange={(e) => patch({ coverImagePos: Number(e.target.value) })} />
              )}
              <button type="button" onClick={() => editor.removeBlocks([block])}>Tirar da galeria</button>
            </div>
          </div>
        </div>
      );
    },
  },
);

export const blogSchema = BlockNoteSchema.create({
  blockSpecs: { ...defaultBlockSpecs, [CARD_TYPE]: createArticleCard() },
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
