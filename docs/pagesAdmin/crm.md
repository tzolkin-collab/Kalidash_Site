# 👥 CRM (Oportunidades, Leads e Clientes)

> **v2 (26/09/2026).** Segue a [definição de domínio](../dominio.md): o lead é um registro próprio, cada pipeline é o funil de uma oferta, e o cliente é um estado de Pessoa ou de Empresa. Schema em [plano-schema.md](../plano-schema.md).

---

## 1. Oportunidades: pipelines e visões

**Cabeçalho da página:** seletor de pipeline (com a **engrenagem** ao lado, dica "Configurações das pipelines"), **Filtro**, botão **Ver leads**, alternador Kanban/Lista e "Nova oportunidade" (formulário de verdade, não um card fixo).

### A. Visão Kanban (arrastar e soltar)
- **Colunas:** as etapas **Abertas**, **Ganha** e **Perdida** da pipeline escolhida. São configuráveis por pipeline (nome, ordem, cor, probabilidade, dias para alerta).
- **Ver leads:** ligado, abre à esquerda as **colunas de leads** (etapas do tipo Lead, padrão "Novos" e "Em contato"), com as tags dos leads. Os leads ficam **fora** dos totais de valor e têm aparência própria (selo "Lead", borda tracejada).
- **Contagem e paginação:** cada coluna mostra quantidade e valor. Cada coluna carrega 20 cards por vez ("carregar mais").
- **Cartão:** título, **cliente** (Empresa com ícone de prédio e o contato padrão abaixo; Pessoa com ícone de pessoa), tags, valor, dono e a **próxima tarefa**.
- **Regras:**
  - Arrastar um **lead** para uma etapa aberta o **qualifica** (cria a oportunidade). O botão "Qualificar" faz o mesmo.
  - Arrastar para **Perdida** exige o **motivo** (lista configurável).
  - Arrastar para **Ganha** pede o **valor final** e marca o cliente (Empresa, ou Pessoa se não houver empresa).
  - Um requisito de etapa pode **impedir entrar** (ou sair) de uma etapa até uma tarefa ser cumprida. Ex.: empresa sem CNPJ **não entra em Assinatura do contrato**.

### B. Visão Lista
- **Colunas:** Oportunidade, Cliente (com o tipo Empresa ou Pessoa), Etapa, Tags, Valor, Dono, Próxima tarefa.
- **Ver leads:** ligado, os leads entram na lista **diferenciados** dos ativos (selo "Lead", linha mais clara e marca lateral tracejada).
- **Contagem e paginação:** "1–20 de N", tamanho da página ajustável, ordenação por coluna.
- Filtros avançados (ex.: "criadas nos últimos 7 dias, em Negociação"), exportação para CSV e ações em massa (transferir de vendedor).

---

## 2. Ficha da oportunidade (o popup)

Ao clicar em um card ou linha, abre a ficha, **sem sair da página**. (Se a ficha é painel lateral ou modal, e a divisão final das abas, seguem em revisão.)

1. **Cabeçalho fixo:** título, **etapa** (dropdown para mudar rápido), valor, prioridade, cliente (Empresa ou Pessoa) e "Agendar call".
2. **Stakeholders:** o **contato padrão** e os **outros contatos**, cada um com **descrição** e **tags** de função (criadas pelo time). Mais de uma pessoa por oportunidade.
3. **Linha do tempo (cronologia):** um feed único do que aconteceu, em ordem reversa: envio do formulário (com origem e UTM), notas, ligações, e-mails, reuniões, mudanças de etapa e de valor, **tarefas** (feitas e a fazer).
4. **Tarefas da oportunidade:** as pendências (dado faltante e as manuais), com tag, prazo e responsável. Concluir uma de dado faltante abre o formulário da entidade.
5. **Dados:** telefone, e-mail, documento e os campos personalizados.
6. **Rodapé:** "Marcar como ganho" e "Marcar como perdido" (com motivo).

---

## 3. Notificações e automações SLA

> O aviso de etapa bloqueada (card treme, borda vermelha, toast) é o primeiro caso real da categoria "Aviso" — ver [notificacoes.md](../notificacoes.md).

Vendas morrem se o lead esfriar.

### SLA
Gestores configuram regras de tempo de resposta (ex.: "leads novos contatados em até 2 horas"). Quebrado o SLA, o card ganha borda vermelha e um marcador de urgência.

### Notificações em tempo real
1. O lead chega pelo formulário.
2. A API salva no MySQL e dispara um evento **WebSocket** ao painel aberto.
3. O card do novo lead aparece na **coluna de leads** com um destaque verde (se "Ver leads" estiver ligado), e o selo de notificação da aba muda (ex.: `(1) Kalidash`). A página **Leads** também recebe o item.
4. Com o painel fechado, o Service Worker recebe um Web Push do Go e mostra uma notificação nativa ("Novo lead: João da Silva (Google Ads)"). Ao clicar, abre a ficha do lead.

---

## 4. Atribuição de leads

- **Manual (padrão):** o lead cai numa **piscina geral** (sem dono). Qualquer vendedor pode pegar para si.
- **Round-robin (opcional):** ligado pelo gerente, a API distribui em rodízio, por pipeline.
- **Outbound:** o lead nasce com o **contato interno** que o trouxe.
- O Vendedor só vê os leads e oportunidades em que `ownerId` é ele. Admin e Gerente veem tudo. Perfis em [system-core.md](../system-core.md).

---

## 5. Páginas de apoio

- **Leads:** leads de todas as pipelines, com filtro por pipeline, fonte, origem e tags. Qualificar, Descartar (com motivo) e **Adicionar lead** (pede o contato interno que trouxe).
- **Pessoas & Empresas:** cadastro completo, com contagem e paginação, documento (CPF/CNPJ alfanumérico), empresa **em análise** quando falta o CNPJ.
- **Clientes:** página própria, com abas **Todos**, **Empresas** e **Pessoas**. Cliente é o estado de quem ganhou uma oportunidade.
- **Tarefas:** a galeria de funis em cards; cada um abre a página do workflow, do começo ao fim (ver [dominio.md](../dominio.md#11-página-tarefas-galeria-de-funis-e-workflow)).
