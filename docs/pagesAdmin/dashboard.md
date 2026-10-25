# 📊 Dashboard & Inbound

**Objetivo:** Oferecer uma visão geral da operação em tempo real, mostrando o volume de captura de leads e a saúde das conversões.

## 📌 Lógica da Página
Hoje o dashboard calcula tudo no navegador a partir de `/api/leads` (as oportunidades reais):

- **Período:** botões Este mês (padrão), Últimos 30 dias, Últimos 90 dias, Este ano e Tudo. Vale para valor ganho e ticket médio, pela **data em que a oportunidade foi para Ganho**.
- **Oportunidades abertas** e **valor em aberto**: tudo que está em etapa aberta (leads, ganhas e perdidas ficam de fora).
- **Previsão ponderada**: valor de cada aberta × probabilidade da etapa. Etapa sem probabilidade fica fora (o cartão avisa quantas).
- **Valor ganho** e **ticket médio**: soma e média das oportunidades ganhas no período. Ganha sem data de fechamento só aparece em "Tudo" (a tela avisa).
- **Taxa de conversão**: ganhas sobre o total.
- **Funil por etapa**: quantidade e valor das etapas do primeiro funil ativo (sem as perdidas).
- **Maiores oportunidades abertas**: as cinco de maior valor.

Quando a API devolver totais por etapa e por período (fase 1 do plano), os números passam a vir prontos do servidor. 
**Leads, origem e tarefas (WP3b, 24/10):** abaixo das métricas de oportunidade, duas seções que só mostram número com dado real (com os exemplos a seção explica o que falta ligar):
- **Leads e origem** (`CRM_API=1`): leads ativos (e quantos ainda não foram abertos), novos no período, aguardando contato (ativos sem primeiro contato), qualificados (com descartados e taxa de qualificação) e a **origem por fonte** (inbound por fonte; outbound por quem trouxe; as menores viram "Outras").
- **Tarefas** (`WORKFLOW_API=1`): abertas, atrasadas, a vencer em 7 dias, concluídas no período, e a lista das cinco mais atrasadas.
Contas em `lib/dashboardMetrics.ts` (puro, `tests/dashboardMetrics.test.ts`). O Vendedor vê as métricas de leads e oportunidades **só do que é dele** (o servidor já filtra); as tarefas ainda não são filtradas por responsável. Gráficos por período seguem sem existir.

**Galeria de demonstração (18/10):** os 13+ modelos de gráfico (Recharts) com números inventados ficam em `#/dashboard/demonstracao` (`pages/DashboardDemo.tsx`), com aviso de exemplo e um link discreto no rodapé do Dashboard. Nunca aparecem junto das métricas reais.

## 🧩 Requisitos
- O Dashboard só mostra dado da API; o que for demonstração fica na rota própria acima.
