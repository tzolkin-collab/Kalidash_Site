# ✏️ Escopo: cadastro e edição de leads, pessoas, empresas, clientes e pipelines

> **Status:** rascunho com **decisões tomadas em 27/09/2026** (D1, D2, D8, D9 e a direção do D4, na seção 7). Nada disto está implementado além do protótipo descrito na seção 1. As regras de negócio vêm de [dominio.md](./dominio.md); o banco, de [plano-schema.md](./plano-schema.md).

**Objetivo:** definir, por entidade, como se **cadastra**, **edita**, **arquiva** e **age** sobre cada registro, antes de codar a versão definitiva. A seção 7 lista as decisões que precisam da Kalidash.

---

## 1. O que existe hoje (protótipo, dados de exemplo)

Levantado no código do admin em 27/09/2026. "Exemplo" significa que grava só em memória.

| Entidade | Cadastrar | Editar | Ações | Excluir |
|---|---|---|---|---|
| **Lead** | Painel "Adicionar lead": nome, e-mail, telefone, pipeline, origem e fonte, tags, mensagem. Valida origem e e-mail. | **Nada.** A ficha é só leitura. | Qualificar (só troca o status), Descartar, Restaurar. | Não há. |
| **Pessoa** | Painel "Nova pessoa": tipo Pessoa (CPF) ou Empresa (CNPJ, cria a empresa junto). | Painel com nome, e-mail, telefone, CPF, cargo, empresa, tags, ciclo de vida. | Nenhuma. | Não há. |
| **Empresa** | Painel "Nova empresa" (nome, CNPJ, segmento). | Painel com nome, CNPJ, segmento, ciclo de vida, stakeholders (descrição e tag) e contato padrão. | Nenhuma. | Não há. |
| **Cliente** | **Não existe**: a página só lista quem tem ciclo de vida Cliente. | Abre o painel de Pessoa ou Empresa. | Nenhuma. | Não há. |
| **Pipeline** | Página "Nova pipeline": nome, oferta, etapas do template. | Página de configurações: geral, etapas (nome, tipo, cor, probabilidade, alerta, ordem), fontes, tarefas, campos personalizados, tags. | Conectar fonte, marcar campo como tarefa. | Exclui se não houver oportunidades. |
| *Oportunidade* (vizinha) | Botão "Nova Oportunidade" cria uma fixa de R$ 1.500, sem formulário. | Só título e valor (é o que a API aceita). | Mover de etapa, marcar como ganho. | Não há. |

**Lacunas que aparecem no quadro**
- Lead não é editável e "Qualificar" **não cria a oportunidade** que o domínio manda criar.
- Não existe mover o lead entre "Novos" e "Em contato" (só pelos dados de exemplo).
- Nenhuma entidade tem excluir, arquivar, mesclar duplicados nem histórico de mudanças.
- Cliente não tem cadastro nem ação de "tornar cliente".
- Na pipeline: não dá para editar campo personalizado nem fonte, duplicar pipeline, nem mover registros ao excluir etapa.
- Oportunidade nasce sem formulário.

## 2. Divergências entre o protótipo e o domínio

Estas precisam ser resolvidas **antes** de implementar, porque mudam o modelo.

1. **Stakeholders.** O domínio falava em dois lugares: §5 ("a pessoa vira stakeholder da empresa") e §6 (contato padrão e outros contatos **da oportunidade**). **Resolvido (D2):** os stakeholders moram na **empresa**; a oportunidade puxa o contato padrão e deixa trocar e escolher quem recebe e-mails e reuniões. O protótipo já modela a empresa; falta o lado da oportunidade.
2. **Ciclo de vida não é um campo livre.** O domínio o calcula (§7: Lead → Oportunidade → Cliente → Inativo) e o protótipo o deixa editável. **Direção (D4):** ele passa a resultar de **eventos padronizados e de templates editáveis**, ver [benchmark-ciclo-de-vida.md](./benchmark-ciclo-de-vida.md). Só o "cliente de antes do sistema" é marcado à mão.
3. **CPF é sensível** (§5): fica criptografado, com hash só para achar duplicado, e não deve aparecer inteiro em listas. O protótipo mostra o número completo.
4. **Lead sem pessoa, dono e valor.** O domínio dá ao lead pessoa, empresa opcional, dono, valor e previsão estimados, "visto" e motivo de descarte. O protótipo guarda só nome e e-mail soltos.
5. **Pessoa ↔ empresa duplicada.** O protótipo tem `companyId` na pessoa **e** uma lista de stakeholders na empresa, que não se falam.

## 2.1 Tarefa não é automação (D9, 27/09/2026)

O protótipo desta fase misturou dois mecanismos que precisam ficar separados:

- **Tarefa (= requisito de etapa)** é do domínio da **Oportunidade/pipeline**. Existe porque nem tudo é automático — alguém precisa fazer ou confirmar algo — e é ela que **decide o avanço**: com o gate `ENTER` ou `EXIT` ligado, o registro não entra ou não sai da etapa enquanto a tarefa estiver aberta. É estrutura do funil, não uma automação.
- **Automação é resposta automática**, sem gente no meio: evento acontece, o sistema age sozinho.
- **A tarefa é uma ótima fonte de eventos para notificações** (`tarefa.criada`, `tarefa.atrasada`, `tarefa.concluida` já estão no catálogo), mas isso é uma automação **reagindo** à tarefa, não a tarefa **virando** automação.
- **Evento, etapa e tarefa são três coisas diferentes** (confirmado em 27/09/2026), mesmo quando uma tarefa vive numa etapa. Uma tarefa **do tipo campo** pode gerar mais de um evento: `tarefa.concluida` (o campo foi preenchido), `campo.mudou` (mudou, sem importar para quê) e, quando o campo é de opções fixas (lista ou sim/não), **um evento por valor específico** — ex.: o campo "Motivo da perda" com a opção "Preço" vira o evento `campo.mudou` com a condição `valor = Preço`, não um evento novo por opção. Na tela, isso aparece como uma **lista sugerida** de eventos possíveis para aquele campo, montada sozinha a partir do tipo dele — a pessoa escolhe, não digita.

**O que estava errado no protótipo:** "Marcar como tarefa" (nas configurações da pipeline) criava, por trás dos panos, uma automação com o evento `oportunidade.mudou_de_etapa` — o que dispara em **qualquer** troca de etapa da pipeline, não só na etapa da tarefa. Bug real, não só uma explicação capenga.

**Correção:** "Marcar como tarefa" só cria o requisito. A pessoa tem dois caminhos para ser avisada: o **simples**, embutido na própria tarefa (escolhe um responsável e liga "notificar por push quando a tarefa for criada", sem tocar em Automações); e o **avançado**, o botão "Criar automação a partir desta tarefa", que abre o formulário **já pronto** (ação de notificar, pré-preenchida) e só pede o **evento** — criada, atrasada (se houver prazo) ou concluída. Detalhe completo, e o resto do sistema de notificações (erros, avisos, o sino), em [notificacoes.md](./notificacoes.md).

Isso não muda "Conectar fonte": conectar uma fonte cria a automação de criar lead automaticamente **por decisão explícita** de quem já confirmou aquilo em outra conversa (ver [dominio.md](./dominio.md) §3), e não envolve tarefa nenhuma — continua como está.

## 3. Princípios (valem para todas as entidades)

1. **Nome é o único mínimo técnico.** O resto é opcional; o que o time quiser exigir vira **tarefa** (§8), não campo obrigatório de formulário. Exceções de regra: origem do lead e CNPJ da empresa (para ela ficar completa).
2. **Duas formas de abrir o registro**, as mesmas da oportunidade: painel lateral ou popup, à escolha (Configurar visualização).
3. **Cadastro é curto; a ficha é completa.** O formulário de criação pede só o necessário; o resto se completa na ficha.
4. **Duplicidade avisa e vincula, não duplica** (por e-mail, CPF e CNPJ). Mesclar registros é uma ação explícita, só Admin e Gerente.
5. **Nada some sem rastro:** excluir é **arquivar** (volta atrás). Exclusão definitiva só de Admin, e só para registro sem histórico.
6. **Toda mudança vira histórico** (quem, quando, campo, valor antigo e novo) e aparece na linha do tempo da ficha e na Auditoria.
7. **Campos personalizados (jsonb `customData`) valem para todas as entidades**, não só para a oportunidade, e podem virar coluna, filtro e requisito de etapa.
8. **Perfis:** Vendedor só edita o que é dele (seus leads e oportunidades; **no servidor desde o WP3b**, escopos `leads:own`/`opportunities:own`, com o responsável sendo uma pessoa da equipe); Gerente e Admin editam tudo; pipelines, fontes e tags só Admin e Gerente.

## 4. Escopo por entidade

### 4.1 Lead

**Cadastrar** (manual, por importação ou vindo de fonte)
- Obrigatório: nome (ou título), pipeline e **origem** (fonte no inbound; funcionário que trouxe no outbound). Sem origem, não cria.
- Pessoa: busca por e-mail, telefone ou CPF antes de criar; se achar, **vincula** e avisa. Se não, cria a pessoa junto.
- Documento explícito (CPF ou CNPJ), conforme §5: CNPJ cria a empresa e liga a pessoa; sem CNPJ a empresa fica em análise.
- Opcionais: empresa, tags, dono, valor e previsão estimados, mensagem, campos personalizados.
- Entrada em massa: **importar CSV** com mapeamento de colunas, prévia dos duplicados e origem única para o lote.

**Editar**
- Todos os campos, inclusive trocar de pipeline (leva a etapa equivalente ou pede escolha).
- **Mover entre as colunas de lead** (Novos, Em contato) por botão e arrastar.
- Origem só muda por Admin ou Gerente e fica no histórico.

**Ações**
- **Qualificar:** cria a oportunidade na primeira etapa aberta (`INBOUND` ou `OUTBOUND` conforme a origem), transfere notas, tarefas e e-mails e marca o lead como convertido. Pede o valor se a pipeline exigir.
- **Descartar** com motivo (lista configurável); não conta como perdida. **Restaurar**.
- **Marcar como visto** e registrar o **primeiro contato** (alimenta "tempo até o primeiro contato").
- Adicionar nota, tarefa e e-mail (as mesmas abas da oportunidade).

**Arquivar/excluir:** descartar já esconde; excluir definitivo só Admin e só sem histórico.

### 4.2 Pessoa

**Cadastrar:** nome (mínimo). Pede em seguida, sem obrigar: e-mails e telefones (mais de um, com rótulo e principal), CPF, cargo, empresa, tags, consentimento (base legal LGPD e data).
- **Cliente que preenche de novo** entra como lead com a marca "cliente retornando".

**Editar:** todos os campos. O CPF aparece **mascarado** (`***.444.777-**`) e só quem tem permissão revela. Trocar e-mail ou CPF passa pela checagem de duplicidade.

**Ações:** vincular a uma ou mais empresas (com descrição e tag da função), **mesclar** com outra pessoa, ver oportunidades e leads ligados, arquivar.

**Regras:** o ciclo de vida **não é um campo editável**; mostra o valor que os eventos e o template da pipeline produziram (D4). Existe uma ação "Marcar como cliente (legado)" para quem já era cliente antes do sistema.

### 4.3 Empresa

**Cadastrar:** nome (mínimo) e **CNPJ**. Sem CNPJ, fica **em análise** e nasce a tarefa "Informar CNPJ". CNPJ alfanumérico aceito. Opcional: razão social, segmento, porte, site, endereço, cidade e UF.
- Consulta pública de CNPJ para preencher os dados é opcional; se falhar, vira tarefa.

**Editar:** todos os campos. Informar o CNPJ tira a empresa de análise e conclui a tarefa na hora. Trocar o CNPJ de uma empresa completa pede confirmação e vai para o histórico.

**Ações:** gerenciar **stakeholders**, mesclar, ver oportunidades, arquivar.

**Stakeholders (D2):** a ficha da empresa tem um **campo de relação "Stakeholders"** que lista todas as pessoas cadastradas nela, cada uma com descrição e tag da função (as tags são do time). Adicionar pode vincular uma pessoa existente ou criar uma nova ali mesmo. Uma pessoa pode ser stakeholder de mais de uma empresa. O contato padrão da empresa é único.

**Regras:** empresa em análise segue no funil, mas **não entra na "Assinatura do contrato"** (requisito do template). O contato padrão é único.

### 4.4 Cliente

Cliente **não é um cadastro à parte**; é o ciclo de vida de uma pessoa ou empresa (§7).

- **Nasce** quando uma oportunidade é ganha (a empresa, se houver; senão a pessoa). Não há botão "Novo cliente".
- **"Adicionar cliente existente"** é um atalho que abre o cadastro de pessoa ou empresa já com "cliente (legado)" marcado, para quem veio de antes do sistema.
- **Editar** é editar a pessoa ou a empresa; a página Clientes ganha as colunas **cliente desde** (data do primeiro ganho), **valor ganho** e **oportunidades**.
- **Deixa de ser cliente** apenas por ação manual "marcar como inativo", com motivo.

### 4.5 Pipeline

**Cadastrar:** nome, oferta, etapas do template (editáveis). **Duplicar** uma pipeline existente (copia etapas, requisitos, campos e tags, sem os registros e sem as fontes).

**Editar**
- Etapas: nome, tipo, cor, probabilidade, dias de alerta, ordem. Excluir etapa com registros exige **escolher para onde movê-los**.
- Fontes: editar nome e ativar ou pausar (já existe); trocar o formulário exige confirmar.
- Requisitos: editar direto nas configurações, não só no workflow.
- Campos personalizados: **editar** nome, tipo e opções (hoje só adiciona e apaga); mudar o tipo de um campo com dados pede confirmação.
- Tags de tarefa em uso não saem.

**Ações:** arquivar pipeline (esconde do seletor, mantém o histórico), restaurar, reordenar no seletor.

**Regras:** só Admin e Gerente. Excluir definitivamente só sem nenhum registro, senão só arquivar.

### 4.6 Oportunidade (vizinha, entra por dependência)

- **Formulário de criação** no lugar do botão fixo: título, alvo (empresa ou pessoa), pipeline, etapa, valor, dono.
- **Contatos da oportunidade (D2):** ao escolher a empresa, a oportunidade **puxa o contato padrão** dos stakeholders dela e permite **trocar**. Também dá para **selecionar o alvo** de cada tipo de comunicação (quem recebe os e-mails, quem participa das reuniões, e assim por diante) entre os stakeholders da empresa.
- **Editar todos os campos**, não só título e valor (a API precisa aceitar o resto).
- **Perdido com motivo**, e o botão "Marcar como perdido" deixa de ser desativado.

## 5. Transversais

| Tema | Definição proposta |
|---|---|
| **Padrão de tela** | Criar em painel lateral curto; editar na **ficha** (painel lateral ou popup) com salvamento por campo, como a oportunidade. Pipeline segue em página própria. |
| **Salvar** | Automático por campo, com erro claro e sem perder o que foi digitado. Formulários de criação usam botão Cadastrar. |
| **Validação** | No navegador para ajudar, **no servidor para valer** (origem, CPF, CNPJ, e-mail, contato padrão único, bloqueio de etapa). |
| **Histórico** | Tabela única de mudanças por registro (`ChangeLog`): quem, quando, entidade, campo, antes e depois. Alimenta a linha do tempo e a Auditoria. |
| **Mesclar** | Escolhe o registro que fica, mostra campo a campo o que muda, move oportunidades, notas e tarefas e arquiva o outro. Só Admin e Gerente. |
| **Arquivar** | `archivedAt` em vez de apagar; some das listas e do seletor, aparece com o filtro "Arquivados". |
| **Importar** | CSV para leads, pessoas e empresas, com prévia, mapeamento e relatório de duplicados. |
| **Permissões** | Tabela no fim do escopo definitivo, por ação e por perfil. Vendedor não vê nem edita o que não é dele. |

## 6. Impacto na API e ordem sugerida

Depende das fases 1 a 3 do [plano de schema](./plano-schema.md#10-ordem-de-implementação); o escopo acima não muda a ordem, só acrescenta.

| Passo | Entrega | Depende de |
|---|---|---|
| **A** | **Protótipo primeiro (D8).** Ficha com edição por campo de lead, pessoa, empresa e cliente; stakeholders como campo de relação; qualificar de verdade; mover lead; duplicar pipeline; formulário de oportunidade com contatos; catálogo de eventos e templates de ciclo de vida editáveis. Sem mexer no banco. | Ficar de pé o D4 (pontos da seção 5 do benchmark) |
| **B** | Fase 1: pipelines, etapas e oportunidades na API, com `ChangeLog` e `archivedAt`. | A |
| **C** | Fase 2: pessoas, empresas, documento, stakeholders, mesclar. | B |
| **D** | Fase 3: leads, qualificar, importar, descartar com motivo. | C |
| **E** | Permissões por perfil nas ações de edição (junto da fase de segurança). | D |

Rotas novas: `PATCH` por campo em cada entidade, `POST /merge`, `POST /archive` e `/restore`, `POST /leads/:id/qualify`, `POST /pipelines/:id/duplicate`, `POST /import/:entity`, `GET /:entity/:id/history`.

## 7. Decisões

| # | Decisão | Situação |
|---|---|---|
| **D1** | Padrão de edição | **Decidido:** ficha com edição por campo (a mesma da oportunidade). Criar continua num formulário curto. |
| **D2** | Onde moram os stakeholders | **Decidido:** na empresa, num campo de relação que lista todos os cadastrados. A oportunidade puxa o contato padrão, permite trocar e escolher os alvos de e-mails, reuniões e afins. |
| **D4** | Ciclo de vida | **Direção decidida, detalhes abertos:** eventos padronizados e templates prontos e editáveis (adicionar e remover passos), inclusive para as tarefas comuns da oportunidade. Benchmark pronto em [benchmark-ciclo-de-vida.md](./benchmark-ciclo-de-vida.md); faltam fechar os 6 pontos da seção 5 dele. |
| **D8** | Ordem | **Decidido:** protótipo primeiro; API e banco depois, por entidade, e só com o seu aval para migrar. |
| **D9** | Tarefa vs. automação | **Decidido (seção 2.1):** tarefa é requisito de etapa, do domínio da Oportunidade/pipeline; automação é resposta automática. "Marcar como tarefa" oferece criar uma automação pronta (só escolhe o evento) em vez de criar uma escondida. |
| **D10** | Notificações (erros, avisos, notificações) | **Decidido:** três categorias com um sino na barra lateral; avisos nascem de ações bloqueadas (ex.: mover etapa com gate aberto — card treme, borda vermelha, volta ao lugar, toast no canto inferior esquerdo). Detalhe em [notificacoes.md](./notificacoes.md). Falta decidir **onde** o gate é checado de fato (D3 do gate, não do D10). |
| **D11** | Gatilhos personalizados (webhook de entrada) | **Direção decidida, detalhes abertos:** cada pipeline pode ganhar um webhook de entrada que vira evento personalizado (ex.: `pagamento.confirmado`), do mesmo jeito que qualquer evento do sistema — nunca substitui o caminho manual, só abre outra porta pra mesma ação. Detalhe e pontos em aberto em [gatilhos-personalizados.md](./gatilhos-personalizados.md). |
| D3 | Excluir | Aberto. Recomendado: arquivar sempre; definitivo só Admin e só sem histórico. |
| D5 | Qualificar | Aberto. Recomendado: cria a oportunidade e transfere tudo; pergunta valor e dono na hora só se a pipeline exigir. |
| D6 | Mesclar e importar | Aberto. Recomendado: entram depois da fase 3. |
| D7 | CPF na tela | Aberto. Recomendado: mascarado, revelável por Admin e Gerente com registro no histórico. |
