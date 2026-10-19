# Auditoria dos Controles do Admin do Blog (Kalidash CMS)

**Data da Auditoria:** 18/10/2026  
**Ambiente:** Localhost (`apps/admin` :5173 + `apps/api` :8080 + `apps/site` :3000)  
**Metodologia:** Inspeção estática de código (`Blog.tsx`, `articleCardBlock.tsx`, `PreviewFrame.tsx`, `pages.css`) + teste funcional interativo via Chrome DevTools no navegador com backend e banco ativos.

---

## 1. Resumo Executivo da Nota de Controles

| Grupo de Controles | Qtd. Controles | Status Geral | Nota |
|---|:---:|:---:|:---:|
| **1. Listagem & Filtros (`/blog`)** | 6 controles | ✅ Excelente | **9,5 / 10** |
| **2. Barra de Ações & Ciclo de Vida** | 4 controles | ✅ Robusto | **9,8 / 10** |
| **3. Modos de Visualização & Espaço** | 4 controles | ✅ Excelente | **9,8 / 10** |
| **4. Campos Editoriais & Assets** | 6 controles | ✅ Fluido | **9,5 / 10** |
| **5. Editor Rich-Text (BlockNote)** | 8 recursos | ✅ Operacional | **9,2 / 10** |
| **6. Cartões da Galeria (`gcard`)** | 7 controles | ✅ Responsivo | **9,4 / 10** |
| **7. Metadados, Slug & SEO** | 6 controles | ✅ Blindado | **9,7 / 10** |
| **8. Preview Integrado (Iframe)** | 3 controles | ✅ Bidirecional | **9,6 / 10** |

---

## 2. Matriz Detalhada de Controles

### 2.1. Listagem de Artigos (`/blog`)

| Controle | Tipo | Comportamento Observado | Validação / Feedback | Status |
|---|---|---|---|:---:|
| **Botão "Novo artigo"** | Botão primário (`btn-solid`) | Navega para `/blog/novo` e inicializa rascunho limpo com autor padrão da equipe. | Imediato via shell router. | ✅ OK |
| **Abas de Status (`Tabs`)** | Abas (`Galeria principal`, `Todos`, `Publicados`, `Rascunhos`) | Filtra a lista instantaneamente pelo status; exibe contadores exatos (excluindo a galeria da contagem de artigos comuns). | Troca visual de tab + re-renderização da tabela. | ✅ OK |
| **Aba "Galeria principal"** | Modo de aba especial | Oculta a listagem e exibe o cartão de atalho dedicado com descrição clara e botão "Editar Galeria Principal". | Redireciona para o ID da `blog-global`. | ✅ OK |
| **Campo de Busca** | Input de texto (`SearchBox`) | Filtra em tempo real (sem debounce, leve) por título, slug e categorias combinados. | Tabela vazia exibe EmptyState customizado se nada for encontrado. | ✅ OK |
| **Linhas da Tabela** | Linha clicável (`tr.clickable`) | Abre o artigo ao clicar em qualquer lugar da linha. Exibe estrela para destaque e badge para status. | Hover state presente. *(Oportunidade: adicionar `tabIndex={0}` para acessibilidade por teclado).* | ⚠️ Parcial a11y |
| **Paginação** | Controles de página | Divide em páginas de 10 artigos, com botões Anterior/Próximo e seletor de tamanho. | Mantém consistência com o total filtrado. | ✅ OK |

---

### 2.2. Ações de Topo & Ciclo de Vida (`PageHeader`)

| Controle | Tipo | Comportamento Observado | Validação / Feedback | Status |
|---|---|---|---|:---:|
| **Botão "Voltar"** | Botão secundário (`btn`) | Se não houver alterações: volta direto para `/blog`. Se houver alterações não salvas (`dirty`): abre diálogo de confirmação. | Diálogo modal com opções "Continuar editando" ou "Sair sem salvar". Previne perda acidental de trabalho. | ✅ OK |
| **Botão "Excluir"** | Botão destrutivo (`btn-danger`) | Abre diálogo de confirmação crítica. Remove do banco via `deleteArticle()`. **Oculto na Galeria Principal (`blog-global`)**. | Proteção absoluta contra deleção acidental da raiz do blog. | ✅ OK |
| **Botão "Salvar"** | Botão de ação primária | Executa validações rigorosas (`canSave`): título não vazio, slug válido e livre de conflitos, sem checagem pendente. | Transita para estado de carregamento *"Salvando…"*, exibe *"Salvo agora."* ou banner de erro com a mensagem da API. | ✅ OK |
| **Indicadores de Status** | Badges | Mostra `Publicado` (verde) ou `Rascunho` (cinza) e badge de `Destaque` (amarelo com ícone de estrela). | Atualiza instantaneamente com os switches. | ✅ OK |

---

### 2.3. Modos de Visualização & Ergonomia

| Controle | Tipo | Comportamento Observado | Validação / Feedback | Status |
|---|---|---|---|:---:|
| **Aba "Editar"** | Modo de visualização | Foca exclusivamente no editor de texto, ocultando o iframe de preview. | Libera espaço horizontal máximo para escrita e blocos longos. | ✅ OK |
| **Aba "Lado a lado"** | Modo split | Divide a tela entre o editor e o iframe de pré-visualização. Auto-colapsa o painel lateral em telas < 1440px. | Edição com feedback visual simultâneo sem amassar componentes. | ✅ OK |
| **Aba "Pré-visualizar"** | Modo de visualização | Oculta o editor e foca na visualização do artigo no design final do site. | Renderização fiel via iframe conectado ao Next.js. | ✅ OK |
| **Toggle "Configurações & SEO"** | Botão alternador com ícone | Abre/fecha a coluna lateral de configurações (320px). | Ganho imediato de +45% de largura para o editor e preview quando fechada. | ✅ OK |

---

### 2.4. Campos Editoriais & Assets

| Controle | Tipo | Comportamento Observado | Validação / Feedback | Status |
|---|---|---|---|:---:|
| **Título da Publicação** | Textarea expansível (`title-input`) | Substituiu o input simples de 1 linha. Permite que títulos longos quebrem naturalmente sem corte horizontal. | Suporte a multiline; aciona validação automática de fallback de slug se slug estiver vazio. | ✅ OK |
| **Resumo do Artigo** | Textarea (`textarea`) | Campo de 2 linhas para o lead/excerpt do artigo e meta description de fallback. | Atualiza preview instantaneamente. | ✅ OK |
| **Adicionar Foto de Capa** | Botão com diálogo | Abre modal com duas opções: upload direto de arquivo ou colagem de URL externa. | Valida formato, comprime via API Go e gera URL pública. | ✅ OK |
| **Slider de Corte Vertical** | Slider (`input[type=range]`) | Ajusta `coverImagePos` de 0% (topo) a 100% (base) com indicador textual *"Corte: [slider]"*. | Preview imediato via `object-position: 50% X%`. | ✅ OK |
| **Remover Capa** | Botão de ação rápida | Remove a capa e restaura o botão de adicionar capa. | Desmarca asset com 1 clique e marca estado como dirty. | ✅ OK |

---

### 2.5. Editor Rich-Text (BlockNote)

| Recurso | Tipo | Comportamento Observado | Status |
|---|---|---|:---:|
| **Slash Menu (`/`)** | Menu flutuante de blocos | Oferece títulos, listas, citações, tabelas, código e divisores traduzidos para pt-BR. Na galeria, oferece o bloco customizado de Artigo. | ✅ OK |
| **Formatação Inline** | Toolbar de seleção | Negrito, itálico, sublinhado, tachado, código inline e links. | ✅ OK |
| **Upload de Mídia no Corpo** | Drag-and-drop / Inserção | Dispara `uploadImageNotifying`, processa no backend e insere no documento. | ✅ OK |
| **Tema do Editor** | Tema adaptativo | Respeita o tema do painel administrativo (`shell.dark`). | ✅ OK |
| **Conversão Legada** | Parser de fallback | `tryParseHTMLToBlocks` converte artigos antigos sem `bodyJson` na primeira abertura. | ✅ OK |

---

### 2.6. Cartões da Galeria Principal (`articleCardBlock`)

| Controle | Tipo | Comportamento Observado | Status |
|---|---|---|:---:|
| **Seletor de Artigo** | Dropdown `<select>` | Para cartões recém-adicionados, lista apenas artigos publicados ainda não incluídos na galeria. | ✅ OK |
| **Título e Resumo no Card** | Inputs in-place | Permite editar texto do cartão diretamente no admin sem abrir o artigo. | ✅ OK |
| **Trocar / Adicionar Capa** | Label com file input | Dispara upload imediato e atualiza o thumbnail do cartão. | ✅ OK |
| **Corte Vertical do Card** | Slider compacto encapsulado | Ajusta o alinhamento da imagem dentro da miniatura com precisão. | ✅ OK |
| **Botão "Tirar da galeria"** | Botão de exclusão de bloco | Remove o cartão da galeria sem excluir o artigo real do banco. | ✅ OK |
| **Reordenação Drag-and-Drop** | Handle lateral (`⋮⋮`) | Permite reordenar a grade de artigos da galeria por arraste. | ✅ OK |
| **Sincronização Bidirecional** | `saveCardEdits()` | Salva alterações de título/resumo/capa de volta nos artigos de origem. | ✅ OK |

---

### 2.7. Painel Lateral: Metadados, Slug & SEO

| Controle | Tipo | Comportamento Observado | Status |
|---|---|---|:---:|
| **Switch "Publicado"** | Switch toggle | Alterna se o artigo é visível publicamente no site ou apenas rascunho no admin. | ✅ OK |
| **Switch "Destaque"** | Switch toggle | Define prioridade do artigo na listagem e na ordenação padrão. | ✅ OK |
| **Campo Slug (Endereço)** | Input com validação assíncrona | Validação em tempo real (debounce 300ms contra `/api/blog/slug-available`). Bloqueia slugs reservados (`blog-global`, etc.) e já utilizados. Borda vermelha e bloqueio do botão salvar em conflitos. Fallback determinístico caso vazio. | ✅ OK |
| **Seletor de Autor** | `CustomSelect` | Lista os membros da equipe cadastrados e preserva autores legados. | ✅ OK |
| **Campo Categorias** | Input de texto | Converte tags separadas por vírgula em array limpo. | ✅ OK |
| **Painel SEO & SERP** | Campos + Google Snippet | Contadores de caracteres para título (60) e descrição (160) com prévia fiel de SERP do Google. | ✅ OK |

---

### 2.8. Preview Iframe (`PreviewFrame`)

| Recurso | Tipo | Comportamento Observado | Status |
|---|---|---|:---:|
| **Comunicação PostMessage** | Canal bidirecional | Envia rascunho dinamicamente (`kalidash:preview`) a cada edição sem precisar salvar no banco. | ✅ OK |
| **Alternador de Dispositivo** | Ícones Desktop / Mobile | Alterna o iframe entre largura total (100%) e largura mobile (375px) com moldura escura. | ✅ OK |
| **Clique-para-focar** | Evento `kalidash:focus` | Clicar em qualquer seção no iframe rola o editor e foca o campo/bloco correspondente. | ✅ OK |

---

## 3. Recomendações e Próximos Passos Sugeridos

1. **Acessibilidade por Teclado na Tabela de Artigos:**  
   Adicionar suporte a `onKeyDown` (tecla Enter ou Espaço) nas linhas da tabela de artigos para usuários que utilizam exclusivamente navegação por teclado.
2. **Auto-save / Rascunho Local Opcional:**  
   Para artigos muito extensos, considerar salvar rascunhos não publicados em `localStorage` como camada extra de segurança contra fechamentos inesperados do navegador.
3. **Limpeza do Formulário de Configurações Gerais (`BlogSettingsForm`):**  
   Atualmente esse formulário não é consumido pelo frontend do site. Poderá ser integrado ou removido no próximo ciclo de consolidação.
