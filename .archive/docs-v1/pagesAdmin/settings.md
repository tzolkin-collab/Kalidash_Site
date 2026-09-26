# ⚙️ Configurações e Integrações

**Objetivo:** Ajustes sensíveis, auditoria e ponte de saída de dados (Webhooks).

## 📌 Idealização e Fluxo
- **Webhooks (Outbound):** O Admin configura regras tipo "Sempre que um lead cair na coluna 'Ganho', envie um POST JSON para o HubSpot do cliente".
- **Logs de Auditoria:** Tabela de segurança rastreando "Quem fez o quê" (Ex: *Usuário X revogou a Chave Y às 14:00*).
- **Gestão de Equipe:** Adicionar vendedores, gerentes, definir quem tem permissão para ver relatórios financeiros.

## ⚠️ Problemas Antecipados & Soluções

1. **Problema: Falhas de Webhook e Bloqueio do Backend**
   - *O risco:* O sistema tenta mandar um webhook para a RD Station, mas a RD está fora do ar. Se o Go tentar enviar e ficar aguardando, pode travar recursos do nosso servidor, além do dado ser perdido.
   - *A Solução:* O envio de webhooks em Go não pode ser síncrono. Eles devem rodar em segundo plano (`Goroutines`) ou serem jogados numa fila. É obrigatório ter um mecanismo de *Retry com Backoff Exponencial* (tenta de novo em 1 min, depois 5 min, etc).

2. **Problema: Autenticação Segura no PWA**
   - *O risco:* Sessões durarem para sempre e alguém acessar o computador do admin.
   - *A Solução:* Tokens JWT de curta duração com *Refresh Tokens* invisíveis (`httpOnly cookies`) para segurança máxima contra ataques XSS no React.
