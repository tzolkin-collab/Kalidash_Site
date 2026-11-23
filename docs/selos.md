# Selos do admin

Todo selo (marca pequena com texto) do admin sai de um conjunto fechado, em
`apps/admin/src/components/badges.tsx`, mais as tags em `components/TagChip.tsx`.
Nenhuma tela monta selo à mão. `apps/admin/tests/badges.test.ts` falha se aparecer
`<Badge>`, a classe `tag`/`badge`/`badge-*` ou `data-cat=` fora desses dois arquivos.

O visual mora em `apps/admin/src/pages.css`, nas regras `.tagc`.

## Qual selo usar

Responda na ordem e pare no primeiro "sim":

1. **É uma tag** (texto livre que o usuário põe no registro)? → `TagChip`
2. **É a etapa do funil?** → `StageBadge`
3. **É a origem ou fonte do lead?** → `SourceBadge` (ou `SourceName`, que junta origem e fonte)
4. **É a prioridade?** → `PriorityBadge`
5. **É dado ou automação de exemplo** (não é real, não roda no servidor)? → `SampleBadge`
6. **É um campo sem valor** ("Sem dono", "Sem responsável")? → `EmptyBadge`
7. **É um estado que muda com o tempo** (ativo, publicado, arquivado, em análise, enviado, falhou)? → `StatusBadge`
8. **Senão** (tipo, papel, classificação fixa, versão, contagem) → `LabelBadge`

| Selo | Forma | Exemplos |
|---|---|---|
| `StatusBadge` | pílula tingida com ponto (o ícone, se houver, toma o lugar do ponto) | Ativo, Publicado, Arquivada, Em análise, Enviado |
| `LabelBadge` | contorno reto, sem ponto | Venda, Pós-venda, Admin, Produção, 3 passos, v2 |
| `SampleBadge` | contorno âmbar tracejado com frasco | Exemplo, Só neste navegador |
| `EmptyBadge` | cinza, sem cor | Sem dono |
| `StageBadge` | contorno na cor da etapa, ícone do tipo | Novos, Proposta, Ganho |
| `SourceBadge` | tracejado azul com bússola | Inbound · Formulário da LP |
| `PriorityBadge` | barra lateral com bandeira | Alta, Média, Baixa |
| `TagChip` | forma pela categoria da tag | B2B, Decisor, Feira X |

Selos com significado fixo já prontos: `LifecycleBadge` (ciclo de vida), `LeadStatusBadge`
(situação do lead) e `TaskStatusBadge` / `TaskStatusPicker` (status da tarefa). Use esses
em vez de montar o mesmo estado com `StatusBadge` e um `tone` escolhido na hora.

## Cor (`tone`)

A cor diz o sentido, nunca é enfeite. O mesmo sentido tem a mesma cor em todas as telas.

| tone | Sentido |
|---|---|
| `success` | deu certo, ativo, publicado, conectado |
| `warning` | pede atenção, pendente, em análise |
| `danger` | falhou, parado, revogado, arquivado |
| `info` | informativo, sem juízo de valor positivo ou negativo |
| `accent` | destaque da marca (ex.: "Lead" numa lista de oportunidades) |
| `neutral` | padrão; sem juízo |

## Fora do conjunto, de propósito

Não são selos e seguem com o próprio estilo: contadores numéricos (`tab-count`, o número do
sino), a pré-visualização do blog público (`canvas-*-badge`, que imita o site e não o admin)
e textos de validação inline (`slug-badge`).
