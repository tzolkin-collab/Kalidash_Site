# 📥 Inbound: Chegada de Leads e Formulários

> **v2 (26/09/2026).** Segue a [definição de domínio](./dominio.md): cada envio cria um **Lead** na pipeline cuja **fonte** é aquele formulário (e não uma oportunidade), e o documento (CPF/CNPJ) é um campo explícito.

Como o Kalidash recebe os leads das LPs e dos formulários que a própria Kalidash lança, de forma segura e sempre no mesmo formato.

---

## 1. Fonte, pipeline e "Conectar fonte"

Um lead só entra por uma **fonte** ligada a uma **pipeline** (o funil de uma oferta).

- Uma pipeline tem **várias fontes**. Um formulário alimenta **uma** pipeline (cada envio tem um destino certo).
- **Conectar fonte** é um assistente simples, no painel "Configurações das pipelines": escolher o formulário, mapear os campos, dizer o que fazer com cada envio (criar ou atualizar a pessoa, criar a empresa se houver CNPJ, criar o lead em qual coluna, dono, tags). Ao salvar, cria uma **automação gerenciada** que aparece na página Automações, categoria "Fontes". Quem edita no assistente ou lá altera o mesmo registro.
- Sem fonte, a pipeline avisa e gera a tarefa "Definir fonte da pipeline". O outbound entra pela fonte **manual** ou por **importação**, e sempre com o **contato interno** que trouxe o lead.

## 2. As três portas de entrada

A porta define **como** o envio chega; a fonte define **para onde** ele vai.

> **Estado (WP2, 18/10/2026):** as portas A e B existem de verdade (`POST /api/connect/leads`, `GET /connect.js`), atrás de `CRM_API=1` + `AUTH_API=1`, e criam **Lead** conforme este documento, com o recorte descrito em [ARCHITECTURE.md](./ARCHITECTURE.md#connectjs-o-script-de-captura): a **fonte** vem do **projeto conectado** (a chave está ligada a um projeto, em vez de a um formulário-fonte da pipeline), pessoa por e-mail, sem empresa/CNPJ, sem `LeadSubmission` e sem automações. `POST /api/public/leads` (formulário do diagnóstico da Home) segue criando oportunidade INBOUND até o WP3 migrá-lo (decisão D6).

### A. Via `connect.js` (o método padrão)
Para LPs e sites em qualquer stack. A página tem um formulário nativo e recebe a tag de script com o token do projeto.
- O script observa o formulário indicado na config. No envio, lê os campos mapeados, coleta a atribuição (UTMs, referrer, device, `page_url`), monta o JSON e envia para a API. O markup e o CSS da página não são tocados.
- **Segurança:** chave **publicável**, só de escrita (`forms:write`; `analytics:write` é gancho). Pode ficar no HTML porque não lê, não altera e não deleta nada, e vem ligada a um projeto com `Origin` conferido. Chave de leitura nunca vai no snippet: o servidor nem a emite.
- Contrato e snippet completos em [ARCHITECTURE.md](./ARCHITECTURE.md#connectjs-o-script-de-captura).

### B. Via API direta (servidor para servidor)
Para LPs com backend próprio. O servidor da página faz um `POST` com o mesmo payload. Usa o mesmo endpoint, com `Authorization: Bearer <token>` e **sem** `Origin` (a checagem de origem só vale para navegador). Hoje a chave é a mesma do snippet (`forms:write` ligada ao projeto, ou de teste); não há chave "secreta" de escrita à parte.

### C. Via webhooks de entrada (Zapier, Typeform, Meta Lead Ads)
Quando o formulário vive numa ferramenta externa. A fonte gera uma URL de webhook única. Colada no Zapier ou no Gerenciador de Anúncios, a API recebe o payload a cada cadastro.

---

## 3. O payload

Qualquer que seja a porta, a API normaliza tudo para o mesmo formato, com os mesmos campos sempre presentes (vazios viram `null`):

```json
{
  "token": "kld_live_…",
  "form": "#form-contato",

  "lead": {
    "nome": "João da Silva",
    "email": "joao@empresa.com",
    "telefone": "+5511999999999",
    "documento": "12ABC34500016A",
    "tem_cnpj": true,
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

- A **fonte** (e, por ela, a pipeline) é identificada pelo token do formulário, não por um id no corpo.
- **`documento`** aceita CPF (11 dígitos) ou CNPJ (14 caracteres, **letras e números**, desde 31/07/2026). `tem_cnpj` marca a intenção quando o campo vem vazio.
- Campos do formulário **fora do mapa** viajam como extras e aparecem na ficha.
- Obrigatório: **nome** e ao menos um contato (e-mail ou telefone). Todo o resto é opcional.
- Com consentimento configurado, o Connect não envia sem o checkbox marcado.

---

## 4. O que a API faz com o envio

1. **Rate limiting:** o IP passou de 10 tentativas por minuto (`CONNECT_RATE_IP`) ou a chave de 60 envios (`CONNECT_RATE_TOKEN`)? `429` com `Retry-After`.
2. **Chave, escopo e origem:** o token existe, não está revogado e tem `forms:write`? O header `Origin` bate com o domínio do projeto?
3. **Sanitização** de tags HTML e validação de e-mail e documento (dígitos verificadores de CPF e do CNPJ alfanumérico).
4. **Pessoa:** procura por e-mail e por CPF (**não duplica**); se não existir, cria com ciclo de vida Lead.
5. **Empresa:**
   - **CNPJ válido:** procura por CNPJ; se não existir, cria a Empresa, e a pessoa vira stakeholder.
   - **Só o nome da empresa:** cria a Empresa **em análise**, com a tarefa "Informar CNPJ" não feita.
   - **Marcou "tenho CNPJ" e não preencheu:** a mesma tarefa.
6. **Lead:** cria na pipeline da fonte, na **primeira coluna de leads**, com origem `INBOUND`, dono conforme a atribuição e as tags do assistente. Se a pessoa já é **cliente**, o lead leva a marca "cliente retornando".
7. **Envio bruto:** grava o payload e a atribuição em `LeadSubmission`.
8. **Pendências:** aplica as regras da pipeline (campo marcado como tarefa e vazio gera a tarefa).
9. **Tempo real:** notifica o painel (WebSocket e Web Push) e dispara as automações ligadas ao evento `formulario.enviado`.
10. **Criptografia AES-256** de telefone, documento e campos extras antes do disco (planejada).

## 5. Conclusão

A "ingestão flexível" permite lançar quantas LPs e formulários a Kalidash precisar, em qualquer stack, sem mexer no CRM. Cada envio chega limpo, com origem e atribuição anexadas, cai como **lead** na pipeline certa e só vira oportunidade quando alguém qualifica.
