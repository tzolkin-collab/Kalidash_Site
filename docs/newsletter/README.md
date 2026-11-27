# Newsletter Kalidash

**Proposta:** uma vez por mês, o que importa para preparar a operação para IA, em 3 minutos de leitura.
**Para quem:** quem se inscreve no blog (gestores de operação, transformação e áreas comerciais).
**Objetivo de negócio:** levar ao pedido de diagnóstico.

## O que existe (MVP, 23/11/2026)

| Peça | Onde | Como sai |
|---|---|---|
| Edição mensal | `apps/api/emails/edicao.html` | À mão, em Resend > Broadcasts, segmento "Newsletter do blog" |
| Boas-vindas | `apps/api/emails/newsletter.html` | Sozinha, para quem se inscreve pela primeira vez |
| Entrega do material | `apps/api/emails/newsletter.html` | Sozinha, para quem pede um "Material gratuito" num artigo |

**No admin:** Newsletter > aba **E-mails** mostra os três como o leitor recebe, diz o que falta para cada um funcionar e copia o modelo mensal para o Resend.

Os automáticos ficam desligados até configurar `NEWSLETTER_FROM` na API (veja [Ligar](#ligar-os-e-mails-automáticos)).

## Montar uma edição (30 minutos)

1. **Copie** o modelo em Newsletter > E-mails > Newsletter mensal > "Copiar e-mail para o Resend" e troque tudo o que está entre `[COLCHETES]`. Apague os blocos que não usar.
2. **Assunto:** `Kalidash · Nº [N] — [tema]`, até 60 caracteres. O prefixo é fixo: é como o leitor reconhece a edição.
3. **Prévia:** uma frase que complete o assunto, até 90 caracteres. Não repita o assunto.
4. **Preencha os blocos dentro dos limites:**

| Bloco | Limite | Regra |
|---|---|---|
| Título | 8 palavras | A ideia do mês, não o nome da newsletter |
| Abertura | 90 palavras | O que a Kalidash viu nos clientes e por que importa. Assinada |
| Do blog | 2 ou 3 cartões | Tema, título, uma linha do que o leitor ganha, tempo de leitura |
| Um número | 1 dado | Só dado aprovado para uso público, com a fonte em uma frase |
| Material | Opcional | Um material por edição |
| CTA | 1 | Sempre "Agendar um diagnóstico". Nunca dois botões |

5. **Links:** todo link para o site leva `utm_source=newsletter&utm_medium=email&utm_campaign=edicao-[N]`. O modelo já traz isso; troque só o `[N]`.
6. **No Resend:** crie o Broadcast no segmento "Newsletter do blog", cole o HTML, envie um teste para você e confira o checklist abaixo.

### Antes de enviar

- [ ] Teste aberto no celular e no computador, no modo claro e no escuro.
- [ ] Todos os links funcionam e levam a UTM da edição.
- [ ] Nenhum `[COLCHETE]` sobrando.
- [ ] `{{{contact.first_name|Olá}}}` e `{{{RESEND_UNSUBSCRIBE_URL}}}` continuam intactos.
- [ ] O número está aprovado para uso público.
- [ ] Remetente e resposta configurados com o endereço de verdade.

### Regras de forma (já seguidas pelo modelo)

- Coluna de 600px, uma só, pensada para funcionar em 320px.
- Títulos e botões em texto, nunca em imagem: chegam mesmo com imagens bloqueadas e funcionam no modo escuro.
- Texto de 16px no corpo e botão de pelo menos 44px de altura.
- HTML abaixo de 102 KB, para o Gmail não cortar.
- A mensagem principal nas primeiras linhas: o Apple Mail troca a prévia por um resumo feito por IA.

## Ligar os e-mails automáticos

Na API (`apps/api/.env`, comentado em `.env.example`):

| Variável | O que é |
|---|---|
| `NEWSLETTER_FROM` | Remetente, ex.: `Carol, da Kalidash <carol@kalidash.com>`. O domínio precisa estar verificado no Resend (SPF, DKIM e DMARC) |
| `NEWSLETTER_REPLY_TO` | Opcional. Para onde vão as respostas (padrão: o remetente) |
| `NEWSLETTER_MATERIAL_URLS` | Link de cada material: `como-calcular-roi-de-ia=https://...;agentes-de-ia=https://...` |

**Como funcionam:**
- **Boas-vindas:** vão só para quem é novo no Resend. Quem já era inscrito e se inscreve de novo não recebe outra vez.
- **Material:** vai sempre que é pedido e o link existe. Sem link configurado, nada é enviado e a equipe manda à mão, como hoje (a tela Newsletter do admin lista quem pediu).
- **Descadastro:** por resposta com "sair", com o cabeçalho `List-Unsubscribe` apontando para o endereço de resposta. As edições usam o descadastro do próprio Resend.

**Materiais publicados hoje** (todos ainda sem arquivo: o link nos artigos é `#`):

| Artigo (slug) | Material |
|---|---|
| `por-que-projetos-de-ia-falham` | Como preparar sua operação para a era dos agentes |
| `como-calcular-roi-de-ia` | O Kit de Priorização de IA |
| `agentes-de-ia` | Playbook de Construção de Agentes de IA |
| `chatgpt-vs-claude-vs-gemini` | Guia de Uso das Principais LLMs do Mercado para Líderes |
| `engenharia-de-prompt` | O Guia Completo de Técnicas de Prompt |

Material novo num artigo: acrescente em `newsletterMaterials` (`apps/api/newsletter_emails.go`) e o link na variável.
Os três artigos das boas-vindas estão em `newsletterStarter`, no mesmo arquivo.

## Métricas

| Métrica | Meta inicial |
|---|---|
| Cliques ÷ entregues | ≥ 3% (mais confiável que abertura, que o Apple Mail infla) |
| Respostas por edição | ≥ 1 |
| Descadastros | < 0,5% por envio |
| Diagnósticos com `utm_source=newsletter` | 1 por trimestre |

## Pendências da Carol

1. Remetente e endereço de resposta (quem assina).
2. Linha editorial: uma newsletter só, ou IA na operação como tema principal e vendas/CRM como apoio.
3. Quem escreve a abertura de cada mês.
4. Quais números de cases podem ser usados.
5. Os arquivos dos 5 materiais (Notion, PDF ou Drive) para preencher `NEWSLETTER_MATERIAL_URLS`.

## Depois (V2)

- Segmentar por interesse (IA na operação × vendas/CRM) usando a página onde a pessoa se inscreveu.
- Montar a edição no admin, escolhendo os artigos e gerando o HTML.
- Sequência de 3 e-mails para quem pede material, terminando no diagnóstico.
- Painel com abertura, cliques e diagnósticos vindos da newsletter.
