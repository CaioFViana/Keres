# Plano de testes do Keres

Plano usado para iniciar o planejamento de Ouroboros. Não atualizado no momento.

## Objetivo

Cobrir lógica e integração de dados sem acoplar os ambientes que o monorepo já usa:
Expo/React Native, Elysia/PostgreSQL, Vite/React e Electron.

Fora de escopo por decisão explícita: renderização das 60 telas do client e das 5 páginas do
admin. Custo alto e alta taxa de quebra por mudança visual - um teste que afirma que um
`<Text>` mostra uma string quebra a cada ajuste de layout sem nunca pegar um bug.

Os **hooks** (`src/hooks`, 21 arquivos) são a exceção deliberada: é onde mora a lógica das
telas, e o `renderHook` da React Native Testing Library os exercita sem renderizar nada. Um
bug ali afeta várias telas de uma vez.

## Sobre testar componentes React Native

A ferramenta é `@testing-library/react-native`, o que a [documentação do
Expo](https://docs.expo.dev/develop/unit-testing/) recomenda junto com o `jest-expo` que este
projeto já usa. Dois pontos que valem registro:

- `react-test-renderer` **não** é alternativa: não suporta React 19, e o client está no 19.1.0.
  A RNTL 14 usa o pacote `test-renderer` no lugar dele, e o traz como peer.
- Na RNTL 14, `renderHook` devolve uma **Promise** (assim como `rerender` e `unmount`). Sem o
  `await`, `result` vem `undefined` e todo teste falha com a mesma mensagem enganosa.
- A própria Expo desaconselha snapshot para UI e aponta E2E (Maestro) no lugar. Se um dia as
  telas precisarem de cobertura, o caminho é uma punhado de jornadas críticas ponta a ponta -
  criar história, sincronizar, resolver conflito -, não teste por tela.

## Ferramentas

| Área | Ferramenta principal | Escopo |
| --- | --- | --- |
| `packages/shared` | Vitest | Schemas, migrações de exportação, metadados e utilitários puros. |
| `apps/api` | Vitest | Utilitários, config e rotas Elysia; integração com Postgres descartável. |
| `apps/admin` | Vitest | Camada de API (axios mockado). |
| `apps/client` | Jest + `jest-expo` + RNTL | Utils, stores, services, banco de teste em `better-sqlite3` e hooks. |
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

Os pisos de todos os workspaces têm uma única fonte de verdade em
`scripts/coverage-thresholds.json`; as configurações `coverage.thresholds` (Vitest),
`coverageThreshold` (Jest) e `test-report.mjs` leem esse arquivo. `apps/api` tem dois conjuntos:
um na config unitária e outro na de integração, medidos separadamente - a unitária cobre só o
que roda sem banco, então o número dela é baixo por construção.

A regra é de **ratchet**: quando a cobertura sobe, o piso sobe junto na mesma mudança. Cada
piso mantém uma margem de 3 pontos percentuais abaixo da cobertura de referência, para absorver
flutuações pequenas. Baixar além dessa margem é uma decisão consciente, não um atalho para fazer
o CI passar - se a cobertura caiu, ou o teste que faltou não foi escrito, ou código coberto foi
removido, e as duas situações merecem ser ditas na descrição do commit.

Depois de gerar LCOV com `bun run test:report`, `bun run coverage:update` recalcula os pisos com
essa margem e **só os aumenta**. Para uma expansão intencional do escopo medido, a redução exige
o comando explícito `bun run coverage:update -- --rebaseline`; mesmo nesse modo, só diminui a
métrica cujo piso já está acima da cobertura medida, preservando as demais. Um único workspace pode ser
recalculado com `--project client` (ou `shared`, `apiUnit`, `apiIntegration`, `apiCombined`,
`admin`, `desktop`, `site`). Assim, uma queda não é silenciosamente aceita por uma execução comum.

### O que a cobertura do client mede

O `jest.config.js` precisa de `src` em `roots`, e não só `test`. Sem isso o Jest não varre
`src/`, o `collectCoverageFrom` fica sem efeito, e o relatório mede apenas os arquivos que
algum teste já importa - uma métrica que se autoconfirma. Foi assim por um tempo aqui: 136 dos
377 arquivos, mostrando 42% onde o número real era 15%.

`testMatch` ficou ancorado em `test/` justamente porque `roots` passou a incluir `src`; um glob
solto sairia procurando teste dentro do código de produção.

Os workspaces em Vitest não têm esse problema - o provider v8 já inclui os arquivos não
tocados, e é por isso que schemas e páginas sem teste aparecem com 0% nos relatórios deles.

Os pisos só valem se a suíte rodar com cobertura, e é por isso que o CI usa
`bun run test:coverage` e `test:integration:coverage` no lugar dos comandos sem cobertura.

## Regras

- O comando raiz deve executar todas as suítes sem iniciar servidores de desenvolvimento.
- Testes de API nunca usam o banco de desenvolvimento.
- Módulos nativos Expo e Electron são mockados em testes unitários.
- Um formato de teste novo deve entrar no CI antes de se tornar obrigatório para releases.
