# WP3b — Núcleo unificado no CRM v2 (relatório em andamento)

> Atualizado a cada item concluído. Legenda: ✅ feito e comprovado · ⚠️ parcial · ❌ não feito · ⏳ ainda não começou.
> Banco descartável apenas (MySQL em memória, fora do repositório). Nunca o `apps/api/.env`, nunca a API da 8080.

## (a) Checklist

| Item | Estado | Evidência |
|---|---|---|
| **D6** `POST /api/public/leads` cria Lead v2 com `CRM_API=1`; sem a flag segue o caminho antigo | ✅ | `leadSaver` (`public_leads.go`) despacha por `crmEnabled()`. `TestLeadSaverEscolhePeloFlag` (sem flag → caminho antigo, com flag → v2) e `TestHandlePublicLeadChamaODestino` (sem banco). `TestIntegrationCapturaV2` em MySQL em memória: lead na etapa `LEAD` do 1º funil, `origin=INBOUND`, fonte "Site — home", mensagem com WhatsApp e desafio, 2 envios do mesmo e-mail = 1 pessoa + 2 leads + 2 linhas `create` no histórico, **0 Oportunidades**; sem funil com etapa Lead → erro e nada gravado; `PUBLIC_LEAD_PIPELINE_ID/STAGE_ID/SOURCE` fixam o destino. Mesma gravação do `connect.js` (`IngestLead`, sem contadores de projeto). Validação, honeypot, `Origin`, 5/min por IP e corpo de 8 KB intactos |
| **D6** plano para os leads que já entraram como Oportunidade INBOUND (proposta ao PO, nada executado) | ⚠️ | Proposta abaixo, §(g). Depende de decisão do PO |
| **D10** contato, empresa e responsável da oportunidade ligados ao CRM v2 e à equipe; ficha edita os vínculos | ⏳ | |
| **D9** ficha edita prioridade e tags | ⏳ | |
| **D4** "responsável" = referência à equipe; escopos `leads:own`/`opportunities:own`; Vendedor vê só o que é dele | ⏳ | |
| Dashboard com leads, tarefas e origem reais | ⏳ | |
| Aviso de exemplo some das telas reais com as flags ligadas | ⏳ | |
| Testes, build, navegador, docs | ⏳ | |

## (g) Proposta ao PO — leads que já entraram como Oportunidade INBOUND

Hoje o formulário da Home só cria `Opportunity` em `INBOUND` + `Contact` + `Note`. Duas saídas:

1. **Conviver (recomendada).** Nada é migrado. Esses registros continuam como oportunidades e o funil de leads só recebe os novos. Zero risco no dado; custo: 2 lugares para olhar até as antigas fecharem ou serem descartadas.
2. **Converter, em lote e com backup.** Script único (a ser escrito e rodado pelo Gustavo, nunca por worker): para cada `Opportunity` com `stage='INBOUND'` sem tarefa ou nota além da automática, criar um `Lead` (mesma pessoa via `contactId`, mensagem copiada da `Note`, tags e `createdAt` preservados, fonte "Site — site") e arquivar/remover a oportunidade. Só vale para as que ainda estão em `INBOUND`; as que andaram de etapa ficam.

**Decisão pedida:** conviver (1) ou converter (2)? Se (2), confirmar o funil/etapa de destino (`PUBLIC_LEAD_PIPELINE_ID/STAGE_ID`). Enquanto isso o `NEXT_PUBLIC_LEAD_ENDPOINT` pode ser ligado sem risco de duplicidade, porque o destino é definido pela flag `CRM_API` na API.

## (b) Arquivos · (c) Commits · (d) Ficou de fora · (e) Riscos · (f) O que o Gustavo precisa fazer

⏳ Preenchidos ao final.
