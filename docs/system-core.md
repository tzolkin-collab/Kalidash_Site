# ⚙️ Core Systems: Perfis, Logs e Notificações

> Definição dos perfis internos, da trilha de auditoria e do motor de engajamento do Kalidash.

---

## 1. Perfis Internos (RBAC)

O painel Vite (PWA) é o mesmo código e a mesma URL para toda a equipe (`admin.kalidash.com`). Há **um único espaço de dados** e o que muda, depois do login, é o que cada perfil enxerga e pode fazer.

O perfil vem no JWT (`role`) e **a API confere a permissão em toda rota**. Esconder o menu no front não basta: quem forçar a URL recebe `403`.

| Perfil | O que vê | O que pode fazer |
|---|---|---|
| **Admin** | Todo o funil, o dashboard e todas as configurações | Gerenciar equipe, integrações, chaves, webhooks e blog. Redistribuir leads. Não pode remover o último Admin. |
| **Gerente** | Todo o funil e o dashboard | Operar o CRM, o blog e os projetos conectados, redistribuir leads e ligar o round-robin. Não acessa equipe nem webhooks. |
| **Vendedor** | Apenas as oportunidades **atribuídas a ele** | Operar as próprias oportunidades e pegar leads sem dono ("claim"). Não acessa Configurações; essas telas nem aparecem no menu e a API responde `403`. |

A matriz completa de permissões, o fluxo de convite e o desligamento de pessoas estão em [auth-study.md](./auth-study.md).

---

## 2. Sistema de Logs (Trilha de Auditoria)

A regra de ouro de um CRM: **nenhum dado desaparece sem deixar rastros.**

### O que registramos
Sempre que uma operação sensível (POST, PUT, DELETE) acontece no banco, um registro é salvo na tabela `AuditLog`:
- Exclusão de leads.
- Exportação de dados para CSV (risco de vazamento).
- Alteração de permissões da equipe.
- Geração ou revogação de chaves de API.

### Schema do log (MySQL)
```sql
CREATE TABLE audit_logs (
    id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    actor_id      VARCHAR(36) NOT NULL,           -- Quem fez (user.id, UUID)
    action        VARCHAR(100) NOT NULL,          -- "lead.deleted", "apikey.created"
    resource_type VARCHAR(50) NOT NULL,           -- "opportunity", "user"
    resource_id   VARCHAR(36) NOT NULL,           -- O ID do item alterado (UUID)
    old_data      JSON,                           -- Como era antes
    new_data      JSON,                           -- Como ficou (ou null se deletado)
    ip_address    VARCHAR(45),
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
```
Em Configurações > Segurança, o Admin vê a tabela de logs: *"Ontem às 14h, o vendedor João deletou o lead Maria. IP: 177.X.X.X"*.

---

## 3. Sistema de Notificações (Motor de Engajamento)

> A classificação por tipo (erros, avisos, notificações), o sino na barra lateral e a aba Configurações → Notificações estão em [notificacoes.md](./notificacoes.md). Aqui ficam as camadas de transporte.

Para garantir que leads não esfriem, o Kalidash tem um sistema de notificação em 3 camadas, focado em **tempo real**.

### Camada 1: In-App (painel aberto)
- **Tecnologia:** WebSockets (mantido pelo servidor Go).
- **Fluxo:** o lead preenche o formulário → o Go salva no banco → o Go empurra o evento pelo WebSocket → o painel faz um "plim" e um card verde aparece. O Kanban adiciona o card sem precisar de F5.

### Camada 2: Background (painel fechado ou celular)
- **Tecnologia:** Service Workers + Web Push API (nativo, sem app store).
- **Fluxo:** o vendedor está no Excel com o painel fechado. O Service Worker recebe o push do Go e aciona a notificação nativa do sistema. Ao clicar, o painel abre direto na ficha do lead.

### Camada 3: Outbound (para sistemas externos)
- **Tecnologia:** webhooks.
- **Fluxo:** o Admin pode configurar: *"Sempre que um lead for ganho (WON), envie um POST para esta URL do Zapier"*. Uma Goroutine em background dispara o webhook e tenta de novo 3 vezes em caso de falha (retry com backoff exponencial).
