# Handoff — conexões e dados para analytics

**Data:** 27/09/2026  
**Status:** proposta arquitetural para continuidade; galeria visual de gráficos transferida para o dashboard em 27/09/2026. Conectores e integração dos modelos com fontes reais seguem pendentes.

## Objetivo da discussão

Desenhar como os gráficos do dashboard e outras funções da Kalidash poderão usar CRM, conteúdo e serviços conectados sem criar uma operação paralela para importar e manter grandes volumes de métricas.

## Acordos registrados

1. Existem dois contextos de autorização para integrações:
   - **Conexões pessoais:** cada participante autoriza serviços usados em seu nome, por exemplo Gmail, Drive e Calendar.
   - **Conexões da plataforma:** integrações compartilhadas, administradas no Kalidash, que fornecem dados para analytics e outras funções da plataforma.
2. Uma conexão compartilhada pode usar OAuth. A distinção é quem é o proprietário da autorização, quem pode administrá-la e em quais funções ela pode ser usada.
3. A intenção é consultar dados na origem quando necessário, sem manter cópias permanentes de métricas só para alimentar os gráficos. Cache curto pode ser avaliado para latência e limites de API.
4. As credenciais de integrações compartilhadas não devem ser entregues ao navegador. A tela pode conectar, substituir, testar e revogar; não deve devolver o segredo salvo.
5. O foco do primeiro ciclo é estudar a arquitetura e aprovar visualmente/configurar gráficos; não adicionar conectores em série sem pesquisa por provedor e validação de escopo.

## Proposta técnica a validar

```text
Admin / participante
        │
        ├── OAuth pessoal ──> autorização individual ──> Gmail / Drive / Calendar
        │
        └── Configurações > Conexões da plataforma
                 │ autorização/credencial central
                 ▼
        API autenticada + RBAC + trilha de auditoria
                 │
        Repositório de conexões + credenciais cifradas
                 │
        Adaptador da fonte (CRM, depois provedor escolhido)
                 │ consulta na origem; cache curto se justificado
                 ▼
        Contrato normalizado de dados ──> configuração do gráfico ──> Recharts
```

### Limites recomendados

- Guardar configuração e estado da conexão: provedor, conta/propriedade, escopos concedidos, status, expiração quando aplicável, responsável pela conexão e última verificação. Guardar token de acesso/renovação cifrado apenas quando o fluxo do provedor exigir.
- Cifrar cada segredo com AEAD (por exemplo, AES-GCM), nonce aleatório, versão da chave e contexto associado à conexão. A API não deve incluir o segredo em respostas, erros ou logs.
- Preferir serviço de gestão de chaves/segredos em produção. A chave fora do banco é necessária, mas variável de ambiente não é automaticamente um cofre; pode ser uma solução transitória se o ambiente não oferecer KMS/Vault. Documentar rotação, recuperação e impacto de perda da chave. A OWASP recomenda gestão de ciclo de vida e acesso mínimo para segredos e chaves: [Cryptographic Storage](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html), [Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html).
- Criar adaptadores por fonte com operações e campos permitidos. A configuração do chart salva a fonte, métrica, dimensões, filtros, intervalo e tipo visual; nunca credenciais nem snapshots de métricas.
- Buscar primeiro no CRM, que já alimenta o dashboard com dados reais. Escolher o primeiro provedor externo somente após benchmark de métricas, permissões, quotas, expiração/renovação, revisão do app e custos operacionais.
- Não introduzir data warehouse, fila, Redis ou sincronização periódica sem evidência de que consultas/cache curto não atendem aos requisitos.

## Distinções que a documentação precisa preservar

O material atual contém **três mecanismos diferentes**, que não devem virar uma única tela/credencial genérica:

1. OAuth pessoal de Gmail, Drive e Calendar, associado ao participante e a ações em seu nome.
2. Conexões compartilhadas da plataforma, para fontes consultadas pela Kalidash.
3. Chaves dos **Projetos conectados**: credenciais por projeto e escopo para o Connect/snippet, incluindo a chave pública de escrita `analytics:write` e escopos de servidor como `ads:read`/`leads:read`.

As chaves públicas do snippet não servem para leitura de provedores nem podem ser usadas como segredos de integração. A página existente de Projetos continua sendo o lugar conceitual para projetos, Connect e suas chaves; a nova área de Configurações trataria conexões pessoais e/ou conexões compartilhadas da plataforma conforme o desenho de permissões.

## Revisão dos documentos e estado observado

| Documento/código | O que estabelece | Ponto de atenção para a próxima revisão |
|---|---|---|
| [ARCHITECTURE.md](../ARCHITECTURE.md) | Dashboard parcial; API Go/MySQL; papéis; `analytics:write`; lista a chave de criptografia em variável de ambiente. | Login está planejado e a API é descrita como aberta. O modelo não prevê ainda uma entidade para conexão compartilhada de provedor. A recomendação mais recente sobre KMS/Vault precisa ser conciliada com a regra atual de chave em ambiente. |
| [dashboard.md](../pagesAdmin/dashboard.md) | KPIs de CRM e gráficos desejados; dashboard atual deriva valores das oportunidades. | Distinguir métricas derivadas de CRM de métricas consultadas em serviços externos; escolher fonte e granularidade antes do contrato de cada chart. |
| [projects.md](../pagesAdmin/projects.md) | Projetos conectados, snippet, chaves e escopos; também menciona Google Meet/Gmail/Drive na área de integrações. | Separar integrações de participante e fontes compartilhadas; não misturar credenciais OAuth com API keys de projeto. |
| [integrations-workspace.md](../integrations-workspace.md) e [crm-integrations.md](../crm-integrations.md) | Calendar/Gmail operados com token do vendedor; Drive usado em fluxo de conteúdo. | São planos, não confirmação de que OAuth individual já esteja implementado. Rever o uso de escopos pedidos “na hora do login”: autenticação e autorização de recursos devem ter finalidades e consentimentos claros. |
| [auth-study.md](../auth-study.md) e [system-core.md](../system-core.md) | Google OAuth para login, papéis e autorização por rota. | A matriz atual prevê Admin, Gerente e Vendedor; não há papel Developer. Definir permissões explícitas para gerenciar conexões e segredos, em vez de presumir esse papel. |
| [pagesAdmin/settings.md](../pagesAdmin/settings.md), [Settings.tsx](../../apps/admin/src/pages/Settings.tsx) e [nav.ts](../../apps/admin/src/nav.ts) | Configurações focam equipe, perfis, webhooks e auditoria; navegação atual não mostra área de conexões globais. | Interface e persistência estão descritas como mock/sem API. Inserir conexão compartilhada exige desenho de UX, API e autorização, não apenas novo item de menu. |
| [benchmark-dados.md](../benchmark-dados.md) | Define métricas do CRM como derivadas, não gravadas. | É uma decisão para dados CRM; não resolve ainda armazenamento de eventos próprios do Connect nem política de cache para APIs externas. |
| [schema.prisma](../../apps/studio/prisma/schema.prisma) e [main.go](../../apps/api/main.go) | Schema contém CRM básico; rotas Go atuais incluem oportunidades e notas. | Não há modelo de integração externa observado. A API não tem autenticação/middleware na rota de oportunidades, CORS está com `*` e a consulta retorna registros sem escopo de usuário. Isso impede expor gestão de credenciais agora. |

## Bloqueios e riscos antes de implementação

1. **Autenticação e autorização do servidor:** implementar login/sessão e RBAC em todas as rotas; escopar dados CRM por permissão. A UI esconder um botão não protege endpoint.
2. **Segredos:** definir onde a chave é armazenada em cada ambiente, como rotacionar versões e como recuperar credenciais após restauração do banco. Não registrar tokens em logs nem retorná-los após gravação.
3. **Permissão de gestão:** decidir se somente Admin pode conectar fontes compartilhadas e como atribuir capacidade a desenvolvedores. O papel Developer não existe na matriz atual.
4. **Semântica das fontes:** diferenciar consulta de relatórios externos de eventos próprios enviados pelo Connect. `analytics:write` descreve ingestão de eventos do site; isso pode precisar persistir esses eventos, o que é diferente de não copiar relatórios do GA4/Ads. A documentação atual não fecha esse destino/schema.
5. **Benchmark por provedor:** pesquisar disponibilidade de métricas/dimensões, quotas, consentimento/OAuth, tokens de renovação, processos de revisão, limites e política de cache para cada fonte pretendida. Não generalizar o resultado de GA4 para Ads, Meta, TikTok ou outras APIs.
6. **Correlação CRM ↔ mídia:** atribuição de receita exige IDs compartilhados (por exemplo UTMs/campaign IDs) e regras de janela/fuso. Não prometer atribuição cruzada até auditar os campos realmente capturados e o benchmark de cada provedor.

## Sequência recomendada

1. Fechar o benchmark e a decisão de escopo: métricas que os charts precisam, fontes candidatas e se haverá ingestão de eventos próprios do Connect.
2. Priorizar autenticação, autorização por rota, escopo de dados e auditoria; corrigir CORS para os domínios necessários.
3. Desenhar o modelo de conexão compartilhada e o ciclo de vida de segredos, incluindo serviço de chaves ou estratégia transitória explícita.
4. Desenhar a UX em Configurações e o contrato de leitura dos charts.
5. Implementar um caminho vertical pequeno: CRM primeiro; um único provedor externo depois da pesquisa; consulta, teste de conexão, expiração/erro, desconexão e cache curto mensurável.
6. Rever este handoff e os documentos de arquitetura antes de ampliar a lista de conectores.

## Próximas decisões em aberto

- A primeira fonte externa será GA4, Ads, outra, ou o dashboard começará apenas com CRM até a segurança estar pronta?
- Eventos próprios de projetos conectados serão guardados pela Kalidash? Se sim, com qual retenção, agregação e exclusão?
- Quem pode administrar conexões compartilhadas: Admin apenas, ou permissões concedidas também a um Developer designado?
- A infraestrutura de produção terá KMS/Vault/secret manager disponível? Se não, qual mecanismo transitório e processo de rotação será aceito?
- Resultados externos precisam ser em tempo real, ou qual TTL/cache é aceitável para cada fonte?

## Registro de alterações — 27/09/2026

**Pedido:** mover os gráficos do estudo para `/dashboard`.

- **Adicionado:** galeria ao final do dashboard, depois dos KPIs e dos blocos CRM existentes. Inclui 13 variações de séries temporais e 14 famílias adicionais de gráficos.
- **Carregamento:** galeria separada em um módulo carregado sob demanda; a primeira parte do dashboard mantém seu próprio carregamento.
- **Movido:** implementação visual e estilos de `apps/admin/src/ideias/teste/dashboard/` para `apps/admin/src/components/dashboard/AnalyticsChartGallery.tsx` e `analytics-chart-gallery.css`.
- **Alterado:** cabeçalho da galeria identifica os dados como demonstrativos e informa que não vêm do CRM; os KPIs, funil e maiores oportunidades reais da página foram preservados.
- **Removido:** rota de estudo independente que carregava a galeria separada.
- **Redirecionado:** endereços antigos `#/dom/teste/dashboard` e `#/ideias/teste/dashboard` agora navegam para `#/dashboard`.
- **Dados:** os exemplos da galeria continuam sendo dados sintéticos para comparação visual; nenhum endpoint, conector ou cache foi criado nesta alteração.

## Fora do escopo desta alteração

Esta alteração não cria tabelas, endpoints, conectores, cache ou alterações nas decisões de segurança. Também não aprova provedores, scopes OAuth, retenção de eventos ou papel Developer. Esses pontos dependem das decisões e pesquisas acima.
