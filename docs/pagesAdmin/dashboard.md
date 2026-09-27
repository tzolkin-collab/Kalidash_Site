# 📊 Dashboard & Inbound

**Objetivo:** Oferecer uma visão geral da operação em tempo real, mostrando o volume de captura de leads e a saúde das conversões.

## 📌 Lógica da Página
Hoje o dashboard calcula tudo no navegador a partir de `/api/leads` (as oportunidades reais):

- **Oportunidades abertas** e **valor em aberto**: tudo que não está em Ganho.
- **Valor ganho** e **ticket médio**: soma e média das oportunidades em Ganho.
- **Taxa de conversão**: ganhas sobre o total.
- **Funil por etapa**: quantidade e valor de Entrada, Qualificação e Ganho.
- **Maiores oportunidades abertas**: as cinco de maior valor.

Quando a API devolver totais por etapa e por período (fase 1 do plano), os números passam a vir prontos do servidor. Leads por origem, tarefas atrasadas e gráficos por período entram com as fases 3 e 4.

## 🧩 Requisitos
- 
