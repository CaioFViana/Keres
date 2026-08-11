# Plano de testes do Keres

## Objetivo

Cobrir lógica e integração de dados sem acoplar os ambientes que o monorepo já usa:
Expo/React Native, Elysia/PostgreSQL, Vite/React e Electron.

Fora de escopo por decisão explícita: renderização das telas e componentes React Native e das
páginas do admin. Custo alto e alta taxa de quebra por mudança visual; nada de Testing Library
por enquanto.

## Ferramentas

| Área | Ferramenta principal | Escopo |
| --- | --- | --- |
| `packages/shared` | Vitest | Schemas, migrações de exportação, metadados e utilitários puros. |
| `apps/api` | Vitest | Utilitários, config e rotas Elysia; integração com Postgres descartável. |
| `apps/admin` | Vitest | Camada de API (axios mockado). |
| `apps/client` | Jest + `jest-expo` | Utils puros, stores zustand e services sem SQLite. |
| `apps/desktop` | Vitest | Utilitários e IPC, com Electron mockado. |

O client fica em Jest de propósito: `jest-expo` é o preset oficial do SDK 54 e entrega o
`transformIgnorePatterns` do código Flow/TS não transpilado do `react-native`, além dos mocks
de todos os módulos nativos `expo-*`. Vitest não tem preset oficial de Expo/RN.

## Convenções

- Todo teste vive em `<workspace>/test/`, espelhando a estrutura de `src/`.
- Testes que exigem infra externa terminam em `*.integration.test.ts` e ficam fora do comando
  padrão; rodam por `bun run test:integration`.

## Comandos

```bash
bun run test              # todas as suítes unitárias, sem infra
bun run test:coverage     # o mesmo, com relatório de cobertura
bun run test:integration  # suítes que exigem o Postgres descartável
bun run test:all          # os dois acima
```

Para as de integração, suba o banco antes:

```bash
docker compose -f apps/api/docker-compose.test.yml up -d
```

## Estado atual

Concluído:

1. Separação, na API, da criação da aplicação (`createApp()`) dos efeitos de bootstrap.
2. Vitest configurado nos quatro workspaces, Jest Expo no client, layout de `test/`
   padronizado e cobertura ligada em todos.
3. Separação entre suítes unitárias e de integração, com `docker-compose.test.yml` e um job
   próprio no CI.
4. `ci.yml` rodando typecheck, lint e testes em todo push e PR; `release.yml` também roda os
   testes antes de publicar.
5. Varredura de lógica pura: utils do client, schemas/metadados do shared, utils e config da
   API, resolução de caminhos do desktop.

Pendente:

6. Restante da lógica pura do client: `storyGraphSvg`, `locationGraphSvg`,
   `customAttributeFieldMetadata`, `documentTitle`, `entityTypeIcons`, `commentCriticality`.
7. Unidades com test doubles: stores zustand e services sem SQLite no client, camada de API
   completa do admin, handlers IPC do desktop com Electron mockado.
8. Integração da API contra o Postgres descartável: helpers de banco/app, suítes de rota
   (incluindo 401/403 em toda rota protegida) e de serviço (`SyncService`,
   `StoryExportImportService`, `FriendshipService`, `BaseSyncEntityHandler`).
9. Motor de sync do client (`SyncEngineService`, `MediaSyncService`, `EntityService`) sobre um
   banco de teste em `better-sqlite3`.
10. Limiares de cobertura, calibrados no valor medido depois do item 8 e subidos por ratchet.

## Regras

- O comando raiz deve executar todas as suítes sem iniciar servidores de desenvolvimento.
- Testes de API nunca usam o banco de desenvolvimento.
- Módulos nativos Expo e Electron são mockados em testes unitários.
- Um formato de teste novo deve entrar no CI antes de se tornar obrigatório para releases.
