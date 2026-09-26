# 📥 Inbound: Chegada de Leads e Formulários

> Como o Kalidash ingere dados externos de forma escalável e segura. O sistema foi projetado para atuar como o "balde" central onde todos os formulários da internet desaguam.

---

## 1. As Três Portas de Entrada (Tipos de Conexão)

O Kalidash não obriga o cliente a usar um construtor de formulários próprio (embora possamos ter um no futuro). Nós integramos com os formulários que o cliente *já tem*. 

Existem 3 formas de um Lead chegar ao CRM:

### A. Via `connect.js` (O Método Universal)
É a solução "No-Code" para Landing Pages. O cliente constrói a página dele (no WordPress, Elementor, Webflow, Next.js ou HTML puro), faz um formulário nativo e cola o nosso script `<script src=".../connect.js"></script>`.
- **Como funciona:** O script fica "escutando" o formulário. Quando o usuário clica em Enviar, o script captura os dados, anula o comportamento padrão do navegador, empacota em JSON e manda para nossa API, exibindo uma mensagem de sucesso na tela.
- **Segurança:** Usa uma *Publishable API Key*. Essa chave é pública (fica no HTML), mas só tem permissão de `INSERT` de novos leads. Não consegue ler, alterar ou deletar nada no banco.

### B. Via API Direta (Server-to-Server)
Para clientes com times de desenvolvimento próprios (ex: E-commerces, SaaS).
- **Como funciona:** O servidor do cliente faz uma requisição POST direta para `https://api.kalidash.com/v1/leads`.
- **Segurança:** Requer uma *Secret API Key*. É enviada no header `Authorization: Bearer <token>`.

### C. Via Inbound Webhooks (Zapier, Typeform, Meta Ads)
Quando o cliente faz campanhas no Facebook Lead Ads ou usa Typeform, ele não tem acesso ao HTML para colar o `connect.js`.
- **Como funciona:** O Kalidash gera uma "Webhook URL" única para aquele projeto (ex: `https://api.kalidash.com/webhooks/in/proj_123xyz`). O cliente joga essa URL no Zapier ou no Gerenciador de Anúncios do Facebook, e nós recebemos o payload cru sempre que alguém preenche o cadastro.

---

## 2. O Payload (O que chega no servidor?)

Independentemente da porta de entrada, o Backend em Go normaliza tudo para um formato único e previsível. Nosso banco de dados está preparado para o fato de que "nenhum formulário é igual ao outro".

### Estrutura do JSON Recebido (Exemplo `connect.js`)

```json
{
  // Identificação do Tenant (Projeto)
  "project_id": "proj_9f8d7c", 
  
  // 1. DADOS PADRÃO (Obrigatório ter Email OU Telefone para contato)
  "name": "João da Silva",
  "email": "joao@empresa.com",
  "phone": "+5511999999999",
  
  // 2. CAMPOS FLEXÍVEIS (Qualquer input extra que o formulário tenha)
  // Tudo isso vira uma listinha bonita na Ficha do Lead no CRM.
  "extra_data": {
    "cargo": "Diretor",
    "faturamento": "Acima de 100k",
    "mensagem": "Gostaria de um orçamento para reformulação de site."
  },
  
  // 3. METADADOS E TRACKING (O script coleta sozinho invisivelmente)
  "tracking": {
    "utm_source": "google",          // "De onde ele veio?"
    "utm_medium": "cpc",             // "Por qual meio?"
    "utm_campaign": "black_friday",  // "Qual campanha?"
    "page_url": "https://agencia.com/lp-black-friday", // A página exata da conversão
    "ip_address": "177.32.44.1",
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)..."
  }
}
```

---

## 3. O Funil de Segurança no Backend (Go)

Quando os dados acima batem na nossa API, eles não vão direto para o banco. Eles passam por uma "esteira de validação" hiper-rápida (coisa de 1 a 2 milissegundos no Go):

1. **Rate Limiting (Proteção contra Bot):**
   O IP que mandou o Lead está floodando a gente? O Go barra se passar de 5 leads por minuto do mesmo IP (evita spam no CRM do cliente).
2. **Validação de API Key & Origin:**
   Se veio pelo `connect.js`, verificamos se o header `Origin` (o site de onde veio) bate com o domínio cadastrado na API Key. Isso impede que alguém copie o script do cliente e coloque num site de apostas para sujar o CRM dele.
3. **Sanitização de XSS e E-mail:**
   O Go remove qualquer tag HTML oculta nos campos (`<script>alert()</script>`) para evitar ataques de Cross-Site Scripting no painel do administrador.
4. **Criptografia AES-256:**
   Os campos `phone` e o objeto `extra_data` são criptografados antes de tocar no disco do MySQL (Camada LGPD).
5. **Deduplicação Inteligente (Opcional):**
   Se o lead `joao@empresa.com` já existe naquele projeto, o sistema não cria um card duplicado no Kanban. Ele pega o card antigo, adiciona uma nota *"Nova conversão na página XYZ"* e joga o card de volta pro topo da coluna `NEW` para alertar o vendedor.

---

## 4. Conclusão

Essa arquitetura de "Ingestão Flexível" é o que torna o Kalidash imensamente escalável. O cliente não precisa mudar de CMS ou de construtor de página; ele apenas joga os dados para nós. O Kalidash assume a complexidade do rastreamento (UTMs) e segurança, entregando um lead limpo e enriquecido na tela do vendedor.
