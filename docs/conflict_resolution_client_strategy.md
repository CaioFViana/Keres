# Sincronização e resolução de conflitos

Documento do comportamento **atual** (`SyncService` / `SyncEngineService` / `SyncConflictService`). Não é um plano: o que está aqui é o que o código faz.

## Visão geral

Cada entidade sincronizável tem um `version` (concorrência otimista da *linha*, não do log). Cada escrita local vira uma linha no log de operações. O ciclo de sync:

1. **Pull** das operações do servidor desde o cursor (`lastServerSyncedLog`).
2. Aplica as remotas, mesclando em silêncio campos que não disputam com edições locais pendentes.
3. **Push** das operações locais ainda não aceitas.
4. Transfere mídia depois dos metadados.

O servidor é a fonte da verdade. O log só retransmite o que o handler de fato gravou, não o JSON cru do cliente.

## Papéis

| Papel | Pode escrever conteúdo | Pode apagar a história / mudar dono, `type`, `favoriteBehavior`, `allowReaderComments` |
|---|---|---|
| `owner` | sim | sim |
| `writer` | sim | não |
| `reader` | só `Favorite` próprio e, se a história permitir, `Comment` próprio | não |

Create de `Story` com id diferente do da URL é recusado. Transplante de entidade (`changes.storyId` / `userId`) é recusado.

## Protocolo

Rotas autenticadas por JWT: `POST /sync/:storyId`, `GET /sync/:storyId/pull`, `GET /sync/pullpreviews`.

Envelope comum: `type`, `entity`, `id` (ULID; obrigatório em create/update/delete/reorder), `version` da *entidade*, `operationTime` (ISO), `clientOperationId` (id local, ecoado na resposta).

| Tipo | Campos extras | Base do OCC |
|---|---|---|
| `create` | `data` | — (id novo; reenvio do mesmo id com os mesmos dados é idempotente) |
| `update` | `changes` **com `changes.version` obrigatório** | `changes.version` é a base que o cliente leu, não o envelope |
| `delete` | — | `version` no envelope. Obrigatório para entidades filhas. O dono pode omitir ao apagar a *própria* Story (`deleteStory` / `unlinkFromServer`); o servidor preenche a versão atual |
| `reorder` | `reorderItems` (`id` + `newIndex` 1-based) | `version` da Story (capítulos / atributos) ou do Chapter (cenas) |

Omitir `changes.version` num update **não** vira last-write-wins: o schema responde 422 e o lote inteiro é recusado. O motor do cliente deriva a base como `payload.version - 1` (o log local guarda a versão *resultante*).

Limites: push no máximo 200 operações por POST (`MAX_SYNC_BATCH_SIZE`); pull no máximo 500 por página (`MAX_SYNC_PULL_BATCH`). Rate limit ~120 req/min por usuário.

## Servidor

`SyncService.processAndRecordUpdates` aplica o lote **operação a operação**, não tudo-ou-nada. Cada escrita de entidade e a linha do log rodam na mesma transação. O contador `stories.lastOperationVersion` é incrementado atomicamente.

OCC compara **igualdade** da base com a versão atual (`checkVersionConflict`). O `UPDATE` / tombstone também usa `WHERE version = :base`. Sem base (exceto delete de Story pelo dono) a operação é recusada com `validation`.

Resposta do push: `applied[]` + `conflicts[]`. Só as aceitas devem ser marcadas `isSynced` no cliente. Operações seguintes da mesma entidade no mesmo lote, depois de um conflito, são bloqueadas (`blockedEntities`).

O payload gravado no log é o sanitizado (campos de identidade/`version`/`storyId`/`userId` não viajam). O pull reconstrói o `StoryUpdate` a partir desse payload + metadados do log (`entityVersion`, `originatingUser`).

Mídia: create/update de Gallery com um hash **já existente no storage** só passa se esta história já o referencia. Hash ainda inexistente é mídia nova cujo upload vem depois.

## Cliente

`SyncEngineService.performSync`:

- Mutações de política da Story (`type`, `favoriteBehavior`, `allowReaderComments`) e o delete/unlink da história são recusadas localmente se o papel não for `owner` (`assertStoryIsOwned` / `StoryService.updateStory` / `convertStoryType`), para não enfileirar um push que o servidor recusaria para sempre. Writer continua podendo editar conteúdo.
- Pull em páginas até a resposta vir incompleta. O cursor avança só até a última operação **aplicada**. Uma falha no meio da página **não** pula a operação: o ciclo para nela.
- Timer e `requestSync` (websocket / escrita local) compartilham o mesmo cadeado; os ciclos não se sobrepõem.
- Push fatia a fila em blocos de 200, na ordem de `operationVersion`. Depois de cada bloco processa `applied`/`conflicts` antes do próximo, para não reenviar o que o servidor recusou. Sem progresso no lote, para.
- Update local sem `version` no payload é pulado (não envenena o lote).

### Mescla automática vs. tela de conflito

Campos de bookkeeping (`id`, `storyId`, `version`, timestamps) nunca entram no comparativo.

- **Campos disjuntos:** o lado que não disputa é aplicado; a operação local é rebaseada na versão nova e vai no próximo push sem perguntar. Vale no pull e na resposta de `version_conflict` quando o servidor manda `changedFields`.
- **Mesmo campo, valores diferentes:** conflito `concurrent_edit`. A faixa no painel abre a folha de revisão (`SyncConflictService`).
- **Exclusão vs. edição:** não é “exclusão sempre vence”. O usuário escolhe restaurar, aceitar a exclusão ou manter o delete local (reenviado sobre a versão atual do servidor).
- **Reorder:** a ordem inteira é o valor em disputa, não um campo escalar. “Manter o meu” só atualiza a base da operação de reorder pendente.

Opções na UI: manter o local, manter o servidor, mesclar campo a campo, restaurar, adiar. Um conflito pendente tira aquelas operações da fila de push; o resto da história continua sincronizando.

## O que não é mais verdade

Documentos e comentários antigos falavam em last-write-wins por `updated_at`, lote tudo-ou-nada, comparação `clientVersion < serverVersion`, e “omitir versão desliga o OCC”. Nada disso vale. A exclusão também não ganha automaticamente de uma edição concorrente.

## Código de referência

- Servidor: `apps/api/src/services/SyncService.ts`, `apps/api/src/services/entity-sync-handlers/BaseSyncEntityHandler.ts`, `apps/api/src/modules/sync/sync.route.ts`
- Cliente: `apps/client/src/services/SyncEngineService.ts`, `apps/client/src/services/SyncConflictService.ts`, `apps/client/src/utils/syncUtils.ts`
- Contrato: `packages/shared/schemas/SyncSchemas.ts`
