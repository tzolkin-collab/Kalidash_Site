# 🖼️ Upload de imagem do blog: configurar o Cloudflare R2

> **Status (05/10/2026):** o código do upload está pronto, endurecido e testado contra um servidor S3 falso (com a assinatura real do SDK). **Falta só você criar o bucket e colocar as variáveis na API** — não foi testado contra o R2 de verdade porque não há credenciais neste ambiente.

## O que a rota faz (`POST /api/blog/upload`)

- Aceita **JPEG, PNG, GIF e WebP**, conferidos pelo **conteúdo** (não pelo cabeçalho). **SVG é recusado** (carrega script). Resposta 415 para o resto.
- Limite de **8 MB** na entrada e de **40 megapixels** (barra a "bomba de descompressão": um PNG pequeno que declara 30000×30000 e consumiria gigabytes ao abrir). Resposta 413.
- **Redimensiona** para no máximo 2000 px de largura, **aplica a orientação EXIF** (foto de celular "em pé" sai em pé) e recomprime: JPEG em qualidade 85; **PNG com transparência continua PNG**; PNG opaco vira JPEG (bem menor); **GIF e WebP sobem como vieram** (o GIF pode ser animado).
- Nome do arquivo gerado pelo servidor (`blog/<tempo>-<aleatório>.<ext>`), com `Cache-Control: public, max-age=31536000, immutable` (o nome nunca se repete).
- **30 envios por minuto por IP** (429 acima disso).
- Sem as variáveis do R2, a rota responde **503** e o resto da API funciona normal.
- **Sem login** por enquanto, como o resto da API: fica para a fase de segurança (qualquer um que alcance a API poderia gravar no bucket, dentro do limite por IP).

No admin, o arquivo é conferido antes de enviar (tipo e 8 MB), e erros aparecem na caixa de notificações (editor do artigo, cartões de artigo) ou no próprio diálogo da capa.

## Passo a passo

1. **Criar o bucket.** Cloudflare → R2 → *Create bucket* (sugestão: `kalidash-blog`).
2. **Criar o token da API.** R2 → *Manage API Tokens* → *Create API token* → permissão **Object Read & Write**, **restrita a esse bucket**. Anote o **Access Key ID** e o **Secret Access Key** (o segredo só aparece uma vez) e o **Account ID** (painel do R2).
3. **Liberar a leitura pública.** No bucket → *Settings* → **Custom Domains** (recomendado, ex.: `cdn.seudominio.com.br`, com cache da Cloudflare) **ou** *R2.dev subdomain* (serve para testar; tem limite de taxa e não é para produção).
4. **Variáveis da API** (EasyPanel → serviço da API → Environment; nunca no repositório):

```
R2_ACCOUNT_ID=<id da conta>
R2_ACCESS_KEY_ID=<access key>
R2_SECRET_ACCESS_KEY=<secret>
R2_BUCKET=kalidash-blog
R2_PUBLIC_URL=https://cdn.seudominio.com.br
```

   `R2_PUBLIC_URL` sem barra no final: é o prefixo da URL que fica salva no artigo. Reinicie a API; no log deve aparecer **"✅ Cloudflare R2 configurado"**.
5. **CORS do bucket: não precisa.** O envio é feito pela API (servidor para servidor); o navegador só **lê** a imagem, por `<img>`, que não exige CORS. O site renderiza as capas com `<img>` simples, então também não precisa configurar `next/image`.

## Verificar (depois de configurar)

1. No admin, abra um artigo → capa → envie uma foto. A imagem deve aparecer na hora.
2. Abra a URL da imagem em uma aba anônima (deve carregar sem login).
3. Confira no painel do R2 que o objeto está em `blog/` e tem uns poucos MB no máximo.
4. Envie um PNG com fundo transparente: no site ele não pode ganhar fundo preto.
5. Envie um SVG: o admin deve recusar com a mensagem de formato.
6. Se algo falhar, o log da API mostra `Erro ao subir pro R2: …` (credencial errada, bucket com outro nome ou token sem permissão de escrita aparecem aí; a tela mostra só "não foi possível subir a imagem pro storage").

## Como testar o código

`go test .` roda os testes do upload (`apps/api/storage_test.go`): tipos por conteúdo, EXIF, transparência, GIF intacto, bomba de descompressão e o handler completo contra um S3 falso local (variável `R2_ENDPOINT` aponta o SDK para ele). Para apontar a API para um MinIO local em vez do R2, defina `R2_ENDPOINT`.

## O que falta

- Rodar uma vez contra o R2 real (os passos acima).
- Proteger a rota com login e permissão (fase de segurança).
- Limpar imagens órfãs (um artigo trocou a capa, a imagem antiga continua no bucket).
