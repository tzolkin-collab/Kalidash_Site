# ⚙️ Core Systems: Painéis, Logs e Notificações

> Definição da lógica de isolamento visual (Multi-Tenant), trilha de auditoria e motor de engajamento do Kalidash.

---

## 1. Divisão de Painéis (Multi-Tenant Visual)

Como usamos um modelo de Banco Único (Shared Schema), o painel Vite (PWA) é o mesmo código e mesma URL para todo mundo (`admin.kalidash.com`). O que muda é o que a tela renderiza após o login.

### O Painel Master (Agência / Owner Geral)
Visão "God Mode" de quem opera o software.
- **Seletor Global:** Um dropdown no topo permite alternar entre "Tenant A", "Tenant B" ou "Visão Consolidada".
- **Gestão de Clientes:** Criar novos Tenants (Contas/Projetos), definir limites do plano e suspender acessos.
- **Financeiro:** Vê a receita consolidada de todos os clientes que pagam pelo uso da plataforma.

### O Painel Tenant (Cliente Final / Empresa)
Visão isolada. O cliente não sabe que outros clientes existem no mesmo servidor.
- **Filtro Automático:** O JWT de acesso dele contém `account_id=5`. O frontend *só* requisita dados da API passando esse escopo, e o backend *só* retorna queries com `WHERE account_id = 5`.
- **Customização (White-label leve):** O painel pode carregar a logo do Tenant e esconder menus que não fazem parte do plano dele (ex: esconder a aba de "Webhooks" se for plano Básico).

### Role-Based Access Control (Permissões Internas do Tenant)
Dentro de um mesmo Tenant, as permissões de acesso ao funil de vendas funcionam no modelo:
1. **Administrador/Gerente:** Visão Global. Vê absolutamente todos os cards do Pipeline, pode editar configurações do Workspace (Faturamento, Integrações, Equipe) e realocar leads entre vendedores.
2. **Vendedor:** Visão Restrita. Acessa o Pipeline, mas o painel filtra os cards para mostrar **apenas os Leads que estão atribuídos a ele**. Não tem acesso à tela de Configurações, Faturamento, ou gestão de equipe (estas opções sequer aparecem no menu ou retornam Erro 403 na API caso ele tente forçar o acesso via URL).

---

## 2. Sistema de Logs (Trilha de Auditoria)

A regra de ouro de um CRM: **Nenhum dado desaparece sem deixar rastros.**

### O que registramos
Sempre que uma operação sensível (Mutação: POST, PUT, DELETE) acontece no banco, um registro é salvo na tabela `audit_logs`.
- Exclusão de Leads.
- Exportação de dados para CSV (risco de vazamento).
- Alteração de permissões da equipe.
- Geração ou revogação de API Keys.

### Schema do Log (MySQL)
```sql
CREATE TABLE audit_logs (
    id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    account_id    BIGINT UNSIGNED NOT NULL,
    actor_id      BIGINT UNSIGNED NOT NULL,       -- Quem fez (team_member.id)
    action        VARCHAR(100) NOT NULL,          -- "lead.deleted", "apikey.created"
    resource_type VARCHAR(50) NOT NULL,           -- "lead", "team_member"
    resource_id   BIGINT UNSIGNED NOT NULL,       -- O ID do item alterado
    old_data      JSON,                           -- Como era antes
    new_data      JSON,                           -- Como ficou (ou null se deletado)
    ip_address    VARCHAR(45),
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
```
No Painel Tenant (aba Configurações > Segurança), o administrador pode ver a tabela de logs: *"Ontem às 14h, Vendedor João deletou o lead Maria. Endereço IP: 177.X.X.X"*.

---

## 3. Sistema de Notificações (Motor de Engajamento)

Para garantir que leads não esfriem, o Kalidash possui um sistema de notificação em 3 camadas, focado em **tempo real**.

### Camada 1: In-App (Painel Aberto)
- **Tecnologia:** WebSockets (mantido pelo servidor Go).
- **Fluxo:** O Lead preenche o form -> Go salva no banco -> Go empurra o evento pelo WebSocket -> Painel Vite faz um "Plim!" e um card verde salta na tela. A tabela do Kanban adiciona o card instantaneamente sem precisar dar refresh (`F5`) na página.

### Camada 2: Background (Painel Fechado / Celular)
- **Tecnologia:** Service Workers + Web Push API (Nativo, sem app store).
- **Fluxo:** O vendedor está no Excel com o painel Kalidash fechado. O Service Worker no Chrome recebe o push silencioso do Go e aciona a notificação nativa do Windows/macOS. Ao clicar, o painel abre direto na ficha do Lead.

### Camada 3: Outbound (Para Sistemas Externos)
- **Tecnologia:** Webhooks.
- **Fluxo:** O Tenant pode configurar: *"Sempre que um lead for ganho (WON), envie um POST para esta URL do Zapier"*. O Go possui um worker de background (Goroutine) que dispara os Webhooks e tenta novamente 3 vezes em caso de falha (Retry com Exponential Backoff).
