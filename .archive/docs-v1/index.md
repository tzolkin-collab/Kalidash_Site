# 📚 Documentação Kalidash

Bem-vindo à documentação da estrutura de páginas do ecossistema Kalidash.
Este documento serve como índice central para organizarmos e planejarmos as lógicas de todas as telas antes de começarmos a codar.

A arquitetura do projeto é dividida em dois frontends + backend + banco centralizado.

**Custo mensal total de infraestrutura: $5/mês (~R$29) — Vultr São Paulo**

---

## 📐 Arquitetura e Decisões

* [Decisões Arquitetônicas (Vite vs Next, Go vs Node, MySQL sem Redis)](./architecture-decisions.md)
* [Segurança do Banco de Dados & CMS Proprietário](./security-and-cms.md)
* [Estudo de Autenticação (Google OAuth + Workspace)](./auth-study.md)
* [Comparativo de VPS (Hetzner vs Vultr vs DO vs Contabo)](./vps-comparison.md)

---

## 1. 🌐 FE Cliente (`apps/site`) — Vercel (Free)
Interface pública, construída em Next.js para máximo desempenho de SEO e indexação.

* [Página Inicial (Home)](./pagesClient/home.md)
* [Blog Institucional (CMS Proprietário)](./pagesClient/blog.md)

---

## 2. ⚙️ FE Admin (`apps/admin`) — Vercel (Free)
Painel de controle interno e CRM, construído em Vite (PWA) para agilidade e interatividade.

* [Dashboard & Analytics](./pagesAdmin/dashboard.md)
* [Gestão de Projetos & API Keys](./pagesAdmin/projects.md)
* [CRM (Leads e Pipelines)](./pagesAdmin/crm.md)
* [Configurações (Webhooks, Auditoria, Auth)](./pagesAdmin/settings.md)

---

## 🔌 Integrações e Sistemas Core

* [Inbound (Chegada de Leads e Formulários)](./inbound-leads.md)
* [Ecossistema Google (Meet, Gmail, Drive vs R2)](./integrations-workspace.md)
* [Core Systems (Multi-Tenant, Logs, Notificações)](./system-core.md)

---

## 3. 🔵 BE Master (`apps/api`) — Vultr SP ($5/mês)
API centralizada em Go HTTP Server + MySQL na mesma VPS.

---

> **Hospedagem Recomendada:**
> | Camada | Serviço | Custo |
> |---|---|---|
> | FE Cliente (Next.js) | Vercel | $0 |
> | FE Admin (Vite PWA) | Vercel | $0 |
> | Backend Go + MySQL | Vultr São Paulo | $5/mês |
> | **Total** | | **$5/mês** |
