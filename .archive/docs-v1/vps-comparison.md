# 🖥️ Comparativo de VPS — Prós, Contras e Recomendação

Contexto: Precisamos rodar **Go API + MySQL** numa VPS. O Go consome ~10MB de RAM
e o MySQL ~200MB. Qualquer máquina com 1GB+ de RAM atende com folga.

---

## Hetzner (Alemanha/Finlândia/EUA)

**Plano relevante:** CX22 — 2 vCPU, 2GB RAM, 20GB SSD — **€3,79/mês**

| Prós | Contras |
|---|---|
| Melhor custo-benefício do mercado disparado | Painel simples, sem "mimos" visuais |
| Datacenters na Europa E nos EUA (Ashburn/Hillsboro) | Sem datacenter no Brasil (latência ~120ms de SP) |
| Rede de 20TB de tráfego incluso (absurdamente generoso) | Suporte apenas em inglês |
| Performance consistente (CPU dedicada real nos planos maiores) | Sem marketplace de apps 1-clique tão rico quanto DO |
| Backups automáticos por +20% do preço (~€0,76/mês) | — |
| API robusta para automação de infra | — |

**Veredicto:** ⭐ **Recomendado.** É o que startups europeias e brasileiras "enxutas" usam.
O preço é imbatível e a performance é honesta. A latência para o Brasil (se o público
for BR) pode ser contornada com CDN no frontend (Vercel já faz isso).

---

## DigitalOcean (EUA/Europa/Ásia)

**Plano relevante:** Basic Droplet — 1 vCPU, 1GB RAM, 25GB SSD — **$6/mês**

| Prós | Contras |
|---|---|
| Documentação e tutoriais INSUPERÁVEIS (melhor da indústria) | Mais caro que Hetzner pelo mesmo hardware |
| Marketplace com 1-Click Apps (MySQL, Docker, etc.) | 1GB RAM no plano básico é mais apertado |
| Painel bonito, intuitivo, amigável para iniciantes | CPU compartilhada (pode ter "noisy neighbor") |
| Comunidade enorme (qualquer erro tem tutorial pronto) | Sem datacenter no Brasil |
| Managed Database disponível (MySQL gerenciado por +$15/mês) | Tráfego limitado a 1TB (vs 20TB da Hetzner) |
| Datacenter em NYC (boa latência para BR, ~110ms) | — |

**Veredicto:** Excelente se você valoriza **facilidade de aprendizado** e documentação.
É mais caro, mas a experiência de "primeira VPS" é a melhor que existe.

---

## Contabo (Alemanha)

**Plano relevante:** Cloud VPS S — 4 vCPU, 4GB RAM, 50GB SSD — **€4,50/mês**

| Prós | Contras |
|---|---|
| Specs absurdas pelo preço (4GB RAM por €4,50?!) | Performance de disco é notoriamente LENTA |
| Muito hardware por pouco dinheiro | Suporte é famoso por ser ruim e demorado |
| Bom para quem precisa de muita RAM barata | Rede pode ter picos de latência e instabilidade |
| — | Painel antigo e pouco intuitivo |
| — | Uptime não é tão confiável quanto Hetzner/DO |
| — | Overselling: vendem mais recursos do que têm |

**Veredicto:** ⚠️ **Parece bom demais pra ser verdade — e é.** Os specs no papel são
incríveis, mas na prática o disco é lento, o suporte é ruim e a rede não é confiável.
Para uma API que precisa responder em <5ms, não recomendo.

---

## Vultr (EUA/Europa/Ásia/Brasil 🇧🇷)

**Plano relevante:** Cloud Compute — 1 vCPU, 1GB RAM, 25GB SSD — **$5/mês**

| Prós | Contras |
|---|---|
| **TEM DATACENTER EM SÃO PAULO** (latência ~5-15ms para BR!) | Menos documentação/tutoriais que a DigitalOcean |
| Performance de rede excelente (NVMe SSD) | Painel funcional mas menos polido que DO |
| API completa e bem documentada | Plano de 1GB pode ficar apertado com MySQL |
| Faturamento por hora (paga só o que usar) | Comunidade menor |
| Snapshots gratuitos | — |

**Veredicto:** ⭐ **Melhor opção se o público-alvo for brasileiro.** A latência de 5ms
de São Paulo é INCOMPARÁVEL com os 120ms da Hetzner. Para uma API de ingestão
de leads onde cada milissegundo conta, isso faz diferença real.

---

## Oracle Cloud (Free Tier)

**Plano relevante:** Always Free — 1 vCPU (AMD), 1GB RAM — **$0/mês (grátis para sempre)**

| Prós | Contras |
|---|---|
| É GRÁTIS. Para sempre. Não é trial. | Processo de cadastro rejeita muita gente |
| Inclui 2 instâncias Always Free | Se a conta for marcada como "idle", podem reciclar |
| Tem datacenter em Vinhedo/SP 🇧🇷 | Performance inferior (é grátis, né) |
| 10TB de tráfego de saída/mês (generosíssimo) | Painel (OCI Console) é confuso e burocrático |
| — | Comunidade pequena, difícil achar tutoriais |
| — | Risco de indisponibilidade (não tem SLA no free) |

**Veredicto:** Imbatível para **ambiente de testes e staging**. Para produção,
o risco de reciclagem da instância e a falta de SLA são preocupantes.
Mas se o orçamento é literalmente zero, é uma opção real.

---

## Tabela Resumo Final

| Provedor | RAM | CPU | Disco | Preço | Datacenter BR | Nota |
|---|---|---|---|---|---|---|
| **Hetzner** | 2GB | 2 vCPU | 20GB | €3,79 | ❌ | ⭐ Melhor custo-benefício geral |
| **Vultr** | 1GB | 1 vCPU | 25GB | $5,00 | ✅ São Paulo | ⭐ Melhor para público BR |
| **DigitalOcean** | 1GB | 1 vCPU | 25GB | $6,00 | ❌ | Melhor documentação/UX |
| **Contabo** | 4GB | 4 vCPU | 50GB | €4,50 | ❌ | ⚠️ Specs altos mas qualidade baixa |
| **Oracle** | 1GB | 1 vCPU | — | $0,00 | ✅ Vinhedo/SP | Grátis mas instável para produção |

---

## Recomendação para o Kalidash

**Se o público principal é brasileiro:**
> **Vultr São Paulo ($5/mês)** — Latência imbatível de ~5ms.
> O lead chega da landing page ao banco em tempo real, literalmente.

**Se o público é misto ou internacional:**
> **Hetzner Ashburn (€3,79/mês)** — Custo mais baixo com performance sólida.
> O frontend na Vercel (CDN global) compensa a latência do backend.

**Para staging/testes:**
> **Oracle Cloud Free Tier ($0)** — Perfeito para rodar um ambiente
> de homologação sem custo nenhum.
