# Avaliação da arquitetura, manutenção e legibilidade

Análise inicial: 6 de setembro de 2026.

Reavaliações anteriores: 7 de setembro de 2026 (commits `d21ff776` e correção `90e92735`); 9 de setembro de 2026 (auditoria ampla).

**Atualização desta versão: 9 de setembro de 2026** — fechamento de R01–R05 e da dívida Drizzle/`CompatibleDb` (contrato brandado + gates). As seções históricas abaixo permanecem como registro das passagens anteriores.

## Estado atual — R01–R05 encerrados

A arquitetura geral continua adequada. Os contratos de ciclo de vida e recuperação que bloqueavam o fechamento desta avaliação foram concluídos:

| Item | Situação atual |
| --- | --- |
| R01 — isolamento do sync | **Encerrado**: `cycleBinding` por ciclo; `deactivateStoryFromActiveCycle` não limpa história alheia; transição **rejeitada** se `stopAndWait` retornar `timed_out` (ponteiros vivos permanecem estáveis; caller pode retentar) |
| R02 — concorrência dos patches | **Encerrado**: fila por chave em write/clear/patch; entradas concluídas são removidas do mapa |
| R03 — relações provisórias | **Encerrado**: projeção normaliza `''` só para UI; estado pendente preserva `''` até o persist; `handleSetParent` com ID retido remove intenção de pai pendente antes/ao gravar |
| R04 — erros de persistência | **Encerrado**: I/O de leitura propaga erro; JSON corrompido → ausência; handlers revertem e alertam em falha de patch |
| R05 — contratos tipados | **Encerrado**: forms Character/Location + Detail/Scene/Choice + `createChapterListItemRenderer` + `createCharacterDetailMutations` sem `props: any` |

### Política de R01 (resumo)

1. Cada ciclo captura story/db/client/server em `cycleBinding`.
2. Se a parada expirar, `transitionContext` **não** aplica `change()` e relança o scheduler no contexto ainda ativo.
3. Um ciclo abandonado que chame desativação só limpa o contexto se a história viva ainda for a dele.

### Dívida consciente remanescente (não bloqueia)

Nenhuma pendência listada neste ciclo. Polish aplicado: AbortSignal no ciclo de sync e tipagem mais firme em Scene/Choice.

### Dual-DB / Drizzle — decisão fechada

`CompatibleDb` é o **contrato de aplicação** (brand + bridge único `exposeCompatibleDb`). A interseção das sobrecargas Postgres/libSQL existe só para ergonomia de call-site; **não** é prova estática de portabilidade. A prova é denylist de chaves, testes de contrato nos dois motores e gates em `layering.test.ts`. Trocar ou acrescentar motor = trabalho em `db/` (conexão, `sqlOperators`, transações, migrações, contrato) — não reescrita da API.

### Validação desta continuação

- Testes permanentes cobrindo timeout de transição, desativação cruzada, read/patch com falha de I/O, pai pendente de Location e serialização de drafts.
- Typecheck do cliente nas fronteiras tipadas desta passagem.
- A análise de `7e1c81dc` / `48491c49` abaixo fica como histórico; **esta tabela prevalece**.

## Histórico — revisão de `7e1c81dc`

A estrutura continua adequada: monorepo organizado por aplicações, cliente offline-first dividido por funcionalidades e responsabilidades, API em camadas e núcleo compartilhado. Não há motivo demonstrado para migrar tudo para outra arquitetura. Entretanto, ainda existem falhas de consistência em sincronização e recuperação de rascunhos. Não considero o trabalho encerrado, independentemente da porcentagem de cobertura.

### Correções confirmadas nesta passagem

- O provedor de autenticação agora pertence a cada instância HTTP, sem compartilhar a variável global anterior.
- Os clientes HTTP recebem timeout padrão. Isso limita cada requisição, mas não garante o encerramento de um ciclo inteiro de sync.
- Gravação e remoção do rascunho propagam erros ao coordenador de salvamento. Os caminhos de edição incremental ainda têm o problema R04 abaixo.
- A hidratação de notas pendentes passou a ocorrer uma vez por sessão, evitando que um refresh normal reaplique a cópia antiga após exclusão.
- Character/Location passaram a persistir relações específicas e a tratar exclusão de pendentes pelo ID da relação. A apresentação dessas relações ainda está incompleta: R03.
- Os canais de mídia do desktop agora verificam o renderer autorizado.
- O typecheck do cliente passou; o erro anterior no teste do coordenador não permanece.

### O que resta fazer, em ordem de prioridade

| ID | Prioridade | Pendência | Evidência |
| --- | --- | --- | --- |
| R01 | Alta | Impedir troca de contexto enquanto o ciclo anterior ainda pode produzir efeitos | Reproduzida em teste isolado do engine com relógio simulado |
| R02 | Alta | Serializar alterações duráveis por chave de rascunho | Reproduzida em teste isolado com dois patches concorrentes |
| R03 | Alta | Resolver IDs provisórios na apresentação e edição das relações recuperadas | Confirmada por leitura conjunta de hooks, conteúdo e componentes; sem reprodução visual nesta passagem |
| R04 | Média | Comunicar falhas de persistência também nas edições incrementais | Confirmada por leitura dos caminhos de erro |
| R05 | Média | Substituir contratos `props: any` nas fronteiras entre telas e conteúdo | Ocorrências verificadas no código; dívida de manutenção, sem bug específico atribuído |

**R01 — Timeout de parada não equivale a cancelamento.** Em `apps/client/src/services/sync/SyncScheduler.ts:117`, `stopAndWait` resolve ao terminar o ciclo **ou** ao expirar 45 segundos. Em `apps/client/src/services/SyncEngineService.ts:229`, `transitionContext` então troca história, cliente ou banco. O ciclo antigo continua vivo, e seus serviços consultam dependências mutáveis. No teste adicional, o mesmo ciclo observou `[história original, story-2]` antes/depois da espera. A troca de geração impede reagendamento, mas não efeitos do trabalho em andamento. O timeout HTTP por requisição também não limita um ciclo com várias páginas, push e mídia. Corrigir com cancelamento propagado e encerramento efetivo antes da troca, ou rejeitar a transição ao expirar o prazo mantendo o contexto estável. Se permitir trabalho antigo em background, será necessário isolar todas as dependências por ciclo e impedir qualquer efeito obsoleto. Validar troca de história, banco e reset após o prazo, não só o retorno de `stopAndWait`.

**R02 — Patches podem perder alterações.** `patchEntityFormSecondaryDraft` em `apps/client/src/services/storymanagement/EntityFormSecondaryDraftStore.ts` faz leitura, merge e gravação sem exclusão mútua. Notas e relações específicas usam a mesma chave. Dois patches podem ler a mesma versão e a última gravação restaurar dados removidos pelo primeiro. O teste executou simultaneamente remoção de notas pendentes e remoção de relações específicas: a nota antiga voltou ao armazenamento. Serializar por chave a operação completa, incluindo sua interação com gravação integral e limpeza; testar também patch concorrente com conclusão do salvamento para evitar recriar um rascunho já eliminado.

**R03 — Concatenar listas não resolve a identidade provisória.** `useCharacterFormAssociations` e `useLocationFormAssociations` retornam listas persistidas + pendentes, mas as pendentes criadas antes da entidade conservam `''` em uma extremidade. `CharacterFormContent`/`LocationFormContent` passam o ID definitivo aos managers. `CharacterRelationManager.tsx:56` e `LocationRelationManager.tsx:96` filtram pela igualdade com esse ID, excluindo as pendentes ao reter o ID ou reabrir o formulário. Resolver o ID na projeção usada pela interface, preservando a identificação de pendente. Em Location, revisar também `handleSetParent`: após existir ID ele grava diretamente, sem substituir a intenção de pai ainda pendente; o replay pode reaplicar o pai antigo. Validar criação → falha secundária → edição/exclusão → reabertura → novo salvamento nos dois formulários.

**R04 — Persistência incremental ainda pode anunciar sucesso indevido.** Embora o store agora lance erros de escrita, `syncPendingNotesToDurableDraft` em `useEntityRelations.ts:135` captura e apenas registra a exceção; os handlers seguintes exibem sucesso. Os helpers equivalentes de Character/Location também absorvem o erro. Além disso, a leitura do store transforma erro de acesso em `null`, fazendo `patch` terminar como se não existisse rascunho. Uma alteração pode ficar só em memória e a versão antiga voltar após reinício. Distinguir ausência, conteúdo inválido e erro de acesso; preservar a edição em memória, indicar que a persistência falhou e permitir nova tentativa. Testar falhas de leitura/escrita nos handlers, além do contrato isolado do store.

**R05 — Contratos de apresentação ainda não tipados.** Há `props: any` em `CharacterFormContent`, `LocationFormContent`, `CharacterDetailContent`, `SceneDetailContent`, `ChoiceViewContent`, `createChapterListItemRenderer` e `createCharacterDetailMutations`. A extração estrutural melhorou a leitura, mas esses contratos deixam renomeações e propriedades ausentes escaparem do compilador. Definir interfaces explícitas ou derivadas dos hooks, com apenas os dados e ações necessários. Isso não exige outra camada nem reescrita dos formulários.

### Validação desta revisão

- Cliente: 8 suítes existentes, **150 testes aprovados** (engine, scheduler, HTTP, store, coordenador, relações e actions de Character/Location).
- Desktop: 7 arquivos, **101 testes aprovados**.
- Typecheck do cliente: **aprovado**.
- Dois testes temporários adicionais: **2 falhas esperadas que reproduziram R01 e R02**. Os arquivos temporários foram removidos após a análise; devem virar testes permanentes junto das correções.
- Não foram reexecutados nesta continuação o lint global, toda a suíte do monorepo, integrações PostgreSQL/SQLite ou testes visuais do produto. Os resultados históricos abaixo não equivalem a nova execução sobre este commit.

As notas numéricas abaixo são históricas e qualitativas; não devem ser interpretadas como aprovação dos fluxos afetados por R01–R04. A prioridade agora é fechar esses contratos de consistência e completar a tipagem das fronteiras. A interseção Drizzle permanece uma limitação consciente mitigada por contratos, sem necessidade demonstrada de reescrita.

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

**Os itens históricos P01–P10 foram encerrados nas passagens anteriores.** Isso não encerra os achados atuais R01–R05 listados no início deste documento. As extrações de formulários, padronização HTTP e validações de banco posteriores estão registradas abaixo.

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
| D01–D03, D05, D09, D11, D13 | Corrigidos nas avaliações anteriores; observar os novos achados de recuperação acima |
| D10 | A estabilidade do contexto precisa de nova correção devido ao timeout de parada: R01 |
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

## Continuação — produto: rascunhos e UX de recuperação (9 de setembro de 2026)

1. **Relações específicas duráveis** — Character↔Character e Location↔Location entram em `pendingEntityRelations` no draft store; restauradas ao reabrir.
2. **Aviso ao recuperar** — notificação `entity_secondary_draft_restored` / `canvas_draft_restored`.
3. **Conflito canvas × versão salva** — se o SQLite mudou desde o rascunho (ex.: sync), restaura o draft local e avisa com `canvas_draft_conflicts_with_saved`; Reverter volta à versão guardada.

## Dívidas residuais conscientes (não reabrem P01–P10)

Nenhuma pendência Drizzle aberta: ver “Dual-DB / Drizzle — decisão fechada” no estado atual. AbortSignal no ciclo de sync foi incorporado ao polish (scheduler aborta o sinal em `stop`; pull/push recebem `{ signal }`).

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
