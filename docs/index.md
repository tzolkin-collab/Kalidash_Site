# 📚 Documentação Kalidash

Bem-vindo à documentação do ecossistema Kalidash. Este documento é o índice central para organizar e planejar a lógica de cada tela antes de codar.

> **Versão anterior desta documentação:** `../.archive/docs-v1/` (descrevia uma plataforma multi-tenant, que nunca foi o escopo).

---

## 🎯 Escopo

O Kalidash é o **site institucional da Kalidash** mais um **`/admin` PWA de uso interno**, com:

- **CRM** (funil, oportunidades, empresas e contatos);
- **Blog** com CMS próprio;
- **Integrador de LPs e formulários** que a própria Kalidash lança (`connect.js`, API direta e webhooks de entrada, com projetos conectados e chaves de API).

**Não é** SaaS nem multi-tenant. Há um único espaço de dados e vários usuários internos, com três perfis: **Admin, Gerente e Vendedor**.

A arquitetura é dividida em site + admin + API em Go + banco MySQL em VPS. O status de cada módulo (feito, parcial, planejado) está em [ARCHITECTURE.md](./ARCHITECTURE.md#status-por-módulo-26092026).

**Fontes do escopo:** o `ADMIN-MOCK.md` do site v1.0 (`../.archive/v1.0_site/docs/`), a copy do site no Google Doc "Copy site - MVP" e os pedidos de 01/09/2026.

---

## 📐 Arquitetura e Decisões

* [Arquitetura e Transparência (v2.0)](./ARCHITECTURE.md)
* [Bench dos dois admins: features e filosofia](./benchmark.md)
* [Definição de domínio: leads, oportunidades, pessoas, empresas e clientes](./dominio.md) *(v2, confirmada)*
* [Plano de schema e de migração](./plano-schema.md) *(rascunho, não aplicado)*
* [API de funis, tarefas e gate de etapa](./api-workflow.md) *(pronta, desligada por padrão)*
* [Escopo: cadastro e edição de leads, pessoas, empresas, clientes e pipelines](./edicao-e-cadastro.md) *(decisões D1, D2, D8 tomadas; D4 em andamento)*
* [Bench de dados: o que os outros CRMs guardam](./benchmark-dados.md)
* [Bench: eventos padronizados, templates de ciclo de vida e tarefas por evento](./benchmark-ciclo-de-vida.md)
* [Notificações: erros, avisos e notificações personalizáveis](./notificacoes.md)
* [Gatilhos personalizados: webhooks de entrada e eventos por pipeline](./gatilhos-personalizados.md)
* [Decisões Arquitetônicas (Vite vs Next, Go vs Node, MySQL sem Redis)](./architecture-decisions.md)
* [Design do site × conteúdo do admin: contrato de atributos (blog e Home)](./blog-design-contrato.md)
* Handoffs: [27/09 conexões e analytics](./handoffs/2026-09-27-conexoes-e-analytics.md) · [30/09 editor do blog](./handoffs/2026-09-30-editor-blog-blocknote.md) · [01/10 preview, Home e contrato](./handoffs/2026-10-01-preview-home-contrato.md)
* [Segurança do Banco de Dados & CMS Proprietário](./security-and-cms.md)
* [Estudo de Autenticação (Google OAuth + Workspace)](./auth-study.md)
* [Comparativo de VPS (histórico)](./vps-comparison.md)

---

## 1. 🌐 Site (`apps/site`) — Vercel
Interface pública em Next.js, para SEO e indexação máximos. A Home (LP) e o blog já existem; o site v1.0 (Motion) está arquivado como referência. O design da Home está em [Home.pdf](./Home.pdf).

* [Página Inicial (Home)](./pagesClient/home.md)
* [Blog Institucional (CMS Proprietário)](./pagesClient/blog.md)

---

## 2. ⚙️ Admin (`apps/admin`) — Vercel
Painel interno e CRM, em Vite (PWA), para agilidade e interatividade.

* [Dashboard & Analytics](./pagesAdmin/dashboard.md)
* [CRM (Pipeline, Leads e Clientes)](./pagesAdmin/crm.md)
* [Projetos Conectados, Integrações e Chaves](./pagesAdmin/projects.md)
* [Configurações (Webhooks, Auditoria, Equipe)](./pagesAdmin/settings.md)

---

## 🔌 Integrações e Sistemas Core

* [Inbound (Chegada de Leads e Formulários)](./inbound-leads.md)
* [CRM: Integrações e Comunicação (Meet, e-mail, notificações)](./crm-integrations.md)
* [Ecossistema Google (Meet, Gmail, Drive vs R2)](./integrations-workspace.md)
* [Core Systems (Perfis, Logs, Notificações)](./system-core.md)

---

## 3. 🔵 API (`apps/api`) — VPS
API central em Go (`net/http`) com MySQL. O schema é definido em Prisma (`apps/studio`) e a API acessa o banco com SQL cru.

---

> **Hospedagem**
> | Camada | Serviço |
> |---|---|
> | Site (Next.js) | Vercel (plano Pro para uso comercial) |
> | Admin (Vite PWA) | Vercel ou Cloudflare Pages (estático) |
> | API Go | VPS Vultr ou DigitalOcean, à escolha da Kalidash |
> | MySQL | VPS (hoje no EasyPanel) |
> | CDN do `connect.js` | ~US$ 0 |
>
> Custos estimados e pontos de atenção (Vercel Hobby não é para uso comercial; EasyPanel exige 2GB de RAM): [ARCHITECTURE.md](./ARCHITECTURE.md#custo-estimado-preços-consultados-em-26092026).
