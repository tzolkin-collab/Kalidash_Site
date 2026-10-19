# WP3a — Validação em MySQL 8 e MariaDB reais

**Data:** 2026-10-18
**Status:** ❌ NÃO EXECUTADO — pré-requisito ausente.

## Evidência

- `docker --version` → `docker: command not found` (Git Bash).
- No PowerShell, `Get-Command docker` não retornou nada e `C:\Program Files\Docker\Docker\resources\bin\docker.exe` não existe.
- Também não há `podman`. Existe só o `wsl.exe` (não verifiquei se há distro com MySQL, e não instalei nada).

## Itens do checklist

| Item | Resultado |
|---|---|
| 1. docker-compose/script com MySQL 8 e MariaDB descartáveis | ❌ não feito (sem Docker) |
| 2. Suíte nos dois bancos × dois modos de DSN | ❌ não feito |
| 3. Tabela de falhas e causas | ❌ não feito |
| 4. Idempotência e migração de banco antigo | ❌ não feito |
| 5. Correções pequenas de SQL | ❌ nada alterado |

## Arquivos / commits

Nenhum código alterado, nenhum commit. Só este relatório.

## Riscos

Continua valendo: os testes de integração só rodaram no MySQL em memória (go-mysql-server). As flags não devem ser ligadas em produção antes do WP3a.

## O que o Gustavo precisa fazer

1. Instalar o Docker Desktop (com WSL2) e deixá-lo rodando; conferir com `docker --version` e `docker info`.
2. Reabrir o WP3a depois disso.
