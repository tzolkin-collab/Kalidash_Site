import { useMemo, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import GlobalDragHandle from 'tiptap-extension-global-drag-handle';
import ImageResize from 'tiptap-extension-resize-image';
import { Bold, Heading2, Heading3, Italic, List, ListOrdered, Plus, Quote, Redo2, Undo2, Image as ImageIcon, ImagePlus, Crop } from 'lucide-react';
import type { Post, PostStatus } from '../domain';
import { formatDate } from '../lib/format';
import { newId, useStore } from '../lib/store';
import { usePaged } from '../lib/usePaged';
import { postsStore } from '../mocks/posts';
import { teamStore } from '../mocks/team';
import { Badge, EmptyState, Field, Page, PageHeader, Pagination, PopupDialog, SampleBanner, SearchBox, Tabs } from '../components/ui';
import type { Tone } from '../components/ui';
import { CustomSelect } from '../components/ui';
import Peek from '../components/Peek';
import { useShell } from '../lib/shell';
// @ts-ignore
import siteStyles from '../../../../apps/site/src/app/blog/[slug]/article.module.css';

const STATUS_LABEL: Record<PostStatus, string> = { PUBLISHED: 'Publicado', DRAFT: 'Rascunho', SCHEDULED: 'Agendado' };
const STATUS_TONE: Record<PostStatus, Tone> = { PUBLISHED: 'success', DRAFT: 'neutral', SCHEDULED: 'info' };
type Filter = 'ALL' | PostStatus;

const slugify = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** "2026-10-05T12:00:00Z" -> valor de <input type="datetime-local"> no horário local. */
const toLocalInput = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function Blog({ postId }: { postId?: string }) {
  const [posts, setPosts] = useStore(postsStore);
  const [team] = useStore(teamStore);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');
  const shell = useShell();

  const counts = useMemo(() => ({
    ALL: posts.length,
    PUBLISHED: posts.filter((p) => p.status === 'PUBLISHED').length,
    DRAFT: posts.filter((p) => p.status === 'DRAFT').length,
    SCHEDULED: posts.filter((p) => p.status === 'SCHEDULED').length,
  }), [posts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts
      .filter((p) => (filter === 'ALL' || p.status === filter) && (!q || `${p.title} ${p.slug} ${p.tags.join(' ')}`.toLowerCase().includes(q)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [posts, filter, search]);

  const paged = usePaged(filtered, 10);
  
  // Use postId from props or route, fallback to undefined
  const editing = postId && postId !== 'novo' ? posts.find((p) => p.id === postId) : (postId === 'novo' ? { id: 'novo', title: '', slug: '', excerpt: '', body: '', tags: [], status: 'DRAFT', author: team[0]?.name ?? 'Equipe', updatedAt: new Date().toISOString() } as Post : undefined);

  const create = () => {
    shell.navigate('/blog/novo');
  };

  if (editing) {
    return (
      <PostEditor
        key={editing.id}
        post={editing}
        onBack={() => {
          shell.navigate('/blog');
        }}
        onSave={(next) => {
          if (editing.id === 'novo') {
            const finalPost = { ...next, id: newId('post') };
            setPosts((prev) => [finalPost, ...prev]);
            shell.navigate(`/blog/${finalPost.id}`);
          } else {
            setPosts((prev) => prev.map((p) => (p.id === next.id ? { ...next, updatedAt: new Date().toISOString() } : p)));
          }
        }}
      />
    );
  }

  return (
    <Page>
      <PageHeader
        title="Blog"
        subtitle="Escreva e publique os artigos do site. O site regenera as páginas sozinho (ISR), sem precisar de novo deploy."
        actions={<button type="button" className="btn btn-solid" onClick={create}><Plus size={14} /> Novo artigo</button>}
      />
      <SampleBanner>O CMS ainda não tem tabela nem API: os artigos abaixo são de exemplo e recarregar a página restaura a lista.</SampleBanner>

      <Tabs
        tabs={[{ id: 'ALL' as Filter, label: 'Todos', count: counts.ALL }, { id: 'PUBLISHED' as Filter, label: 'Publicados', count: counts.PUBLISHED }, { id: 'DRAFT' as Filter, label: 'Rascunhos', count: counts.DRAFT }, { id: 'SCHEDULED' as Filter, label: 'Agendados', count: counts.SCHEDULED }]}
        value={filter}
        onChange={setFilter}
      />
      <div className="toolbar"><SearchBox value={search} onChange={setSearch} placeholder="Buscar por título, endereço ou tag…" /></div>

      <div className="table-card">
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Artigo</th><th>Status</th><th>Autor</th><th>Tags</th><th>Atualizado</th></tr></thead>
            <tbody>
              {paged.rows.map((p) => (
                <tr key={p.id} className="clickable" onClick={() => shell.navigate(`/blog/${p.id}`)}>
                  <td><div className="cell-stack"><span className="cell-primary">{p.title || 'Sem título'}</span><span className="text-xs text-muted mono">/blog/{p.slug || '…'}</span></div></td>
                  <td>
                    <Badge tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                    {p.status === 'SCHEDULED' && p.publishAt && <div className="text-xs text-muted">para {formatDate(p.publishAt)}</div>}
                  </td>
                  <td>{p.author}</td>
                  <td><div className="tag-row">{p.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div></td>
                  <td className="text-muted">{formatDate(p.updatedAt)}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5}><EmptyState title="Nenhum artigo">Ajuste o filtro ou comece um artigo novo.</EmptyState></td></tr>}
            </tbody>
          </table>
        </div>
        <Pagination page={paged.page} pageSize={paged.pageSize} total={paged.total} onPage={paged.setPage} onPageSize={paged.setPageSize} />
      </div>
    </Page>
  );
}

/* ------------------------------ Editor ------------------------------ */

function PostEditor({ post, onBack, onSave }: { post: Post; onBack: () => void; onSave: (p: Post) => void }) {
  const [title, setTitle] = useState(post.title);
  const [slug, setSlug] = useState(post.slug || 'p-' + Math.random().toString(36).substr(2, 6));
  const [excerpt, setExcerpt] = useState(post.excerpt);
  const [coverImage, setCoverImage] = useState(post.coverImage || '');
  const [coverCrop, setCoverCrop] = useState(50); // percentage for object-position
  const [tags, setTags] = useState(post.tags.join(', '));
  const [status, setStatus] = useState<PostStatus>(post.status);
  const [publishAt, setPublishAt] = useState(toLocalInput(post.publishAt));
  const [seoTitle, setSeoTitle] = useState(post.seoTitle ?? '');
  const [seoDescription, setSeoDescription] = useState(post.seoDescription ?? '');
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [imageDialog, setImageDialog] = useState<'body' | 'cover' | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const touch = () => { setSaved(false); setDirty(true); };

  const editor = useEditor({
    extensions: [
      StarterKit, 
      Image.configure({ inline: true }),
      ImageResize,
      GlobalDragHandle.configure({ dragHandleWidth: 20, scrollTreshold: 100 })
    ],
    content: post.body,
    shouldRerenderOnTransaction: true,
    editorProps: { attributes: { class: 'post-editor-area blog-preview-body', 'aria-label': 'Corpo do artigo' } },
    onUpdate: () => { setSaved(false); setDirty(true); },
  });

  const scheduleMissing = status === 'SCHEDULED' && publishAt === '';
  const canSave = title.trim() !== '' && slug.trim() !== '' && !scheduleMissing;

  const save = () => {
    if (!canSave || !editor) return;
    onSave({
      ...post, title: title.trim(), slug: slug.trim(), excerpt: excerpt.trim(), body: editor.getHTML(), status,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      publishAt: status === 'SCHEDULED' ? new Date(publishAt).toISOString() : undefined,
      seoTitle: seoTitle.trim() || undefined, seoDescription: seoDescription.trim() || undefined,
      coverImage: coverImage.trim() || undefined,
    });
    setSaved(true);
    setDirty(false);
  };

  const leave = () => {
    if (dirty) { setLeaveDialogOpen(true); return; }
    onBack();
  };

  const tool = (label: string, Icon: typeof Bold, run: () => void, active: boolean, disabled = false) => (
    <button type="button" className={`tool-btn ${active ? 'active' : ''}`} onClick={run} disabled={disabled || !editor} title={label} aria-label={label} aria-pressed={active}><Icon size={15} /></button>
  );

  const shownTitle = seoTitle || title || 'Título do artigo';
  const shownDescription = seoDescription || excerpt || 'A descrição que aparece no Google.';

  const addImage = () => {
    setImageUrl('');
    setImageDialog('body');
  };

  const addImageFromDialog = () => {
    const url = imageUrl.trim();
    if (!url) return;
    if (imageDialog === 'cover') setCoverImage(url);
    else editor?.chain().focus().setImage({ src: url }).run();
    touch();
    setImageDialog(null);
  };

  return (
    <Page>
      <PageHeader
        title={title || 'Novo artigo'}
        subtitle={<><Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge> {saved && <span className="text-muted">Salvo agora.</span>}</>}
        actions={
          <>
            <button type="button" className="btn" onClick={leave}>Voltar</button>
            <button type="button" className="btn btn-solid" disabled={!canSave} onClick={save}>Salvar</button>
          </>
        }
      />
      
      <div className="editor-layout">
        <div className="form-stack">
          <div className="editor-box">
            <div className="tool-row" role="toolbar" aria-label="Formatação">
              {tool('Negrito', Bold, () => editor?.chain().focus().toggleBold().run(), editor?.isActive('bold') ?? false)}
              {tool('Itálico', Italic, () => editor?.chain().focus().toggleItalic().run(), editor?.isActive('italic') ?? false)}
              {tool('Título 2', Heading2, () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), editor?.isActive('heading', { level: 2 }) ?? false)}
              {tool('Título 3', Heading3, () => editor?.chain().focus().toggleHeading({ level: 3 }).run(), editor?.isActive('heading', { level: 3 }) ?? false)}
              {tool('Lista', List, () => editor?.chain().focus().toggleBulletList().run(), editor?.isActive('bulletList') ?? false)}
              {tool('Lista numerada', ListOrdered, () => editor?.chain().focus().toggleOrderedList().run(), editor?.isActive('orderedList') ?? false)}
              {tool('Citação', Quote, () => editor?.chain().focus().toggleBlockquote().run(), editor?.isActive('blockquote') ?? false)}
              {tool('Imagem', ImageIcon, addImage, false)}
              <span className="tool-sep" />
              {tool('Desfazer', Undo2, () => editor?.chain().focus().undo().run(), false, !editor?.can().undo())}
              {tool('Refazer', Redo2, () => editor?.chain().focus().redo().run(), false, !editor?.can().redo())}
            </div>

            <div className={siteStyles.page}>
              <header>
                <a href="#" style={{ pointerEvents: 'none' }}>← Blog</a>
                <a href="#" style={{ pointerEvents: 'none' }}>Kalidash</a>
              </header>
              <article>
                <p>
                  {tags.split(',')[0] || 'Kalidash'} · {formatDate(new Date().toISOString())}
                </p>
                <input 
                  value={title} 
                  onChange={(e) => { setTitle(e.target.value); touch(); }} 
                  placeholder="Título da publicação"
                  style={{ 
                    width: '100%', border: 'none', background: 'transparent', outline: 'none',
                    margin: '26px 0 34px', fontSize: 'clamp(3rem, 7vw, 7rem)', fontWeight: 500, lineHeight: 0.94, letterSpacing: '-0.07em', color: 'inherit', fontFamily: 'inherit'
                  }} 
                />
                <textarea 
                  value={excerpt} 
                  onChange={(e) => { setExcerpt(e.target.value); touch(); }} 
                  placeholder="Resumo do artigo..."
                  className={siteStyles.excerpt}
                  style={{ 
                    width: '100%', border: 'none', background: 'transparent', outline: 'none', resize: 'none', fontFamily: 'inherit'
                  }}
                  rows={2}
                />
                <span style={{ display: 'block', margin: '30px 0 70px', fontSize: '0.8rem' }}>
                  {post.author}
                </span>

                {coverImage ? (
                  <div style={{ position: 'relative', width: '100%', marginBottom: '80px', group: 'cover' }}>
                    <img 
                      src={coverImage} 
                      alt="Capa" 
                      className={siteStyles.cover}
                      style={{ maxHeight: '600px', objectFit: 'cover', objectPosition: `50% ${coverCrop}%`, display: 'block' }} 
                    />
                    <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 8 }}>
                      <input 
                        type="range" min="0" max="100" value={coverCrop} 
                        onChange={(e) => { setCoverCrop(Number(e.target.value)); touch(); }}
                        style={{ width: 100 }} title="Ajustar corte (Cima/Baixo)"
                      />
                      <button onClick={() => { setCoverImage(''); touch(); }} className="btn btn-sm">Remover Capa</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setImageUrl(''); setImageDialog('cover'); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '40px', border: '2px dashed #d9d1df', borderRadius: '12px', background: 'transparent', color: '#625969', cursor: 'pointer', marginBottom: '80px', fontSize: '1.1rem' }}>
                    <ImagePlus size={24} /> Adicionar foto de capa
                  </button>
                )}

                <div className={siteStyles.body}>
                  <EditorContent editor={editor} />
                </div>
              </article>
            </div>
          </div>
        </div>

        <aside className="form-stack editor-side">
          <div className="panel-card form-stack">
            <Field label="Status">
              <CustomSelect className="select" value={status} onChange={(e) => { setStatus(e.target.value as PostStatus); touch(); }}>
                {(Object.keys(STATUS_LABEL) as PostStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </CustomSelect>
            </Field>
            {status === 'SCHEDULED' && <Field label="Publicar em" hint={scheduleMissing ? 'Escolha a data e a hora.' : undefined}><input className="input" type="datetime-local" value={publishAt} onChange={(e) => { setPublishAt(e.target.value); touch(); }} /></Field>}
            <Field label="Endereço (slug)" hint={`/blog/${slug || '…'}`}><input className="input mono" value={slug} onChange={(e) => { setSlug(e.target.value); touch(); }} /></Field>
            <Field label="Tags" hint="Separe por vírgula."><input className="input" value={tags} onChange={(e) => { setTags(e.target.value); touch(); }} /></Field>
          </div>

          <div className="panel-card form-stack">
            <h3 className="section-title" style={{ margin: 0 }}>SEO</h3>
            <Field label="Título para o Google" hint={`${seoTitle.length}/60`}><input className="input" value={seoTitle} maxLength={70} onChange={(e) => { setSeoTitle(e.target.value); touch(); }} /></Field>
            <Field label="Descrição" hint={`${seoDescription.length}/160`}><textarea className="textarea" style={{ minHeight: '72px' }} value={seoDescription} maxLength={180} onChange={(e) => { setSeoDescription(e.target.value); touch(); }} /></Field>
            <div className="serp" aria-label="Prévia no Google">
              <div className="serp-url">kalidash.com.br › blog › {slug || '…'}</div>
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

      {imageDialog && <PopupDialog
        eyebrow={imageDialog === 'cover' ? 'IMAGEM DE CAPA' : 'EDITOR DO ARTIGO'}
        title={imageDialog === 'cover' ? 'Adicionar capa' : 'Adicionar imagem'}
        description="Cole o endereço público da imagem que será exibida no artigo."
        onClose={() => setImageDialog(null)}
        footer={<><button type="button" className="btn" onClick={() => setImageDialog(null)}>Cancelar</button><button type="button" className="btn btn-solid" disabled={!imageUrl.trim()} onClick={addImageFromDialog}>Adicionar imagem</button></>}
      >
        <Field label="URL da imagem"><input className="input" type="url" autoFocus value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addImageFromDialog(); }} placeholder="https://exemplo.com/imagem.webp" /></Field>
      </PopupDialog>}
    </Page>
  );
}
