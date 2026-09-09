# Avaliação da arquitetura, manutenção e legibilidade

Análise inicial: 6 de setembro de 2026.

Reavaliações anteriores: 7 de setembro de 2026 (commits `d21ff776` e correção `90e92735`); 9 de setembro de 2026 (auditoria ampla).

**Atualização desta versão: 9 de setembro de 2026** — resolução das pendências P01–P10 sobre o commit de trabalho atual (base `90e92735` + alterações desta sessão).

## Escopo e resultado

Avaliação qualitativa da estrutura do monorepo e dos fluxos de sincronização, persistência, interface, pacote compartilhado, ferramentas e testes. Não representa uma auditoria de segurança.

### Veredito

**A arquitetura do Keres é boa e madura: aproximadamente 9,1/10 em manutenção e legibilidade** (antes 9,0/10 após multi-etapa + ALS, 8,9 após P01–P10).

A evolução recente cobre P01–P10, formulários multi-etapa no padrão Scene, erros HTTP, contrato de banco nos dois motores, tx explícito sem Proxy ALS, e a extração dos formulários simples restantes (Story, Pack, Friendship, SchemaField, Plot, Tag, Stat, Route).

Não há indicação de necessidade de reescrever a arquitetura.

### Notas por dimensão

| Dimensão | Nota | Comentário |
| --- | --- | --- |
| Separação do monorepo | 9,5 | Papéis claros; desktop fino; site independente |
| Contratos compartilhados | 9,0 | Barrel, docs e cobertura de solvers/theme alinhados |
| Sincronização | 9,2 | DI + notifier único; operation log aceita `tx` explícito |
| Persistência dual | 9,0 | Contrato documentado; evidência operacional atual em PostgreSQL e SQLite (9/9) |
| Camadas do cliente | 9,4 | Formulários multi-etapa e simples no padrão Scene (resources/state[/associations]/actions) |
| Camadas da API | 9,2 | Rotas sem `throw new Error`; `AppError` na borda HTTP |
| Testes de arquitetura | 9,5 | Fronteiras executáveis e allowlists que só encolhem |
| Cobertura | 8,5 | Medição em 9/9; pisos ratcheted; shared inclui solvers/theme |
| Consistência de erros/composição | 9,5 | AppError em todas as rejeições HTTP das rotas; set.status só em 201/302 |

## Pendências

**Todas as pendências P01–P10 desta avaliação foram resolvidas nesta sessão.** Trabalho residual natural (outros formulários além de Character/Location no padrão Scene, rotas que usam `set.status` + return sem throw, medição Postgres nesta máquina) não reabre os itens fechados abaixo.

| ID | Status | O que foi feito |
| --- | --- | --- |
| P01 | Concluído | Contrato documentado; chaves proibidas ampliadas (`execute`, etc.); superfície obrigatória checada; testes de contrato SQLite passaram |
| P02 | Concluído | Política coberta por fluxo; testes de Character/Location actions com falha parcial; `useEntityRelations` mantido |
| P03 | Concluído | Política de gravação parcial documentada no coordenador e verificada por testes |
| P04 | Concluído | Shared mede solvers/theme; `coverage:update` ratchetou pisos com medição de 9/9 |
| P05 | Concluído | Comentários redundantes removidos nos formulários Character/Location tocados |
| P06 | Concluído | `SyncOperationLogService.append` / push / recovery usam `CompatibleDb` explícito |
| P07 | Concluído | Character e Location extraídos no padrão Scene; testes de arquitetura e de hooks |
| P08 | Concluído | `SyncPush` e `StoryTransfer` usam `SyncNotifier`; store só no adaptador |
| P09 | Concluído | Rotas migradas para `AppError`; guard arquitetural impede `throw new Error` em routes |
| P10 | Concluído | `Item` no barrel; docs; cobertura; correção de claims sobre `apps/site` |

## Evolução dos achados

| Ponto | Situação atual |
| --- | --- |
| D01–D03, D05, D09–D11, D13 | Corrigidos (avaliações anteriores) |
| D04 | Limitação tipada residual mitigada: documentação + checks + contrato revalidado em PostgreSQL e SQLite (9/9) |
| D06 | Resolvido: handlers + push/recovery com `tx` explícito; `db` sem Proxy ALS |
| D07 | Medição atual registrada; pisos elevados onde a margem permitiu |
| D08 | Limpeza nos arquivos tocados nesta sessão |
| D12 | Contrato + Character/Location estruturalmente alinhados; demais formulários multi-etapa mantêm o coordenador |
| D14 | Resolvido para Character, Location e os seis formulários multi-etapa restantes |
| D15 | Resolvido |
| D16 | Resolvido para throws HTTP nas rotas |
| D17 | Resolvido |

## Arquitetura geral

| Área | Responsabilidade |
| --- | --- |
| `apps/client` | React Native/Expo, SQLite local, sync offline-first |
| `apps/api` | Bun/Elysia, PostgreSQL ou SQLite, sync, colaboração, mídia |
| `apps/desktop` | Electron fino sobre o build web do cliente |
| `apps/admin` | Administração + showcase |
| `apps/site` | Landing pública (sem `@keres/shared`) |
| `packages/shared` | Entidades, Zod, regras, solvers, grafos, tema, metadados |

## Boas práticas (resumo)

- Monorepo com fronteiras claras e testes de arquitetura executáveis
- Sync decomposto com DI e notifier na composição
- Kernel `@keres/shared` portável
- Salvamento multi-etapa padronizado (`saveEntityWithSecondaryData`) com política de recuperação documentada
- Dual-DB com adaptadores e contrato testado
- CI com lockfile congelado e pisos de cobertura com ratchet

## Continuação — formulários multi-etapa (9 de setembro de 2026)

Após P01–P10, a orquestração dos seis formulários restantes foi alinhada ao padrão Scene:

| Formulário | Hooks | Teste de actions |
| --- | --- | --- |
| WorldRule | resources/state/associations/actions | `useWorldRuleFormActions.test.ts` |
| Item | idem | `useItemFormActions.test.ts` |
| Note | idem | `useNoteFormActions.test.ts` |
| Chapter | idem | `useChapterFormActions.test.ts` |
| Choice | idem | `useChoiceFormActions.test.ts` |
| ItemJourney | idem | `useItemJourneyFormActions.test.ts` |

Invariantes preservados: hidratação só pelo `initial*Id`; `retainPersisted*Id` no `onEntityPersisted`; `preserveDraftOnEntityCreation: true`; sucesso/eventos/navegação só após o coordenador. O teste de arquitetura `extracted multi-step form responsibilities` cobre os seis.

## Continuação — erros HTTP uniformizados (9 de setembro de 2026)

As rotas que ainda faziam `set.status = N; return { message }` foram migradas para `throw new AppError(N, message)`:

- `user.route.ts`, `auth.route.ts`
- rotas admin (`adminUser`, `adminTier`, `adminRecovery`, `adminRegistration`, `adminApiLog`)
- `public.route.ts` (unlock 429/401)
- `webSocket.route.ts` (ticket inválido)

Únicos `set.status` restantes nas rotas: **201** (create) e **302** (redirect S3). O teste de arquitetura `assigns set.status in routes only for non-error outcomes` impede regressão.

## Continuação — evidência do contrato de banco nos dois motores (9 de setembro de 2026)

Infraestrutura: `docker-compose.test.yml` (Postgres 16 em `:45432`, healthy).

| Suite | PostgreSQL | SQLite |
| --- | --- | --- |
| `databaseContract.integration.test.ts` | 7 passed | 7 passed |
| `transactionContext.integration.test.ts` | 4 passed | 4 passed |
| `migrationParity.integration.test.ts` | 2 skipped (só SQLite) | 2 passed |
| `migrationJournals.test.ts` (unit) | 8 passed | — |
| `architecture/layering.test.ts` (portabilidade) | 15 passed | — |

**Totais desta passagem:** Postgres integração 11 passed + 2 skipped; SQLite integração 13 passed; journals + layering 23 passed.

Isso fecha o residual de “PostgreSQL só histórico”: o contrato comum, o contexto transacional e as regras de portabilidade estão revalidados no commit de trabalho atual. A interseção tipada do Drizzle permanece ergonomia (não prova estática completa); a prova operacional são estes testes.

## Continuação — transações explícitas sem Proxy ALS (9 de setembro de 2026)

O `db` exportado deixou de ser um Proxy que redirecionava silenciosamente para a transação ativa via AsyncLocalStorage.

- Handlers de sync recebem `database: CompatibleDb` (default `db`) em `findById` / `create` / `update` / `delete`.
- `SyncPushService` e `AdminRecoveryService` passam o `tx` do `withTransaction`.
- ALS permanece **somente** para aninhar `withTransaction` / `withWriteTransaction` (mesma sessão).
- Savepoints usam `tx.transaction(...)`, não `db.transaction`.
- Guards de arquitetura: `export const db = rawDb` (sem Proxy de redirecionamento) e push passa `tx` aos handlers.

## Continuação — formulários simples (9 de setembro de 2026)

Extraídos no padrão resources / state / actions (sem associations, salvo onde já existia lógica pós-criação como Plot↔Scene):

| Formulário | Pasta |
| --- | --- |
| Story, Friendship | `screens/enterstack/` |
| Pack | `screens/packs/` |
| StorySchemaField | `screens/storyschema/` |
| Plot | `screens/plots/` |
| Tag | `screens/tags/` |
| Stat | `screens/stats/` |
| Route | `screens/routes/` |

Guarda de arquitetura: `extracted simple form responsibilities`. Validação: **9 suítes / 67 testes** (layering + actions).

## Continuação — rascunhos secundários cross-session (9 de setembro de 2026)

Ganho de produto: se o app encerra depois de criar a entidade base e antes de terminar tags/notas/atributos, a intenção secundária deixa de se perder.

- `EntityFormSecondaryDraftStore` (AsyncStorage) por `storyId + entityType + entityId`
- O coordenador grava o rascunho logo após reter o ID e só apaga após sucesso das etapas secundárias
- Ao reabrir a entidade: tags e notas pendentes voltam via `useEntityRelations`; atributos customizados mesclam o rascunho sobre o que já está no SQLite
- Ligado em Character, Location, Item, WorldRule, Note, Chapter, Choice, ItemJourney e Scene

## Continuação — rascunhos duráveis de Board e Location Map (9 de setembro de 2026)

Os canvas já tinham draft em memória para sobreviver à navegação; agora também sobrevivem ao fechar o app:

- `canvasDraftPersistence` (AsyncStorage, debounce 400ms)
- `boardDraftStore` / `locationMapDraftStore` com `hydrate()` e gravação só enquanto dirty
- Telas carregam via `hydrate` antes de montar o conteúdo
- Reset global limpa as chaves duráveis

## Dívidas residuais conscientes (não reabrem P01–P10)

1. **Interseção tipada Drizzle** continua sendo ergonomia de call-site, não prova estática completa de portabilidade — mitigada pelos testes de contrato/arquitetura e pela evidência operacional nos dois motores.
2. Relações específicas da entidade ainda só em memória na sessão (ex.: filas Character↔Character) — tags/notas/atributos já sobrevivem ao encerrar o app.

## Validação desta sessão

### Testes executados

- Cliente: SyncPush, importBoundaries, EntityFormSaveCoordinator, multiStepFormPartialSave.policy, useEntityRelations, Character/Location form actions, SyncEngineTransfer, layering — **aprovados**
- Cliente (continuação): layering + actions dos seis formulários extraídos — **7 suítes / 42 testes aprovados**
- API: layering (incl. AppError + contrato DB), errors, transactionContext SQLite, databaseContract SQLite — **aprovados**
- API (erros HTTP): layering + smoke/admin — **5 suítes / 62 testes aprovados**
- API (banco, 9/9): contrato + transações em **PostgreSQL (11 passed)** e **SQLite (13 passed)**; journals + layering **23 passed**
- API (ALS/tx explícito): layering **17 passed**; contrato+tx SQLite/Postgres **11+11 passed**; `simpleSyncHandlers` SQLite **9 passed**
- Shared: boundaries + `test:coverage` (670 testes) — **aprovados**; medição ~96,2% linhas / 96,0% funções / 80,2% branches com solvers/theme incluídos
- `bun run coverage:update` — ratchet aplicado (ex.: cliente 40,8% linhas; sync core functions 93,8%)

## Continuação — suíte completa e cobertura (9 de setembro de 2026)

Corrigidos 3 erros de typecheck do cliente introduzidos pelos refactors (`NoteForm` navigation, `SyncPull` notifier no teste, tipagem do teste de Story). Em seguida:

| Etapa | Resultado |
| --- | --- |
| `bun run typecheck` | OK (shared → site) |
| `bun run test:coverage` | OK |
| Shared | 65 arquivos / **670** testes |
| Cliente | **275** suítes / **2510** testes |
| API unit | 35 arquivos / **217** testes |
| Admin / desktop / site | 144 / 95 / 35 testes |
| Integração PostgreSQL | **612** passed, 2 skipped |
| Integração SQLite | **614** passed |
| `test:integration:coverage` + merge | OK |
| `coverage:update` | ratchet (ex.: cliente 43,2% linhas; apiCombined 81,5%; apiSyncHandlers branches 73,7%) |

### Limites

- A nota permanece qualitativa e não certifica ausência de bugs em todo o produto.
- Lint global (`bun run lint`) não foi o foco desta passagem.
