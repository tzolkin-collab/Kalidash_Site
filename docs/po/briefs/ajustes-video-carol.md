# Ajustes do vídeo da Carol (04/11/2026)

> Base: branch `claude/v3-preview`, que reúne Home, Advisory, Execução e AI Culture.
> Regras: `D:/Códigos/Tzolkin/Projetos/carol/kalidash/docs/po/briefs/v3-comum.md` e `motion-comum.md`, com as exceções abaixo.
> O que ela critica com mais frequência: **seção grande demais, vazio e frase cortada.** O que ela elogia: as animações, em especial "Do problema à solução rodando", e a estrutura de "O que construímos". Não estrague o que ela aprovou.

## Decisões do dono que valem acima dos briefs antigos
- Aberturas de Execução e AI Culture em branco, não em Limestone (já feito, `d10fbb1`).
- Hero da Home é o original (já feito). Não altere.
- Item ativo de "O que fazemos" sem quadrado nem barra lateral (já feito).

## Fazer

### AI Culture
1. **"Nosso objetivo é criar capacidade dentro da empresa, não ensinar mais uma ferramenta."**: bloco com **fundo roxo escuro**, altura bem menor, frase esticada em largura, em uma ou duas linhas. É um detalhe, não uma seção. "capacidade" continua em destaque e o filete animado continua.
2. **Fechamento:** mesmo fundo de nuvens do Advisory (`/marca/nuvens-douradas.jpg`, `ClosingBg`), que hoje falta.

### Execução
3. **"Saber o que mudar…":** seção mais compacta e título sem quebra grosseira. Hoje a seção tem cerca de 572 px; mantenha a animação dos gargalos.
4. **"O projeto termina quando a sua empresa consegue seguir sem a gente.":** mais esticada, sem cortes e com menos vazio. A seção de passos é a favorita dela: não mude a animação.
5. **Fechamento:** troque os arcos pelo mesmo fundo de nuvens do Advisory, para ficar igual.
6. **H1 do hero:** está grande demais em 1440 (três linhas enormes). Ajuste para o mesmo nível do Advisory.
7. **Rótulo "02 / 05" sobre a faixa grega** no pé do hero: os dois se sobrepõem. Corrija aqui e confira em AI Culture.

### Advisory
8. **Encurtar os palcos:** "A estratégia foi definida" tem 2380 px e "Ajudamos sua liderança" tem 2110 px. Reduza para cerca de 170 svh cada, com a mesma sequência. Confira que nenhum quadro fica vazio ou com texto quase invisível durante a troca: em um quadro, "Acompanhamos o que acontece" aparece apagado sem nada legível ao redor. A frase precisa estar legível na maior parte do tempo.

### Sobre nós
9. **Foto da CBA:** no mosaico, troque `/home/g21-cba-premio.jpg` por outra foto real da Kalidash que já esteja em `public/` (veja `docs/po/relatorios/imagens-carol.md`). Escreva `alt` correto. Justifique a escolha: ela precisa aprovar.
10. **Reduzir vazio:** a Carol pediu para aproximar elementos e diminuir uma seção com muito espaço, provavelmente a linha do tempo logo depois do mosaico. Veja a tela, ajuste e diga qual seção mudou.
11. **"Nós ensinamos o que vivemos. E vivemos o que ensinamos.":** esticada, sem corte no meio de cada frase. Em uma linha no desktop, ou duas, uma por frase.
12. **"A inteligência artificial está a serviço da inteligência humana.":** elemento grego ao fundo, em baixa opacidade, com bom contraste. Use asset da marca em `docs/po/design/marca/pdf-assets/` (nunca de `evitar/`), otimizado em `public/marca/`.
13. **Foto da equipe:** sem cortar cabeças, em 1440, 1024, 768 e 390.

### Blog
14. **Filtros de categoria na lateral** no desktop, à esquerda da grade, presos na rolagem. No celular, continuam no topo. Mantenha `?categoria=`, o contrato de `data-*` em `docs/blog-design-contrato.md` e a página do preview do admin. Para testar, use a API de produção só para leitura; se não tiver acesso, use uma resposta falsa local.

### Menu
15. **Só o texto das descrições**, em `nav` de `home/content.ts`:
    - AI Culture: `Treinamento corporativo para times e lideranças`
    - Advisory: `Governança, priorização e acompanhamento`
    - Execução: `Implementação de agentes, automações e integrações`

    Nenhuma outra mudança no cabeçalho. Confira que o submenu não quebra de layout.

### Desempenho
16. **AI Culture com CPU 4x:** LCP subiu de 464 para 544 ms e TBT de 154 para 394 ms. Separe a causa (kit de fontes × `framer-motion`), medindo com um e sem o outro. Se for o movimento, adie o carregamento. Meça também Advisory e Execução, que carregam `AdvisoryMotion` e `ExecucaoMotion` no mesmo `KitPage`: uma página não pode pagar pelo código da outra. Se precisar, use `next/dynamic` nesses imports.

## Segunda parte: componentes fracos (em pausa)

> Em pausa desde 04/11: o dono entende que o problema é de design, não só de cor e fonte. O item 17 passa para docs/po/briefs/redesenho-home.md.

Copy intocada: reorganizar não muda nenhuma palavra, salvo a retirada de rótulos indicada no item 17.

17. **Cartões do problema na Home** (`home-problem`): saem os três cartões iguais, a textura de pontos, os ícones e o rótulo "Depoimento real". Entra uma lista editorial, com filetes: cada sintoma com título e texto, e o depoimento correspondente visível sem interação, com nome e cargo já existentes. Sem caixa dentro de caixa. Precisa funcionar em 1440, 1024, 768 e 390. A animação de empilhamento pode dar lugar a um reveal leve, sem esconder conteúdo.
    **Não mexa no holograma nem no bloco roxo ao lado dele: a Carol pediu para manter.**
18. ~~Faixa de logos da Home~~ **Cancelado pelo dono em 04/11:** os logos ficam nas cores originais.
19. **Hero da Spectra:** título menor, sem letras grudadas, no nível do Advisory. A foto fica até a Carol enviar a definitiva.
20. **Fechamentos de Soluções e Spectra:** de terracota para Imperial com nuvens, CTA em ouro, como no Advisory.
21. **Faixa de números de Sobre nós:** números em Kepler e "Parceira" e "Finalista" como selos (legenda pequena e, para a Anthropic, a marca já existente), não como estatística. Mantenha a linha "Onde ensinamos" até o dono decidir.
22. **Unificar a marca:** Sobre nós, Soluções, Kognis e Spectra passam a Kepler, Acumin e cores de `v3-comum.md`. Só tipografia e cor: Kognis e a estrutura de Sobre nós foram aprovados pela Carol. Títulos em Kepler precisam vencer o `--font-title` de `home.module.css` no próprio título (veja `.v3 .main :is(h1, h2, h3, summary)` em `kit.module.css`). `/kognis`, `/spectra` e `/solucoes` agora podem mudar, só neste item e nos itens 19 e 20.

**Fora da segunda parte:** hero original da Home e foto do hero do Advisory, ambos por decisão do dono.

## Não fazer
- Painel lateral do Diagnóstico e linha "Onde ensinamos" em Sobre nós: esperam decisão.
- Capas de artigos do blog: isso é escrita no CMS de produção.
- Push, merge ou qualquer escrita em produção.

## Entrega
Porta 3304. A 3300 é do dono: não a derrube. Um commit por item, no seu branch, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Relatório em `docs/po/relatorios/ajustes-video-carol.md`, com antes e depois em PNG real em 1440 e 390 para cada item, e números de desempenho. Confira cabeçalho e animações conforme `motion-comum.md`, e diga o que não conferiu.
