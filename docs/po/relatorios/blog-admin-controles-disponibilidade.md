# Auditoria de Disponibilidade dos Controles do Admin do Blog (Kalidash CMS)

**Objetivo da Auditoria:** Mapear o ciclo de vida, as regras de ativação (`enabled`), bloqueio (`disabled`), proteção condicional (`hidden/modal`) e degradação resiliente (falhas de API/rede e permissões) de cada controle do Admin do Blog.  
**Data:** 18/10/2026  
**Ambiente:** Localhost integrado (`apps/admin` :5173 + `apps/api` :8080 + `apps/site` :3000)

---

## 1. Resumo da Política de Disponibilidade

Os controles do Admin do Blog operam sob três camadas de disponibilidade:
1. **Disponibilidade por Permissão e Papel (RBAC):** Quem tem acesso à tela ou recurso.
2. **Disponibilidade Funcional e de Integridade:** Regras de negócio que habilitam ou desabilitam botões para evitar corrupção de dados (ex.: slugs duplicados, títulos vazios, deleções acidentais).
3. **Disponibilidade Operacional e Resiliente (SLA / Offline / Degradação):** Como os controles se comportam quando a API Go, o banco MySQL ou o preview Next.js ficam indisponíveis.

---

## 2. Matriz de Disponibilidade por Controle

### 2.1. Ações Globais e Ciclo de Vida do Artigo

| Controle | Estado Normal | Condição de Bloqueio (`disabled`) | Condição de Ocultamento (`hidden`) | Comportamento em Falha de API |
|---|---|---|---|---|
| **Botão `Salvar`** | ✅ Habilitado | • `title.trim() === ''` (título em branco)<br>• `slugInvalid === true` (slug já usado ou reservado)<br>• `slugChecking === true` (checagem de slug em voo)<br>• `saving === true` (durante a requisição) | Nunca | Se a API falhar no save: exibe mensagem de erro em vermelho, reabilita o botão e **mantém o texto intacto** no editor (zero perda de dados). |
| **Botão `Excluir`** | ✅ Habilitado | Nunca | • `isNew === true` (artigo ainda não salvo)<br>• `isGlobal === true` (Galeria Principal `blog-global`) | Se a API falhar: exibe mensagem de erro e cancela a exclusão. |
| **Botão `Voltar`** | ✅ Habilitado | Nunca | Nunca | Interceptado com diálogo de confirmação se houver alterações não salvas (`dirty`). Se limpo, volta instantaneamente. |
| **Botão `Novo artigo`** | ✅ Habilitado | Nunca | Oculto se usuário não possuir escopo `blog:write`. | Funciona localmente via roteamento shell; a validação ocorre no primeiro Salvar. |
| **Abas de Visualização (`Editar`, `Lado a lado`, `Pré-visualizar`)** | ✅ Habilitadas | Nunca | Nunca | Independentes da API; operam puramente no estado local do React. |
| **Toggle `Configurações & SEO`** | ✅ Habilitado | Nunca | Nunca | Alterna a largura da grade do editor entre 1 coluna e 2 colunas. |

---

### 2.2. Campos Editoriais e Integridade

| Controle | Estado Normal | Condição de Bloqueio | Comportamento Reativo |
|---|---|---|---|
| **Campo `Título`** | ✅ Habilitado | Nunca | Ao apagar o título, desabilita imediatamente o botão `Salvar`. Ao preencher, reabilita e gera slug de fallback automático. |
| **Campo `Slug (Endereço)`** | ✅ Habilitado | Oculto na Galeria Principal (`slug === 'blog-global'`) | Validação debounced (300ms):<br>• Se reservado (`blog-global`): borda vermelha + **bloqueia Salvar**.<br>• Se já em uso: aviso visual + **bloqueia Salvar**.<br>• Se API de checagem cair: degradação tolerante (permite tentar salvar e deixa o backend validar). |
| **Campo `Resumo`** | ✅ Habilitado | Oculto na Galeria Principal | Opcional; preenche automaticamente a prévia SERP do Google se `seoDescription` estiver vazio. |
| **Upload de Capa (Arquivo)** | ✅ Habilitado | `uploading === true` (durante upload) | Valida tipo MIME e tamanho (≤8MB). Se API falhar: exibe alerta e mantém o editor livre. |
| **Upload de Capa (URL)** | ✅ Habilitado | Botão "Usar" fica desabilitado se input de URL estiver vazio (`!imageUrl.trim()`). | Previne inclusão de strings vazias. |
| **Slider de Corte Vertical** | ✅ Habilitado | Oculto se não houver capa definida | Ajusta em tempo real de 0% a 100% no preview sem necessidade de salvar. |
| **Botão `Remover Capa`** | ✅ Habilitado | Oculto se não houver capa definida | Limpa o campo e restaura o botão de adição. |

---

### 2.3. Cartões da Galeria Principal (`articleCardBlock`)

| Controle | Estado Normal | Regra de Disponibilidade |
|---|---|---|
| **Dropdown de Artigo (`<select>`)** | ✅ Habilitado | • Artigos não publicados **não aparecem**.<br>• Artigos que já têm cartão na galeria **não aparecem**.<br>• Se todos os publicados já estão adicionados: exibe mensagem *"Todos os artigos publicados já estão na galeria"*. |
| **Slash Menu `/artigo`** | ✅ Habilitado na Galeria | **Disponível exclusivamente na Galeria Principal** (`isGlobal`). Bloqueado/indisponível em artigos comuns para não poluir o conteúdo individual. |
| **Edição de Título/Resumo no Card** | ✅ Habilitado | Inputs in-place sempre disponíveis; salvamento sincronizado com os artigos de origem. |
| **Troca de Capa no Card** | ✅ Habilitado | Upload individual por cartão sempre ativo. |
| **Botão `Tirar da Galeria`** | ✅ Habilitado | Remove o cartão do documento, tornando o artigo disponível novamente no dropdown de inserção. |

---

### 2.4. Disponibilidade por Perfil de Usuário (RBAC)

| Perfil / Papel | Escopos Atribuídos | Disponibilidade no Admin Blog |
|---|---|---|
| **ADMIN** | `blog:read`, `blog:write`, `*` | **Total (100%):** Acesso à listagem, criação, edição, publicação, exclusão e galeria. |
| **MANAGER (Gerente)** | `blog:read`, `blog:write` | **Total (100%):** Acesso a todos os controles editoriais do blog. |
| **SELLER (Vendedor)** | Nenhum escopo de blog | **Bloqueio Total (0%):** Link do blog oculto na barra lateral. Acesso direto via URL `/blog` resulta em tela `NotFound (sem permissão)`. |
| **LEITOR / REVISOR (Hipótese de WP futuro)** | Apenas `blog:read` | **Pendente de refinamento:** Atualmente o `App.tsx` exige `can.manageBlog` (`blog:write`). Um usuário só-leitura não entra no admin hoje. |

---

### 2.5. Resiliência Operacional e Estados de Falha

| Cenário de Indisponibilidade Externa | Comportamento do Admin do Blog | Proteção ao Usuário |
|---|---|---|
| **API Go (:8080) Fora do Ar** | • `/blog` mostra aviso com botão *"Tentar de novo"*.<br>• Editor exibe erro em vermelho se tentar salvar. | O rascunho em edição **não é limpo**; o usuário pode aguardar a API subir e clicar em Salvar novamente. |
| **Site Next.js (:3000) Fora do Ar** | O iframe de preview mostra tela de espera ou timeout após 6s. | **Zero bloqueio no editor**: o usuário pode continuar escrevendo, editando e salvando normalmente no modo "Editar". |
| **R2 / Storage Fora do Ar** | O upload de imagem retorna erro legível no modal. | O usuário ainda pode inserir imagens via URL externa ou continuar o texto sem capa. |
| **Conflito de Concorrência** | Se outro usuário salvou um artigo com o mesmo slug: API retorna `409 Conflict`. | O admin exibe a mensagem de conflito e mantém o formulário aberto para troca de slug. |

---

## 3. Conclusão Técnica e Pontos Fortes

1. **Blindagem contra ações destrutivas:** A Galeria Principal não pode ser deletada, e artigos com alterações não salvas não são fechados sem confirmação.
2. **Validação defensiva de slug:** O botão Salvar responde em tempo real a slugs vazios, reservados e conflitantes antes mesmo do envio da requisição.
3. **Isolamento de falhas:** A queda do site ou do storage não impede a edição de texto nem o salvamento do documento.
