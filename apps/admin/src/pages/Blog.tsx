import { useMemo, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Heading2, Heading3, Italic, List, ListOrdered, Plus, Quote, Redo2, Undo2 } from 'lucide-react';
import type { Post, PostStatus } from '../domain';
import { formatDate } from '../lib/format';
import { newId, useStore } from '../lib/store';
import { usePaged } from '../lib/usePaged';
import { postsStore } from '../mocks/posts';
import { teamStore } from '../mocks/team';
import { Badge, EmptyState, Field, Page, PageHeader, Pagination, SampleBanner, SearchBox, Tabs } from '../components/ui';
import type { Tone } from '../components/ui';

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

export default function Blog() {
  const [posts, setPosts] = useStore(postsStore);
  const [team] = useStore(teamStore);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

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
  const editing = posts.find((p) => p.id === editingId);

  const create = () => {
    const post: Post = { id: newId('post'), title: '', slug: '', excerpt: '', body: '', tags: [], status: 'DRAFT', author: team[0]?.name ?? 'Equipe', updatedAt: new Date().toISOString() };
    setPosts((prev) => [post, ...prev]);
    setEditingId(post.id);
  };

  if (editing) {
    return (
      <PostEditor
        key={editing.id}
        post={editing}
        onBack={() => {
          // Rascunho vazio que ninguém preencheu não fica na lista
          if (!editing.title.trim() && !editing.body.trim()) setPosts((prev) => prev.filter((p) => p.id !== editing.id));
          setEditingId(null);
        }}
        onSave={(next) => setPosts((prev) => prev.map((p) => (p.id === next.id ? { ...next, updatedAt: new Date().toISOString() } : p)))}
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
                <tr key={p.id} className="clickable" onClick={() => setEditingId(p.id)}>
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
  const [slug, setSlug] = useState(post.slug);
  const [slugTouched, setSlugTouched] = useState(post.slug !== '');
  const [excerpt, setExcerpt] = useState(post.excerpt);
  const [tags, setTags] = useState(post.tags.join(', '));
  const [status, setStatus] = useState<PostStatus>(post.status);
  const [publishAt, setPublishAt] = useState(toLocalInput(post.publishAt));
  const [seoTitle, setSeoTitle] = useState(post.seoTitle ?? '');
  const [seoDescription, setSeoDescription] = useState(post.seoDescription ?? '');
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const touch = () => { setSaved(false); setDirty(true); };

  const editor = useEditor({
    extensions: [StarterKit],
    content: post.body,
    shouldRerenderOnTransaction: true,
    editorProps: { attributes: { class: 'post-editor-area', 'aria-label': 'Corpo do artigo' } },
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
    });
    setSaved(true);
    setDirty(false);
  };

  const leave = () => {
    if (dirty && !window.confirm('Há alterações não salvas. Sair mesmo assim?')) return;
    onBack();
  };

  const tool = (label: string, Icon: typeof Bold, run: () => void, active: boolean, disabled = false) => (
    <button type="button" className={`tool-btn ${active ? 'active' : ''}`} onClick={run} disabled={disabled || !editor} title={label} aria-label={label} aria-pressed={active}><Icon size={15} /></button>
  );

  const shownTitle = seoTitle || title || 'Título do artigo';
  const shownDescription = seoDescription || excerpt || 'A descrição que aparece no Google.';

  return (
    <Page>
      <PageHeader
        title={title || 'Novo artigo'}
        subtitle={<><Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge> {saved && <span className="text-muted">Salvo agora.</span>}</>}
        actions={<><button type="button" className="btn" onClick={leave}>Voltar à lista</button><button type="button" className="btn btn-solid" disabled={!canSave} onClick={save}>Salvar</button></>}
      />
      <div className="editor-layout">
        <div className="form-stack">
          <Field label="Título"><input className="input title-input" value={title} onChange={(e) => { setTitle(e.target.value); touch(); if (!slugTouched) setSlug(slugify(e.target.value)); }} placeholder="O título do artigo" /></Field>
          <div className="editor-box">
            <div className="tool-row" role="toolbar" aria-label="Formatação">
              {tool('Negrito', Bold, () => editor?.chain().focus().toggleBold().run(), editor?.isActive('bold') ?? false)}
              {tool('Itálico', Italic, () => editor?.chain().focus().toggleItalic().run(), editor?.isActive('italic') ?? false)}
              {tool('Título 2', Heading2, () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), editor?.isActive('heading', { level: 2 }) ?? false)}
              {tool('Título 3', Heading3, () => editor?.chain().focus().toggleHeading({ level: 3 }).run(), editor?.isActive('heading', { level: 3 }) ?? false)}
              {tool('Lista', List, () => editor?.chain().focus().toggleBulletList().run(), editor?.isActive('bulletList') ?? false)}
              {tool('Lista numerada', ListOrdered, () => editor?.chain().focus().toggleOrderedList().run(), editor?.isActive('orderedList') ?? false)}
              {tool('Citação', Quote, () => editor?.chain().focus().toggleBlockquote().run(), editor?.isActive('blockquote') ?? false)}
              <span className="tool-sep" />
              {tool('Desfazer', Undo2, () => editor?.chain().focus().undo().run(), false, !editor?.can().undo())}
              {tool('Refazer', Redo2, () => editor?.chain().focus().redo().run(), false, !editor?.can().redo())}
            </div>
            <EditorContent editor={editor} />
          </div>
          <Field label="Resumo" hint="Aparece nas listagens do site."><textarea className="textarea" value={excerpt} onChange={(e) => { setExcerpt(e.target.value); touch(); }} /></Field>
        </div>

        <aside className="form-stack editor-side">
          <div className="panel-card form-stack">
            <Field label="Status">
              <select className="select" value={status} onChange={(e) => { setStatus(e.target.value as PostStatus); touch(); }}>
                {(Object.keys(STATUS_LABEL) as PostStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </Field>
            {status === 'SCHEDULED' && <Field label="Publicar em" hint={scheduleMissing ? 'Escolha a data e a hora.' : undefined}><input className="input" type="datetime-local" value={publishAt} onChange={(e) => { setPublishAt(e.target.value); touch(); }} /></Field>}
            <Field label="Endereço (slug)" hint={`/blog/${slug || '…'}`}><input className="input mono" value={slug} onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)); touch(); }} /></Field>
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
    </Page>
  );
}
