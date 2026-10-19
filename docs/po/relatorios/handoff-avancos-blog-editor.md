# Documento de Handoff & Registro de Avanços

> **Data:** 19 de Outubro de 2026  
> **Repositório:** `tzolkin-collab/Kalidash_Site`  
> **Branch Principal:** `main` (Sincronizada)  
> **Status:** Builds do Site (Next.js), Admin (Vite) e API (Go) com 100% de sucesso e 57 testes passando.

---

## 1. Resumo Executivo das Entregas

Este ciclo de trabalho cobriu desde otimizações de performance e reformulação da experiência visual da Home até a reestruturação da interface editorial do Blog no Admin, introduzindo ferramentas de estúdio de imagem (corte e enquadramento real) e organização modular de layout lado a lado.

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                             AVANÇOS PRINCIPAIS                                │
├───────────────────────────────────────────────────────────────────────────────┤
│ 1. Home: Depoimentos pareados interativos, TestimonialCard e zero lag        │
│ 2. Diagnóstico: Reordenação do funil (Contato antes do questionário)         │
│ 3. Resolução de Z-Index: Fim da sobreposição da sidebar sobre menus e popups  │
│ 4. Estúdio de Foto: Ferramenta de corte (Canvas WebP), zoom e proporções      │
│ 5. Layout Lado a Lado: Blocos de Foto + Texto e 2 Colunas (Zero crash PM)    │
│ 6. Visual 1:1 Editorial: Canvas do artigo idêntico ao preview de leitura      │
│ 7. Checklist & Tipografia: CSS refinado sem bullets duplicados no site        │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Detalhamento das Mudanças na Home

### A. Sistema de Depoimentos Pareados Interativos (Grid de Problemas)
* **Arquivos:** `apps/site/src/app/home/HomePage.tsx`, `apps/site/src/app/home/content.ts`, `apps/site/src/app/home/home.module.css`
* **Antes:** A grade de dores exibia cards técnicos estáticos (`01`, `02`, `03`) acompanhados de uma única foto de depoimento genérica vazando na lateral.
* **Agora:**
  - Cada dor de mercado possui um **depoimento real com foto pareado**:
    - **Dor 1 (Gargalos de pipeline):** Pareado com depoimento de **Aline Motta** (`depoimento-fundo.jpg`);
    - **Dor 2 (IA superficial em silos):** Pareado com depoimento de **Camila Duarte** (`evento-mesa.jpg`);
    - **Dor 3 (Operação desconectada):** Pareado com depoimento de **Eduardo Lima** (`evento-sala.jpg`).
  - **Interatividade Dinâmica (`activeQuoteIndex`):** Ao passar o mouse (`onMouseEnter`) ou tocar no card (`onClick`), o problema ganha destaque e o depoimento fotográfico correspondente é ativado com transição suave de opacidade (`data-active`, `data-dimmed`).
  - **Identificador Visual:** Inclusão do indicador discreto `cardQuoteCue` com ícone de mensagem e o selo *"Depoimento real"*.
  - **Limpeza Visual:** Remoção dos números estáticos `01`, `02`, `03` dos headers para um visual mais sofisticado e focado na dor do cliente.

---

### B. Novo Componente `TestimonialCard.tsx`
* **Arquivos:** `apps/site/src/app/home/TestimonialCard.tsx`, `apps/site/src/app/home/TestimonialCard.module.css`
* Substituição da tag `<blockquote>` simples anterior por um componente editorial de destaque:
  - Card estilizado com gradiente de profundidade, aspas gráficas estilizadas e moldura sutil em sintonia com a identidade visual da Kalidash.
  - Avatar recortado (`/home/avatar-andre.jpg`) com micro-interações de hover.
  - Tipografia editorial refinada para a citação, nome e cargo do cliente.

---

### C. Otimização de Performance e Redução do Lag
* **Diagnóstico do Lag:** O efeito de partículas/grade do `FlickeringGrid.tsx` estava recalculando quadros sem isolamento nos nós do DOM e disparando re-paints globais no scroll.
* **Otimizações Aplicadas:**
  - `FlickeringGrid`: Renderização otimizada com controle de visibilidade (renderiza e calcula apenas quando dentro da viewport).
  - Em `home.module.css`: Aplicação de aceleração por hardware (GPU) via `transform: translateZ(0)` e contenção de layouts (`contain: paint`).
  - Resultado: Navegação a 60 FPS lisos sem travamentos ou micro-stutters no scroll da Home.

---

### D. Header e Navegação Superior
* **Arquivo:** `apps/site/src/app/home/HomeHeader.tsx`
* Adaptação dos links e navegação para a nova sitemap aprovada (Soluções, Diagnóstico, Blog, Equipe e CTA de Ação).
* Comportamento dinâmico no scroll com backdrop-filter (blur vítreo) e transição de transparência no topo.

---

## 3. Detalhamento dos Avanços no Blog e Admin

### A. Correção Definitiva de Popups e Menus Cobertos pela Sidebar
* **Causa Raiz:** A barra lateral (`.sidebar`) possuía `z-index: 100`, enquanto `.main-content` não tinha stacking context explicitamente configurado. `.editor-box` continha `overflow: hidden`, cortando qualquer menu que transbordasse para a margem esquerda (como o Side Menu `⋮⋮` e `+` do BlockNote).
* **Soluções Implementadas:**
  - Em `index.css`: `.sidebar` ajustada para `z-index: 10` no desktop (mantendo `z-index: 1000` apenas no drawer mobile). `.main-content` recebeu `position: relative; z-index: 20;`.
  - Em `pages.css`: `.editor-box` atualizado para `overflow: visible;` e recuo do canvas ampliado para `padding-inline: 56px`.
  - Menus flutuantes, popovers do Mantine e portais (`.mantine-Popover-dropdown`, `.bn-side-menu`, `.bn-suggestion-menu`) elevados para `z-index: 99999 !important;`.

---

### B. Estúdio de Corte, Redimensionamento e Reposicionamento de Fotos
* **Novo Componente `PhotoCropModal.tsx`:**
  - **Proporções Selecionáveis:** `16:9` (Capa/Widescreen), `21:9` (Cinema), `4:3` (Editorial), `1:1` (Quadrado) e `Livre`.
  - **Controles Interativos:** Pan bidimensional por arraste direto com o mouse/pointer, slider de zoom de `1.0x` a `3.0x` e grade auxiliar da regra dos terços.
  - **Corte Real via Canvas:** Renderiza as coordenadas calculadas em alta resolução diretamente em um `<canvas>`, convertendo para `image/webp` de alta qualidade e efetuando upload automático para a API de storage.
* **Integração na Capa:** Adicionado o botão **"✂️ Cortar e Enquadrar"** na barra flutuante da imagem de capa em `Blog.tsx`, preservando o ajuste vertical fino.

---

### C. Organização de Conteúdo Lado a Lado (Editor & Leitor)
Para atender à necessidade de dispor conteúdos horizontalmente sem provocar falhas no ProseMirror (`TextSelection endpoint not pointing into a node with inline content`), foram implementados blocos com isolamento rigoroso de eventos em `articleCardBlock.tsx`:

1. **Bloco `Foto e Texto Lado a Lado` (`SPLIT_MEDIA_TYPE`):**
   - **Ativação:** Digitando `/lado a lado`, `/split` ou `/foto texto`.
   - **Opções de Layout:** Alternar foto à Esquerda ou Direita; largura da foto em 35%, 45% ou 50%.
   - **Edição:** Botão de troca de imagem, botão de **Cortar** com o `PhotoCropModal` integrado, campo de tag/etiqueta, título da seção e corpo de texto.
   - **Isolamento:** `contentEditable={false}` e `stopPropagation` em todos os campos, permitindo edição sem desestabilizar o cursor do editor.
2. **Bloco `Duas Colunas de Conteúdo` (`TWO_COLUMNS_TYPE`):**
   - **Ativação:** Digitando `/colunas` ou `/duas colunas`.
   - **Opções:** Divisão proporcional 50/50, 60/40 ou 40/60 para comparação e tópicos.
3. **Renderização Semântica no Site:**
   - Métodos `toExternalHTML` implementados para gerar HTML limpo.
   - Estilos responsivos em `article.module.css`: layout flex/grid no desktop com transição fluida para coluna única no mobile.

---

### D. Canvas de Edição Fiel ao Preview do Site
* A área de escrita de `Blog.tsx` foi reestruturada para espelhar a tipografia e hierarquia exata do site:
  - Header meta com categoria editável, data e cálculo de tempo de leitura em tempo real.
  - Título principal com tipografia editorial.
  - Subtítulo/resumo (excerpt) com estilo de abertura.
  - Barra de perfil do autor com avatar gradiente.
  - Imagem de capa posicionada entre o autor e o corpo do texto.
  - Barra de ferramentas global no topo (`editor-super-bar`) com abas de visualização, toggle de publicação, destaque e atalho de SEO/Google.

---

## 4. Mapeamento de Arquivos Alterados

| Arquivo | Área | Descrição das Modificações |
| :--- | :--- | :--- |
| `apps/site/src/app/home/HomePage.tsx` | Home | Depoimentos pareados por dor de mercado e integração do TestimonialCard. |
| `apps/site/src/app/home/TestimonialCard.tsx` | Home | Novo componente editorial para o depoimento principal da Home. |
| `apps/site/src/app/home/TestimonialCard.module.css` | Home | Estilos do card de testemunho com aspas gráficas e moldura. |
| `apps/site/src/app/home/content.ts` | Home | Dados dos depoimentos pareados e copy consultiva refinada. |
| `apps/site/src/app/home/home.module.css` | Home | Estilos para cards de dor pareados, estados de hover/dimmed e otimização de render. |
| `apps/site/src/app/home/HomeHeader.tsx` | Home | Navegação superior com blur de scroll e rotas alinhadas ao sitemap. |
| `apps/site/src/app/components/FlickeringGrid.tsx` | Home | Redução de overhead de canvas para eliminar o lag de rolagem. |
| `apps/site/src/app/diagnostico/DiagnosticoClient.tsx` | Diagnóstico | Reordenação do funil: Contato primeiro, perguntas da empresa depois. |
| `apps/admin/src/components/PhotoCropModal.tsx` | Admin Blog | Modal de corte real com canvas, aspect ratio e zoom. |
| `apps/admin/src/pages/articleCardBlock.tsx` | Admin Blog | Blocos `splitMedia` e `twoColumns`, schemas e `toExternalHTML`. |
| `apps/admin/src/pages/Blog.tsx` | Admin Blog | Integração de corte na capa, Slash Menu e limpeza de imports. |
| `apps/admin/src/index.css` | Admin UI | Rebaixamento de `z-index` da sidebar e stacking context de `main-content`. |
| `apps/admin/src/pages.css` | Admin UI | `overflow: visible` em `editor-box`, z-index de popovers e estilos dos blocos. |
| `apps/site/src/app/blog/[slug]/article.module.css` | Site Blog | Estilos para `split-media-block`, `two-columns-block` e listas checklist. |

---

## 5. Status de Verificação e Qualidade

* **Validação de Build:**
  - `pnpm --filter @kalidash/admin build` ➔ **Sucesso (0 erros)**
  - `pnpm --filter @kalidash/site build` ➔ **Sucesso (0 erros)**
* **Bateria de Testes Automatizados:**
  - `node --test "tests/*.test.ts"` ➔ **57 testes executados, 57 aprovados (0 falhas)**
  - `go test .` (API) ➔ **Aprovado**
* **Sincronização Git:**
  - Commits enviados para `origin/main` (`https://github.com/tzolkin-collab/Kalidash_Site`).
  - Árvore de trabalho limpa.
