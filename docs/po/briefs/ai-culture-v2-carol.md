# Brief: AI Culture V2 (alterações da Carol, 20/10/2026)

> Fonte: Google Doc "Copy site - V2 - AI Culture" (Carol Nunes, 20/10/2026), lido com os comentários. Página afetada: `/treinamento-corporativo-ia` (copy em `apps/site/src/app/institucional/pages.ts`, export `aiCulture`; renderizador em `institucional/SitePage.tsx` e CSS em `institucional.module.css`). A alteração 7 (rodapé) vale para **todas** as páginas (`home/content.ts` → `footer`, `home/SiteFooter.tsx`).
> Dono da execução: quem trabalha em `apps/site` (Antigravity). O PO não edita o site; confere o resultado e dá a nota.
> A Carol aprovou o design das páginas novas no WhatsApp de 20/10 ("Fechado demaissss") e liberou o resto do site.

## 1. Mapa das alterações (doc × página hoje)

| # | O que a Carol pede | Hoje | Ação |
|---|---|---|---|
| 1 | Novo hero com imagem à direita (foto real de turma, `evento-sala.jpg`) e **barra de prova** logo abaixo; "senti falta de imagens e mais elementos, ficou chapada" | Hero só de texto, sem imagem nem barra de prova | Reescrever hero, adicionar imagem e a barra de prova |
| 2 | Novo H2 e texto de "Por que capacitar" | Seção `text` com outro texto | Trocar copy |
| 3 | Metodologia com a copy nova e **interação/leve animação** ("ficou muito chapado") | Bloco `steps` estático | Trocar copy do `steps` e dar movimento (ver §4) |
| 4 | **Eliminar a seção** (a imagem da seção não veio no texto do doc; pela ordem da página é "O que muda? Pessoas, Processos, Liderança, Cultura") | Bloco `cards` "O que muda" | Remover |
| 5 | Formatos em **dois cards lado a lado com o mesmo peso**, com interação/leve animação e foto de treinamento no fundo com blur | Bloco `offers` com dois blocos empilhados | Novo bloco de dois cards (ver §4) |
| 6 | **Adicionar seção Depoimentos** (vídeos; ela gosta dos do Daniel e da Larissa) | Não existe na página | Novo bloco (ver §4 e §3) |
| 7 | **Rodapé** novo, em todas as páginas | Colunas "A Kalidash", "Contato", "Termos de uso" | Trocar (ver §2, alteração 7) |

## 2. Copy exata (copiar do doc, sem reescrever)

### Alteração 1: hero e barra de prova
- Eyebrow: **AI Culture · Treinamento corporativo em IA**
- H1: **Não basta aprender IA. Seu time precisa saber o que fazer com ela.**
- Subtítulo: Treinamento in company construído sobre a rotina, os processos e os casos reais da sua empresa. Trilhas por área e governança desde o primeiro dia.
- Linha de apoio: Turmas a partir de 12 pessoas · Online ou presencial · Carga horária personalizada
- CTA primário: **Solicitar proposta**
- Imagem à direita: foto real de turma em sala (`/home/evento-sala.jpg`)
- Barra de prova, uma faixa só logo abaixo do hero: **+10 mil** pessoas capacitadas · **170** operações atendidas · **97** [média de NPS]
- Legenda dos logos: **Times treinados em**. Logos: ArcelorMittal · CBA · Sicoob · Cooxupé (só os que de fato receberam treinamento)

### Alteração 2
- H2: **Ter acesso à IA não é saber trabalhar com ela.**
- Texto: Muitas empresas já liberaram ChatGPT, Copilot ou Gemini para o time e a rotina continua igual. O gargalo não é a ferramenta, é saber onde aplicar, testar no próprio trabalho e transformar isso em hábito.
- Destaque: **Nosso objetivo é criar capacidade dentro da empresa, não ensinar mais uma ferramenta.**

### Alteração 3
- H2: **Começamos pelo trabalho, não pela ferramenta.**
- 01 · Contexto: Mapeamos áreas, processos e desafios do time antes de montar o conteúdo.
- 02 · Capacitação: O time aprende a usar IA com segurança, com exemplos do próprio setor.
- 03 · Aplicação: Cada pessoa aplica IA em tarefas reais da rotina, durante o treinamento.
- 04 · Cultura: O time sai com autonomia para encontrar novas melhorias sozinho.
- Fecho: **O treinamento termina. A capacidade fica.** O próprio time continua evoluindo, sem depender de consultoria.

### Alteração 5: formatos
- Eyebrow: **Formatos**. H2: **Dois formatos, conforme o seu objetivo.**
- **Card 1 · AI Culture In Company.** Para quem quer **desenvolver capacidade real no time.** Programa sob medida para diferentes áreas e níveis da empresa, com conteúdo e exemplos do seu contexto.
  - **Trilhas por área:** conteúdo diferente para cada função
  - **Casos da sua empresa:** IA aplicada aos processos reais
  - **Uso responsável:** governança e segurança desde o início
  - **Mão na massa:** todos praticam na hora
  - Apoio: A partir de 12 pessoas · Online ou presencial · Certificado e plano de aplicação por área inclusos. CTA (botão): **Solicitar proposta**
- **Card 2 · AI Culture Experiências.** Para quem quer **sensibilizar lideranças e abrir a conversa sobre IA.** Palestras, workshops e imersões sobre IA, agentes e o futuro do trabalho. Ideal para: eventos corporativos, encontros de liderança e semanas de inovação.
  - Apoio: A partir de 5 pessoas · Online ou presencial · Certificado e plano de aplicação por área inclusos. CTA (botão secundário): **Consultar disponibilidade**
- Os dois cards lado a lado, com o mesmo peso visual. Sugestão dela: foto de treinamento nossa ao fundo com blur, para diferenciar do branco e humanizar.

### Alteração 6: depoimentos
- Eyebrow: **Depoimentos**. H2: **O resultado não aparece no certificado. Aparece no trabalho.**
- Vídeos na pasta do Drive da Carol (`17ktfN6roRG-UAf8WVHLm7njTEV8cEvuN`). Preferência dela: **Daniel** e **Larissa**.

### Alteração 7: rodapé (todas as páginas)
- Assinatura: **Preparamos pessoas, processos e tecnologia para a era dos agentes de IA.**
- **Para empresas:** Cultura de IA · Governança · Execução · Diagnóstico
- **Produtos:** Kognis · Spectra AI
- **Contato:** comercial@kalidash.com · Belo Horizonte, MG
- **Termos de uso:** Privacidade · Divulgação responsável

## 3. Perguntas que a Carol precisa responder ANTES de publicar

1. **NPS 97:** o número vem de onde (pesquisa, período, amostra)? No doc está como `97 [média de NPS]`. Não publicar métrica sem fonte.
2. **Card 2:** "A partir de 5 pessoas" e "Certificado e plano de aplicação por área inclusos" parecem copiados do Card 1. Vale para palestras e workshops?
3. **Certificado e plano de aplicação:** existem como entregáveis hoje? (promessa nova no Card 1)
4. **Rodapé:** "Cultura de IA · Governança · Execução" renomeia AI Culture, Advisory e Execução? O menu e as páginas usam AI Culture, Advisory e Execução. Qual nome vale?
5. **Logos:** só os que de fato receberam treinamento (ArcelorMittal, CBA, Sicoob, Cooxupé). O site só tem o logo da ArcelorMittal (`public/logos/arcelormittal.svg`); faltam os outros três, e o **ok de uso dos logos de clientes** segue pendente desde 02/10.
6. **Depoimentos:** a pasta tem Iago, Cesar, Carol, Christopher, Filipe e mais arquivos (a lista tem outra página; Daniel e Larissa devem estar nela). Cada vídeo tem 100 a 290 MB. Confirmar **autorização de uso** de cada pessoa e se há legenda.
7. **Seção eliminada (alteração 4):** confirmar que é "O que muda? Pessoas, Processos, Liderança, Cultura".

## 4. Como implementar (decisões técnicas do PO)

- **Mudar o renderizador, não o conteúdo escrito à mão:** a página é dirigida por blocos em `institucional/pages.ts`. Adicionar tipos de bloco novos em vez de cortar HTML solto: `heroMedia` (hero com imagem), `proofBar` (métricas + logos), `formats` (dois cards lado a lado com fundo de foto em blur), `testimonials` (vídeos). Reaproveitar nas outras páginas quando fizer sentido.
- **Animação:** leve, só `transform` e `opacity`, entrada ao rolar (IntersectionObserver), respeitando `prefers-reduced-motion`. Metodologia: as quatro etapas entram em sequência e a linha de progresso preenche. Cards: elevação e leve inclinação no hover. Nada que piore LCP ou CLS.
- **Fundo em blur:** usar imagem otimizada (`next/image`, tamanho de destino) com `filter: blur` em camada separada e um véu claro por cima para manter contraste de texto ≥ 4,5:1.
- **Vídeos de depoimento:** **não colocar os MP4 no repositório.** Opções: (a) YouTube/Vimeo não listado com embed e imagem de pré-visualização carregando só no clique (recomendado, é o caminho mais barato); (b) comprimir para 720p H.264 de até uns 20 MB e hospedar no R2. Carregar o player sob demanda (clique), com imagem de capa e legenda. Decisão do hosting: **Gustavo**.
- **Imagens:** usar as que já existem em `public/home/` (`evento-sala.jpg`, `evento-palestra.jpg`, `evento-mesa.jpg`, `metodo-reuniao.jpg`, `evento-ai-os.jpg`). Nada de banco de imagem.
- **Rodapé:** trocar em `home/content.ts` (`footer`) e conferir `SiteFooter.tsx` nas 7 páginas; `Contato` com e-mail como `mailto:` e cidade como texto.
- **CTA único:** todo CTA continua indo para `/diagnostico` ("Solicitar proposta" e "Consultar disponibilidade" incluídos).

## 5. Critérios de aceite (o PO confere)

- [ ] Todas as 7 alterações aplicadas com a copy do §2, sem reescrever; a seção da alteração 4 removida.
- [ ] Hero com imagem à direita e barra de prova; **sem** NPS nem logos publicados enquanto as perguntas 1 e 5 do §3 estiverem abertas (placeholder claro no código ou bloco desligado).
- [ ] Metodologia e formatos com animação leve, `prefers-reduced-motion` respeitado, sem salto de layout.
- [ ] Formatos em dois cards lado a lado com o mesmo peso (empilham no celular, na mesma ordem), foto de fundo com blur e contraste legível.
- [ ] Depoimentos com player sob demanda; **nenhum vídeo no repositório**; ao menos dois depoimentos (Daniel e Larissa) quando os arquivos e a autorização estiverem prontos.
- [ ] Rodapé novo nas 7 páginas internas e na Home; links funcionando.
- [ ] `npm run build` do site limpo, sem erro no console; conferido no navegador em 1440 px e 390 px; imagem do hero e do fundo com dimensões declaradas (sem CLS).
- [ ] Relatório curto em `docs/po/relatorios/ai-culture-v2.md` no formato da seção 5 do checklist (itens com ✅/⚠️/❌ e evidência, o que ficou de fora, perguntas).

## 6. Registro (PO, 20/10/2026)

| Pacote | Sessão | Nota | Situação |
|---|---|---|---|
| AI Culture V2 | site-ai-culture-v2 | **9,0** | Aceito. Commit `b60e810`. PO conferiu: `tsc` e `npm run build` limpos; as 9 frases-chave do §2 presentes no código; HTML estático sem "média de NPS", "Times treinados", "Depoimentos" nem "O que muda"; `mailto` no rodapé; no navegador, dois cards de formatos idênticos (628×527 px, lado a lado), sem rolagem horizontal, rodapé com as 4 colunas pedidas. Descontos: LCP/CLS e contraste medidos só por cálculo; rodapé entre 641 e 1100 px não conferido; eyebrows "Nossa metodologia" e "Por que capacitar?" descartados por não estarem no doc (confirmar com a Carol) |

Pendente para ligar o que ficou desligado: respostas da Carol às perguntas do §3 (NPS, logos, vídeos, nomes do rodapé) e hospedagem dos vídeos (Gustavo).

## 7. Respostas da Carol (22/10/2026) e decisões do PO

| # | Pergunta | Resposta e decisão |
|---|---|---|
| 1 | Fonte do NPS 97 | Resposta ambígua ("período"). **Segue desligado** até a Carol dizer a fonte e o período |
| 2 | "A partir de 5 pessoas" e certificado no Card 2 | Resposta ambígua. **Card 2 inalterado** até ela confirmar |
| 3 | Certificado e plano de aplicação existem? | **Sim.** Copy do Card 1 mantida |
| 4 | Nomes do rodapé | **AI Culture · Advisory · Execução · Diagnóstico** (mesmos do menu) |
| 5 | Logos | **Ok de uso** dado. Faltam os arquivos de CBA, Sicoob e Cooxupé; faixa só aparece com os quatro |
| 6 | Depoimentos | **Autorizados** (Daniel e Larissa). Hospedagem: **Cloudflare R2**. Falta o arquivo comprimido, a URL pública e o poster |
| 7 | Seção removida | **Confirmado** pelas capturas do próprio doc: é "O que muda?" (Pessoas, Processos, Liderança, Cultura). Eyebrows "Nossa metodologia" e "Por que capacitar?" **ficam** (a Carol só listou o que mudou) |
| — | "Tem coisa da CWB e da Afinnity, mas não da Spectra" | Contexto não identificado. Perguntar à Carol: é material para a Home, para Cases ou para a página de Soluções? |

Pacote V2.1 enviado ao worker `site-ai-culture-v2` em 22/10.

### Registro V2.1 (PO, 22/10/2026)

| Pacote | Sessão | Nota | Situação |
|---|---|---|---|
| AI Culture V2.1 | site-ai-culture-v2 | **9,0** | Aceito. Commit `2d73887`. PO conferiu: `tsc` e `npm run build` com saída 0 (os `fetch failed` do build são a API do blog fora do ar, já tolerados); HTML estático com "Por que capacitar" e "Nossa metodologia", sem "Times treinados", "média de NPS", "Depoimentos" nem "Governança"; `media.ts` revisado (https, host na lista, `.mp4`; lista vazia = nada toca). Descontos: a tag `<video>` em si não foi exercitada, só a validação; `content.ts` restaurado do HEAD com backup, sem recorrência. |

Para ligar: preencher `ALLOWED_MEDIA_HOSTS` com o host do R2, as URLs e posters de Daniel e Larissa, cargo e empresa, e `status: approved`; soltar os 4 logos em `public/logos/` e trocar `confirmed`.
