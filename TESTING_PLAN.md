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
bun run test:report       # tabela agregada: suítes, testes e cobertura de tudo
bun run test              # todas as suítes unitárias, sem infra
bun run test:integration  # suítes que exigem o Postgres descartável
bun run test:all          # os dois acima
bun run test:coverage     # só as unitárias, com relatório de cobertura
```

`test:report` inclui a integração da API como linha própria. Sem o banco de pé, aquela linha
aparece como indisponível e o relatório continua válido para o resto - falta de infra não é
falha de código.

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
6. Unidades com test doubles: `createEntityStore` (a fábrica das 17 stores de entidade), a
   camada de API do admin, os 10 canais IPC do desktop com Electron mockado, o `apiClient` do
   client (cache de token por servidor, interceptors e refresh no 401) e `storyTypeConversion`.

7. Integração da API contra o Postgres descartável: helpers de banco e de aplicação, e suítes
   de rota para auth, user, story (export/import), sync, story permissions e admin - cada
   rota protegida com o seu caso de 401 e, no painel, de 403.

8. Banco de teste do client em `better-sqlite3` (`test/helpers/testDb.ts`), aplicando as
   migrações de produção sem cópia, e as suítes sobre ele: `OperationLogService`, `syncUtils`
   (numeração do log de operações e a guarda de história somente-leitura), os handlers de sync
   que aplicam o pull no banco local, e `EntityService`.
9. Ciclo de sincronização do `SyncEngineService` contra o banco de teste: pull incremental,
   avanço do cursor, push do que está pendente e o que fica de fora dele.

   A instância do Axios é privada, mas isso não exige mock de módulo nem mudança de desenho: o
   Axios resolve o adapter na hora da requisição e cai em `axios.defaults.adapter` quando a
   instância não tem um próprio, e `createKeresAxiosInstance()` nunca define um. Basta o teste
   atribuir `axios.defaults.adapter` - vale inclusive para o singleton já construído, e os
   interceptors continuam rodando.
10. Rotas de friend (todo o ciclo de amizade e bloqueio) e de media (canal binário da galeria,
    incluindo a checagem de que a história referencia o hash pedido). O upload usa
    `test/helpers/bunShim.ts`, que supre as APIs do Bun que a camada de mídia usa e que não
    existem em Node.
11. `BaseSyncEntityHandler` contra banco real: controle de concorrência otimista, conflito de
    entidade excluída no servidor, `operationTime`, soft delete idempotente, e as consultas
    que alimentam o limite de plano e a tela de recuperação do admin.
12. `StoryExportImportService`: remapeamento de ids (e a preservação deles no envio de uma
    história local), reinício de versão e posse, recusa de pacote de formato futuro ou com
    referência pendurada, e atomicidade - um import que falha no meio não deixa nada para trás.

13. Lógica pura restante do client, fechando a varredura: os dois geradores de SVG que faltavam,
    `customAttributeFieldMetadata`, `documentTitle` e as tabelas de ícones.

14. Stores avulsas e o resto da camada de credenciais e conflitos do client: `appAlert`,
    `connectivity`, `notification`, `syncConflict`, `userSettings`, `resetAllClientStores`,
    `AuthTokenManager`, `TokenVault`, `SyncConflictService` e `favoriteBehaviorUtils`.

15. `MediaSyncService`: a reconciliação de mídia, incluindo a deduplicação por hash, os dois
    caminhos de download (disco no nativo, Axios na web) e a regra de nunca deixar uma falha
    de transferência derrubar o ciclo.

16. `downloadAndImportStory` e `uploadNewStoryToServer`: a transferência de uma história
    inteira entre aparelho e servidor, incluindo a preservação do id local e a migração da
    identidade de favoritos e comentários para a conta do servidor.

17. Limiares de cobertura em cada workspace, calibrados nos valores medidos, com o CI rodando
    as suítes *com* cobertura para que os pisos sejam de fato aplicados.

O roteiro está concluído. O que ficou deliberadamente fora de escopo continua fora: a
renderização das telas e componentes React Native e das páginas do admin.

## Limiares de cobertura

Cada workspace tem um piso em `coverage.thresholds` (Vitest) ou `coverageThreshold` (Jest),
fixado um pouco abaixo do valor medido para absorver flutuação. `apps/api` tem dois conjuntos:
um na config unitária e outro na de integração, medidos separadamente - a unitária cobre só o
que roda sem banco, então o número dela é baixo por construção.

A regra é de **ratchet**: quando a cobertura sobe, o piso sobe junto na mesma mudança. Baixar
um piso é uma decisão consciente, não um atalho para fazer o CI passar - se a cobertura caiu,
ou o teste que faltou não foi escrito, ou código coberto foi removido, e as duas situações
merecem ser ditas na descrição do commit.

Os pisos só valem se a suíte rodar com cobertura, e é por isso que o CI usa
`bun run test:coverage` e `test:integration:coverage` no lugar dos comandos sem cobertura.

## Regras

- O comando raiz deve executar todas as suítes sem iniciar servidores de desenvolvimento.
- Testes de API nunca usam o banco de desenvolvimento.
- Módulos nativos Expo e Electron são mockados em testes unitários.
- Um formato de teste novo deve entrar no CI antes de se tornar obrigatório para releases.
