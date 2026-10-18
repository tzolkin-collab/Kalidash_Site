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

Quando a API devolver totais por etapa e por período (fase 1 do plano), os números passam a vir prontos do servidor. Leads por origem, tarefas atrasadas e gráficos por período ainda não existem (previstos no WP3).

**Galeria de demonstração (18/10):** os 13+ modelos de gráfico (Recharts) com números inventados ficam em `#/dashboard/demonstracao` (`pages/DashboardDemo.tsx`), com aviso de exemplo e um link discreto no rodapé do Dashboard. Nunca aparecem junto das métricas reais.

## 🧩 Requisitos
- O Dashboard só mostra dado da API; o que for demonstração fica na rota própria acima.
