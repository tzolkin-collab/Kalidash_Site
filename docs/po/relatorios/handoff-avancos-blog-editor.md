# Documento de Handoff & Registro de Avanços

> **Data:** 19 de Outubro de 2026  
> **Repositório:** `tzolkin-collab/Kalidash_Site`  
> **Branch Principal:** `main` (Sincronizada, commit `877309b`)  
> **Status:** Builds do Site (Next.js), Admin (Vite) e API (Go) com 100% de sucesso e 57 testes passando.

---

## 1. Resumo Executivo das Entregas

Este ciclo de trabalho cobriu desde otimizações de performance na experiência do usuário até a reestruturação da interface editorial do Blog no Admin, introduzindo ferramentas de estúdio de imagem (corte e enquadramento real) e organização modular de layout lado a lado.

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                             AVANÇOS PRINCIPAIS                                │
├───────────────────────────────────────────────────────────────────────────────┤
│ 1. Home & Diagnóstico: Redução de lag e reordenação do funil de contato       │
│ 2. Resolução de Z-Index: Fim da sobreposição da sidebar sobre menus e popups  │
│ 3. Estúdio de Foto: Ferramenta de corte (Canvas WebP), zoom e proporções      │
│ 4. Layout Lado a Lado: Blocos de Foto + Texto e 2 Colunas (Zero crash PM)    │
│ 5. Visual 1:1 Editorial: Canvas do artigo idêntico ao preview de leitura      │
│ 6. Checklist & Tipografia: CSS refinado sem bullets duplicados no site        │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Detalhamento dos Avanços por Área

### A. Diagnóstico e Performance da Home
* **Ordem de Etapas do Diagnóstico:** Ajustado em [`DiagnosticoClient.tsx`](apps/site/src/app/diagnostico/DiagnosticoClient.tsx) para priorizar os dados essenciais de contato:
  1. **Etapa 1:** Nome, e-mail e telefone de contato;
  2. **Etapa 2:** Dados e contexto da empresa;
  3. **Etapa 3:** Objetivos e o que a empresa busca alcançar.
* **Otimização de Render na Home:** Refatoração de componentes visuais pesados (memoization em [`FlickeringGrid.tsx`](apps/site/src/app/components/FlickeringGrid.tsx) e contenção de layouts em [`home.module.css`](apps/site/src/app/home/home.module.css)), sanando quedas de framerate no scroll.

---

### B. Correção Definitiva de Popups e Menus Cobertos pela Sidebar
* **Causa Raiz Identificada:**
  - A barra lateral (`.sidebar`) possuía `z-index: 100`, enquanto o container principal (`.main-content`) não tinha stacking context explicitamente configurado.
  - O container `.editor-box` continha `overflow: hidden`, cortando qualquer menu que transbordasse para a margem esquerda (como o Side Menu `⋮⋮` e `+` do BlockNote).
* **Soluções Implementadas:**
  - Em [`index.css`](apps/admin/src/index.css): `.sidebar` ajustada para `z-index: 10` no desktop (mantendo `z-index: 1000` apenas no drawer mobile). `.main-content` recebeu `position: relative; z-index: 20;`.
  - Em [`pages.css`](apps/admin/src/pages.css): `.editor-box` atualizado para `overflow: visible;` e recuo do canvas ampliado para `padding-inline: 56px`.
  - Menus flutuantes, popovers do Mantine e portais (`.mantine-Popover-dropdown`, `.bn-side-menu`, `.bn-suggestion-menu`) elevados para `z-index: 99999 !important;`.

---

### C. Estúdio de Corte, Redimensionamento e Reposicionamento de Fotos
* **Novo Componente [`PhotoCropModal.tsx`](apps/admin/src/components/PhotoCropModal.tsx):**
  - **Proporções Selecionáveis:** `16:9` (Capa/Widescreen), `21:9` (Cinema), `4:3` (Editorial), `1:1` (Quadrado) e `Livre`.
  - **Controles Interativos:** Pan bidimensional por arraste direto com o mouse/pointer, slider de zoom de `1.0x` a `3.0x` e grade auxiliar da regra dos terços.
  - **Corte Real via Canvas:** Renderiza as coordenadas calculadas em alta resolução diretamente em um `<canvas>`, convertendo para `image/webp` de alta qualidade e efetuando upload automático para a API de storage.
* **Integração na Capa:** Adicionado o botão **"✂️ Cortar e Enquadrar"** na barra flutuante da imagem de capa em [`Blog.tsx`](apps/admin/src/pages/Blog.tsx), preservando o ajuste vertical fino.

---

### D. Organização de Conteúdo Lado a Lado (Editor & Leitor)
Para atender à necessidade de dispor conteúdos horizontalmente sem provocar falhas no ProseMirror (`TextSelection endpoint not pointing into a node with inline content`), foram implementados blocos com isolamento rigoroso de eventos em [`articleCardBlock.tsx`](apps/admin/src/pages/articleCardBlock.tsx):

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
   - Estilos responsivos em [`article.module.css`](apps/site/src/app/blog/[slug]/article.module.css): layout flex/grid no desktop com transição fluida para coluna única no mobile.

---

### E. Canvas de Edição Fiel ao Preview do Site
* A área de escrita de [`Blog.tsx`](apps/admin/src/pages/Blog.tsx) foi reestruturada para espelhar a tipografia e hierarquia exata do site:
  - Header meta com categoria editável, data e cálculo de tempo de leitura em tempo real.
  - Título principal com tipografia editorial.
  - Subtítulo/resumo (excerpt) com estilo de abertura.
  - Barra de perfil do autor com avatar gradiente.
  - Imagem de capa posicionada entre o autor e o corpo do texto.
  - Barra de ferramentas global no topo (`editor-super-bar`) com abas de visualização, toggle de publicação, destaque e atalho de SEO/Google.

---

## 3. Mapeamento de Arquivos Alterados

| Arquivo | Descrição das Modificações |
| :--- | :--- |
| `apps/admin/src/components/PhotoCropModal.tsx` | **Novo componente:** Modal de corte real com canvas, aspect ratio e zoom. |
| `apps/admin/src/pages/articleCardBlock.tsx` | Criação dos blocos `splitMedia` e `twoColumns`, schemas e `toExternalHTML`. |
| `apps/admin/src/pages/Blog.tsx` | Integração do botão de corte na capa, itens no Slash Menu e limpeza de imports. |
| `apps/admin/src/index.css` | Rebaixamento de `z-index` da sidebar e stacking context do `main-content`. |
| `apps/admin/src/pages.css` | `overflow: visible` em `editor-box`, elevação de popovers e estilos dos blocos. |
| `apps/admin/src/components/ui.tsx` | Tipagem explícita de retorno do `PopupDialog` compatível com React 18/19. |
| `apps/admin/src/components/Peek.tsx` | Cast de retorno do `createPortal` para `React.ReactElement`. |
| `apps/site/src/app/blog/[slug]/article.module.css` | Estilos globais para `split-media-block`, `two-columns-block` e checklists. |
| `apps/site/src/app/diagnostico/DiagnosticoClient.tsx` | Reordenação das etapas do formulário de diagnóstico. |

---

## 4. Status de Verificação e Qualidade

* **Validação de Build:**
  - `pnpm --filter @kalidash/admin build` ➔ **Sucesso (0 erros)**
  - `pnpm --filter @kalidash/site build` ➔ **Sucesso (0 erros)**
* **Bateria de Testes Automatizados:**
  - `node --test "tests/*.test.ts"` ➔ **57 testes executados, 57 aprovados (0 falhas)**
  - `go test .` (API) ➔ **Aprovado**
