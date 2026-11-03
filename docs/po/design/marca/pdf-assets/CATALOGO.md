# Assets extraídos do Brand guide (Brand guide_novo (1).pdf)

Extraídos com `extract.cjs` (JPEG original do PDF, sem recompressão). `indice.png` é a folha de contato antiga (antes de organizar em pastas). Nada aqui está em `apps/site/public`, exceto os três marcados "no site". Uso no site depende de OK do PO/dono (banco de imagens é decisão do dono).

Limite: os recortes (bustos com fundo preto) perderam a máscara de transparência do PDF (ficaram só com o fundo preto). Funcionam sobre preto/Imperial escuro; sobre claro precisam de nova máscara.

## 1. Cultura clássica: pinturas (repertório, "pensamento")
| Arquivo | Uso recomendado |
|---|---|
| `pinturas/escola-de-atenas-3628x2721.jpg` | Hero/painel largo de Advisory (comitê, conselho, governança). Versão grande |
| `pinturas/escola-de-atenas-1448x1086.jpg` | Mesma imagem, **no site** (hero da Advisory, em arco) |
| `pinturas/criacao-de-adao-1448x1086.jpg` | Sobre nós (tese "inteligência humana"), AI Culture (transmissão de conhecimento) |
| `pinturas/mona-lisa-1122x1402.jpg` | Retrato vertical: Sobre nós, citações |
| `pinturas/homem-vitruviano-1024x1535.jpg` | Método, estrutura, "geometria = método": Execução/AI Culture |

## 2. Esculturas e pensadores
| Arquivo | Uso recomendado |
|---|---|
| `esculturas/socrates-pedestal-fundo-bege.jpg` | Fundo bege combina com Limestone: manifesto/citação em seção clara (**no site**, Advisory) |
| `esculturas/busto-perfil-geometria-recorte-fundo-preto.jpg` | Só sobre fundo escuro; já traz linha dourada de geometria |
| `esculturas/busto-fragmentado-circuitos-recorte-fundo-preto.jpg` | Só sobre fundo escuro; corpo inteiro, mais "IA" |
| `esculturas/cabeca-feminina-geometria-fundo-roxo.jpg` | Peça pronta sobre Imperial (texto sobreposto no PDF) |
| `esculturas/mao-blocos-geometricos-fundo-roxo.jpg` | Peça pronta ("Automação sem estratégia só acelera o caos") |
| `esculturas/marco-aurelio-glitch-peca-com-texto.jpg` | Tem texto embutido ("marcus aurelius"): **não usar** em página; é peça de rede social |

## 3. Atmosfera / textura
| Arquivo | Uso |
|---|---|
| `atmosfera/nuvens-douradas-2305x4096.jpg` | Fundo de fecho/capa em escuro (usado na capa do guide) (**no site**, fecho da Advisory) |
| `atmosfera/arcos-sepia-2758x4096.jpg` | Capa da seção "O logotipo" no guide; fundo de seção ou arco sobre claro |

## 4. Aplicações / mockups (referência, não vão ao site)
`aplicacoes/mockup-cartao-de-visita.jpg`, `mockup-linkedin-perfil.jpg`, `mockup-linkedin-banner-busto.jpg`, `mockup-outdoor-predio-em-branco.jpg` (outdoor sem arte). Servem de referência visual de como a marca aplica estátua + roxo + dourado + serifa.

## 5. Pessoas
`pessoas/retrato-socio-a-fundo-escuro.jpg`, `retrato-socio-b-fundo-preto.jpg` (640x960): fotos dos sócios, baixa resolução para hero; úteis em bloco "Quem somos" pequeno.

## 6. Logos
`logos/logo-branco-fundo-preto.jpg` (sem alfa), `logo-preto-fundo-transparente-perde-alfa.jpg` (alfa perdido), `fundo-roxo-vazio.jpg`. **Usar os SVG de `apps/site/public/brand/`**, não estes.

## 7. Evitar (contradizem o próprio guia: "a IA não é protagonista", sem hype)
`evitar/astronauta-roxo-ia-generica.jpg` (IA genérica), `evitar/blob-roxo-borrado.jpg`, `evitar/escola-de-atenas-inclinada-borrada.jpg` (mockup borrado).

## Falta extrair
Ícones de linha (rede, lupa, lista, livro, hierarquia, engrenagem, barras, escada, setas) e a greca/chevron: são vetores no PDF, não imagens. A greca já existe em `public/home/pattern-greek.png`.
