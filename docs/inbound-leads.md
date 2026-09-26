# 📥 Inbound: Chegada de Leads e Formulários

> Como o Kalidash recebe os leads das LPs e dos formulários que a própria Kalidash lança, de forma segura e sempre no mesmo formato. O admin é o "balde" central onde eles desaguam.

---

## 1. As Três Portas de Entrada (Tipos de Conexão)

O Kalidash não obriga a página a usar um construtor de formulários próprio. A integração é feita com o formulário que a página **já tem**.

Existem 3 formas de um lead chegar ao CRM:

### A. Via `connect.js` (o método padrão)
Para LPs e sites feitos em qualquer stack (Next.js, WordPress, Webflow, HTML puro). A página tem um formulário nativo e recebe a tag de script do Connect com o token do projeto.
- **Como funciona:** o script observa o formulário indicado na config. No envio, lê os campos mapeados, coleta a atribuição (UTMs, referrer, device, `page_url`), monta o JSON e envia para a API. O markup e o CSS da página não são tocados.
- **Segurança:** usa uma chave **pública**, com escopo só de escrita (`forms:write` e `analytics:write`). Ela pode ficar no HTML porque não lê, não altera e não deleta nada.
- Contrato e snippet completos em [ARCHITECTURE.md](./ARCHITECTURE.md#connectjs-o-script-de-captura).

### B. Via API direta (servidor para servidor)
Para LPs que têm backend próprio (por exemplo, uma rota do Next.js que recebe o formulário e repassa).
- **Como funciona:** o servidor da página faz um `POST` para a API do Kalidash com o mesmo payload do Connect.
- **Segurança:** exige uma chave **secreta** no header `Authorization: Bearer <token>`. Essa chave nunca vai para o navegador.

### C. Via webhooks de entrada (Zapier, Typeform, Meta Lead Ads)
Quando o formulário vive em uma ferramenta externa e não dá para colar o `connect.js`.
- **Como funciona:** o Kalidash gera uma URL de webhook única para o projeto conectado (ex.: `https://api…/webhooks/in/<token-do-projeto>`). Ela é colada no Zapier ou no Gerenciador de Anúncios, e a API recebe o payload sempre que alguém preenche o cadastro.

---

## 2. O Payload (o que chega no servidor)

Qualquer que seja a porta de entrada, a API normaliza tudo para o **mesmo formato**, com os mesmos campos sempre presentes (vazios viram `null`):

```json
{
  "token": "kld_live_…",
  "form": "#form-contato",

  "lead": {
    "nome": "João da Silva",
    "email": "joao@empresa.com",
    "telefone": "+5511999999999",
    "empresa": "Empresa X",
    "cargo": "Diretor",
    "interesse": "AI Culture",
    "mensagem": "Gostaria de um orçamento."
  },

  "attribution": {
    "utm_source": "google",
    "utm_medium": "cpc",
    "utm_campaign": "black_friday",
    "referrer": "https://…",
    "device": "mobile",
    "page_url": "https://lp.exemplo.com/black-friday"
  },

  "context": { "submittedAt": "2026-09-26T14:24:08Z", "consent": true }
}
```

- O **projeto conectado** é identificado pelo token, não por um `project_id` no corpo.
- Campos que existirem no formulário e estiverem **fora do mapa** viajam como extras e aparecem na Ficha do Lead.
- Obrigatório: e-mail **ou** telefone.
- Se o consentimento estiver configurado no projeto, o Connect não envia sem o checkbox marcado.

---

## 3. O Funil de Segurança no Backend (Go)

Os dados não vão direto para o banco. Passam por uma esteira de validação rápida:

1. **Rate limiting:** o IP passou de 5 leads por minuto? `429`. Evita spam no CRM.
2. **Validação da chave e do escopo:** o token existe, não está revogado e tem `forms:write`? Se veio pelo Connect, o header `Origin` bate com o domínio do projeto conectado? Isso impede que alguém copie o script e o coloque em outro site.
3. **Sanitização:** o Go remove tags HTML ocultas dos campos (`<script>…`) para evitar XSS no painel.
4. **Criptografia AES-256 (planejada):** telefone e campos extras são criptografados antes de tocar no disco.
5. **Deduplicação:** se `joao@empresa.com` já existe, o sistema não cria um card duplicado. Ele adiciona ao card existente uma nota "Nova conversão na página XYZ" e o devolve ao topo da coluna `INBOUND`, para alertar o vendedor.
6. **Registro do envio:** o payload e a atribuição ficam gravados (`LeadSubmission`) e ligados à oportunidade criada ou atualizada.

---

## 4. Conclusão

A "ingestão flexível" permite lançar quantas LPs e formulários a Kalidash precisar, em qualquer stack, sem mudar o CRM. Cada envio chega limpo, no mesmo formato, com a origem e a atribuição de campanha já anexadas, e cai como oportunidade em `INBOUND`.
