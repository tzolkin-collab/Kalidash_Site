# 🛠 Projetos, Snippets e API Keys

**Objetivo:** Central de comando técnica para gerenciar integrações.

*(Atualizado com riscos e vulnerabilidades)*

## ⚠️ Problemas Antecipados & Soluções

1. **Problema: Chave Exposta no Frontend (O Dilema do Snippet)**
   - *O risco:* O snippet `connect.js` é um script front-end (HTML). Se a chave da API estiver no HTML, qualquer um inspecionando o código pode vê-la.
   - *A Solução:* A chave colocada no snippet **NÃO** pode ser uma "Secret Key". Deve ser uma "Publishable Key" (Chave Pública) com um escopo rigidamente bloqueado apenas para escrita (inserir leads). Ela não tem poder de deletar ou ler dados do banco.
   
2. **Problema: Spoofing (Forjar a origem do site)**
   - *O risco:* O Go valida a origem da requisição (`Origin` header). Porém, hackers podem usar scripts/Postman para forjar o cabeçalho `Origin` e flodar a API de lixo simulando que vem do site verdadeiro.
   - *A Solução:* A barreira CORS protege usuários comuns no navegador, mas para proteger o backend de fato, implementaremos *Rate Limiting* (Limite por IP, ex: 5 leads por minuto) e integração com reCAPTCHA invisível/Cloudflare Turnstile no snippet nativo.
