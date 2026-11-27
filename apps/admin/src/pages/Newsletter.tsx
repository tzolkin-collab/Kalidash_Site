import { useMemo, useState } from 'react';
import { Download, LayoutTemplate, Send, Upload, UserPlus } from 'lucide-react';
import type { Lead } from '../domain';
import { formatDate } from '../lib/format';
import { useStore } from '../lib/store';
import { useCrmMode } from '../lib/crmMode';
import { usePaged } from '../lib/usePaged';
import { leadsStore } from '../mocks/leads';
import LeadSheet from '../components/LeadSheet';
import PartySheets from '../components/PartySheets';
import type { PartyRef } from '../components/PartySheets';
import { CustomSelect, InfoPop, EmptyState, Page, PageHeader, Pagination, SampleBanner, SearchBox, StatCard, Tabs } from '../components/ui';
import { LabelBadge, LeadStatusBadge } from '../components/badges';
import NewsletterEmails from '../components/NewsletterEmails';

/* Newsletter do blog. Não há cadastro à parte: cada inscrição feita no site (POST /api/public/leads com a origem
 * "blog-newsletter-…") vira um Lead no CRM, com a tag "Newsletter" e a origem do formulário em customData.formSource.
 * Esta página junta esses leads por e-mail (quem se inscreveu duas vezes conta uma) e mostra de onde cada pessoa veio.
 * Origens que o site manda (apps/site/src/app/blog/NewsletterSignup.tsx):
 *   blog-newsletter-topo               quadro no topo do artigo
 *   blog-newsletter-artigo             faixa no fim do artigo
 *   blog-newsletter-blog               faixa na página do blog
 *   blog-newsletter-material-<slug>    bloco "Material gratuito" dos guias longos (a equipe manda o material) */

const PREFIX = 'blog-newsletter';

type Lugar = 'topo' | 'artigo' | 'blog' | 'material' | 'outro';
const LUGAR: Record<Lugar, string> = {
  topo: 'Topo do artigo',
  artigo: 'Fim do artigo',
  blog: 'Página do blog',
  material: 'Material gratuito',
  outro: 'Blog',
};

type Inscricao = { lead: Lead; lugar: Lugar; material?: string; pagina?: string; utm?: string };
type Inscrito = {
  email: string;
  nome: string;
  primeira: string;
  ultima: string;
  inscricoes: Inscricao[];
  materiais: string[];
  /** lead mais recente: é o que abre ao clicar */
  lead: Lead;
};

const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** A origem do formulário: customData.formSource (gravado pela API) ou, se faltar, o nome da fonte "Site — …". */
function formSource(l: Lead): string {
  const fs = str(l.customData?.formSource);
  if (fs) return fs;
  const m = l.sourceName.match(/blog-newsletter[\w-]*/);
  return m ? m[0] : '';
}

function isNewsletterLead(l: Lead): boolean {
  return formSource(l).startsWith(PREFIX) || l.tags.includes('Newsletter');
}

function lerInscricao(l: Lead): Inscricao {
  const resto = formSource(l).slice(PREFIX.length).replace(/^-/, '');
  const attr = (l.customData?.attribution ?? {}) as Record<string, unknown>;
  const pagina = str(attr.page_url) || str(attr.landing_page);
  const utm = str(attr.utm_source) || str(attr.first_utm_source);
  let lugar: Lugar = 'outro';
  let material: string | undefined;
  if (resto.startsWith('material')) {
    lugar = 'material';
    material = resto.slice('material'.length).replace(/^-/, '') || undefined;
  } else if (resto === 'topo' || resto === 'artigo' || resto === 'blog') lugar = resto;
  return { lead: l, lugar, material, pagina: caminho(pagina), utm: utm || undefined };
}

/** "https://kalidash.com.br/blog/agentes-de-ia?utm=…" → "/blog/agentes-de-ia" */
function caminho(url: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).pathname;
  } catch {
    return url.split('?')[0];
  }
}

const tituloDoSlug = (slug: string) =>
  slug.split('-').map((w, i) => (w === 'ia' ? 'IA' : i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ');

function csv(rows: Inscrito[]): string {
  const esc = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const linhas = rows.map((r) => [
    r.nome,
    r.email,
    r.primeira.slice(0, 10),
    [...new Set(r.inscricoes.map((i) => LUGAR[i.lugar]))].join(' / '),
    r.materiais.join(' / '),
  ].map(esc).join(','));
  return ['Nome,E-mail,Inscrito em,Onde se inscreveu,Material pedido', ...linhas].join('\n');
}

type Aba = 'todos' | 'material' | 'emails';

export default function Newsletter() {
  const crmMode = useCrmMode();
  const [leads] = useStore(leadsStore);
  const [aba, setAba] = useState<Aba>('todos');
  const [busca, setBusca] = useState('');
  const [lugar, setLugar] = useState<'' | Lugar>('');
  const [openLead, setOpenLead] = useState<string | null>(null);
  const [openParty, setOpenParty] = useState<PartyRef>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /* Um inscrito por e-mail; a mesma pessoa pode ter se inscrito em mais de um lugar. */
  const inscritos = useMemo(() => {
    const porEmail = new Map<string, Inscrito>();
    for (const l of leads) {
      if (l.archivedAt || !isNewsletterLead(l)) continue;
      const i = lerInscricao(l);
      const chave = l.email.trim().toLowerCase();
      const atual = porEmail.get(chave);
      if (!atual) {
        porEmail.set(chave, { email: l.email, nome: l.name, primeira: l.createdAt, ultima: l.createdAt, inscricoes: [i], materiais: i.material ? [i.material] : [], lead: l });
        continue;
      }
      atual.inscricoes.push(i);
      if (i.material && !atual.materiais.includes(i.material)) atual.materiais.push(i.material);
      if (l.createdAt < atual.primeira) atual.primeira = l.createdAt;
      if (l.createdAt > atual.ultima) {
        atual.ultima = l.createdAt;
        atual.lead = l;
        atual.nome = l.name;
      }
    }
    return [...porEmail.values()].sort((a, b) => b.ultima.localeCompare(a.ultima));
  }, [leads]);

  /* início da janela de 30 dias: fixado ao abrir a página (não muda a cada render) */
  const [desde] = useState(() => Date.now() - 30 * 24 * 60 * 60 * 1000);
  const stats = useMemo(() => {
    const por = (...k: Lugar[]) => inscritos.filter((r) => r.inscricoes.some((i) => k.includes(i.lugar))).length;
    return {
      total: inscritos.length,
      mes: inscritos.filter((r) => new Date(r.primeira).getTime() >= desde).length,
      topo: por('topo'),
      fim: por('artigo', 'blog', 'outro'),
      material: inscritos.filter((r) => r.materiais.length || r.inscricoes.some((i) => i.lugar === 'material')).length,
    };
  }, [inscritos, desde]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return inscritos.filter((r) => {
      if (aba === 'material' && !r.inscricoes.some((i) => i.lugar === 'material')) return false;
      if (lugar && !r.inscricoes.some((i) => i.lugar === lugar)) return false;
      if (!q) return true;
      return [r.nome, r.email, ...r.materiais, ...r.inscricoes.map((i) => i.pagina ?? '')].some((v) => v.toLowerCase().includes(q));
    });
  }, [inscritos, aba, lugar, busca]);

  const paged = usePaged(filtrados, 20);

  const exportar = () => {
    const blob = new Blob(['﻿' + csv(filtrados)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `newsletter-kalidash-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Page>
      <PageHeader
        title="Newsletter"
        subtitle="Quem se inscreveu pelo blog para receber os conteúdos por e-mail. Cada inscrição é um lead (tag Newsletter) e um contato no Resend; aqui a mesma pessoa aparece uma vez só, com todos os lugares onde se inscreveu."
        actions={
          <button type="button" className="btn btn-solid" onClick={exportar} disabled={!filtrados.length}>
            <Download size={14} /> Exportar CSV
          </button>
        }
      />
      {crmMode !== 'api' && <SampleBanner offline>Os inscritos vêm dos leads do CRM, que não está ligado aqui: a lista abaixo fica vazia ou com dados de exemplo.</SampleBanner>}
      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button type="button" className="icon-btn bare" onClick={() => setNotice(null)} aria-label="Dispensar">×</button>
        </div>
      )}

      <div className="stat-grid">
        <StatCard label="Inscritos" value={stats.total} hint="E-mails únicos" />
        <StatCard label="Últimos 30 dias" value={stats.mes} hint="Primeira inscrição no período" />
        <StatCard label="Topo do artigo" value={stats.topo} hint={`${stats.fim} pelo fim do artigo ou pelo blog`} />
        <StatCard label="Pediram material" value={stats.material} hint="A equipe envia o material por e-mail" tone={stats.material ? 'warning' : undefined} />
      </div>

      <div className="info-row">
        <InfoPop icon={Send} label="Enviar edições" title="Edições no Resend">
          As edições são montadas e enviadas no Resend (Broadcasts), no segmento "Newsletter do blog".
        </InfoPop>
        <InfoPop icon={UserPlus} label="Novas inscrições" title="Inscrição e descadastro">
          Cada inscrição feita no site entra no Resend sozinha, e o descadastro é do próprio Resend.
        </InfoPop>
        <InfoPop icon={Upload} label="Inscritos antigos" title="Quem se inscreveu antes da ligação">
          Entra pelo CSV: Resend &gt; Contacts &gt; Import.
        </InfoPop>
        <InfoPop icon={LayoutTemplate} label="Os e-mails" title="Os 3 e-mails da newsletter">
          Newsletter mensal, boas-vindas e material gratuito: veja como chegam na aba{' '}
          <a href="#/newsletter" onClick={(e) => { e.preventDefault(); setAba('emails'); }}>E-mails</a>.
        </InfoPop>
      </div>

      <Tabs
        tabs={[
          { id: 'todos' as const, label: 'Todos', count: inscritos.length },
          { id: 'material' as const, label: 'Pediram material', count: stats.material },
          { id: 'emails' as const, label: 'E-mails', count: 3 },
        ]}
        value={aba}
        onChange={(id) => { setAba(id); paged.setPage(1); }}
      />

      {aba === 'emails' ? <NewsletterEmails /> : (
        <>
      <div className="toolbar">
        <SearchBox value={busca} onChange={setBusca} placeholder="Buscar por nome, e-mail, material ou página…" />
        <CustomSelect className="select select-sm" value={lugar} onChange={(e) => setLugar(e.target.value as '' | Lugar)} aria-label="Filtrar por onde se inscreveu">
          <option value="">Todos os lugares</option>
          {(['topo', 'artigo', 'blog', 'material'] as Lugar[]).map((k) => <option key={k} value={k}>{LUGAR[k]}</option>)}
        </CustomSelect>
      </div>

      <div className="table-card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Inscrito</th><th>Onde se inscreveu</th><th>Página</th><th>Material pedido</th><th>No CRM</th><th>Inscrito em</th></tr>
            </thead>
            <tbody>
              {paged.rows.map((r) => {
                const lugares = [...new Set(r.inscricoes.map((i) => i.lugar))];
                const paginas = [...new Set(r.inscricoes.map((i) => i.pagina).filter(Boolean))] as string[];
                return (
                  <tr key={r.email} className="clickable" onClick={() => setOpenLead(r.lead.id)}>
                    <td>
                      <div className="cell-stack">
                        <span className="cell-primary">{r.nome}</span>
                        <span className="text-xs text-muted">{r.email}</span>
                      </div>
                    </td>
                    <td>
                      <div className="tag-row">
                        {lugares.map((k) => <LabelBadge key={k} tone={k === 'material' ? 'warning' : 'info'}>{LUGAR[k]}</LabelBadge>)}
                        {r.inscricoes.length > 1 && <span className="text-xs text-muted">{r.inscricoes.length}×</span>}
                      </div>
                    </td>
                    <td className="text-muted text-xs">{paginas.length ? paginas.join(', ') : '—'}</td>
                    <td>{r.materiais.length ? r.materiais.map(tituloDoSlug).join(', ') : <span className="text-muted">—</span>}</td>
                    <td>
                      <LeadStatusBadge status={r.lead.status} />
                    </td>
                    <td className="text-muted">{formatDate(r.primeira)}</td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState title={inscritos.length ? 'Ninguém com esses filtros' : 'Nenhum inscrito ainda'}>
                      {inscritos.length
                        ? 'Ajuste a busca ou o lugar.'
                        : 'As inscrições feitas no blog (topo e fim dos artigos, página do blog e materiais gratuitos) aparecem aqui.'}
                    </EmptyState>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={paged.page} pageSize={paged.pageSize} total={paged.total} onPage={paged.setPage} onPageSize={paged.setPageSize} />
      </div>
        </>
      )}

      {openLead && <LeadSheet key={openLead} leadId={openLead} onClose={() => setOpenLead(null)} onOpenParty={(ref) => { setOpenLead(null); setOpenParty(ref); }} onNotice={setNotice} />}
      <PartySheets open={openParty} onOpen={setOpenParty} />
    </Page>
  );
}
