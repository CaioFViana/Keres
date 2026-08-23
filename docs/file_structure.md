# Estrutura do Projeto

> O texto abaixo reflete a estrutura real do repositório.

## Visão geral do monorepo

```
Keres/
├── apps/
│   ├── api/       # Backend - Elysia (Bun) + Drizzle (Postgres)
│   ├── admin/     # Painel administrativo interno - React + Vite
│   ├── client/    # App principal - React Native + Expo (mobile e web)
│   ├── desktop/   # Empacotador Electron do client, para Windows/Mac/Linux
│   └── site/      # Landing pública (GitHub Pages) - React + Vite
├── packages/
│   └── shared/    # Entidades, schemas Zod e metadados compartilhados entre api/admin/client
└── docs/          # Esta pasta
```

Não existe um `packages/db` separado: cada app com persistência própria tem seu próprio schema Drizzle (`apps/api/src/db/`, do lado do servidor/Postgres; `apps/client/src/db/`, do lado do cliente/SQLite local) - ambos mapeando as mesmas entidades de `packages/shared/entities`, mas como bancos fisicamente distintos (ver estratégia offline-first em `project_plan.md`).

---

## `packages/shared`

Consumido por `apps/api`, `apps/admin` e `apps/client` via `@keres/shared` (e via caminhos profundos tipo `@keres/shared/metadata/entityFields` para metadados específicos).

- **`entities/`** - interfaces TypeScript que formam o vocabulário comum do sistema. Além das entidades narrativas (`Story`, `Character`, `Chapter`, `Scene`, `Location`, `Item`/`ItemJourney`, `Note`, `Tag`, `WorldRule`, `Gallery`), incluem relações (`CharacterRelation`, `CharacterScene`, `LocationRelation`, `GalleryRelation`, `SeeAlsoRelation`), narrativa ramificada (`Choice`, `ChoiceCheckGroup`, `ChoiceCheck`, `Effect`), recursos transversais (`Comment`, `Favorite`, `Suggestion`, `StorySchemaField`, `AttributeValue`), status (`Stat`/`StatStrength`/`StatRelation`, `Mode`), publicação (`StoryPublication`, `PublicShowcaseStory`) e entidades de usuário/admin/configuração.
- **`schemas/`** - validação Zod para request/response de cada recurso da API, espelhando as entidades acima.
- **`metadata/`** - enums e configurações estáticas usadas em vários lugares do sistema:
  - `StorySchemaEntityType` - as 7 entidades que aceitam atributos customizados (`Character`, `Location`, `Item`, `Scene`, `Chapter`, `Note`, `WorldRule`) - exclui tabelas de relação/junção, `Choice`, `Gallery` e a própria `Story`.
  - `AttributeType` - tipos de campo customizado (`TEXT`, `LONG_TEXT`, `NUMBER`, `BOOLEAN`, `DATE`, `SUGGESTION`).
  - `OperationLogEntityType` - as entidades cobertas pelo log de operações de sincronização.
  - `LocationRelationType` - `'contains'` (direcional, pai/filho) e `'connected_to'` (par não-ordenado).
  - `FriendStatus` - `PENDING` / `FRIEND` / `BLACKLISTED`.
  - `entityFields.ts` - `entityFieldMetadata`: lista de campos pesquisáveis por entidade, usada pelo modal de Busca Avançada (`AdvancedSearchModal`).
  - `globalSearchFields.ts` - `globalSearchFieldConfig`: campo de título + campos pesquisáveis por entidade, usada pela Busca Global (ver `screen_flow.md`).
- **`utils/`** - `attributeKey.ts` (deriva uma chave segura a partir do nome de exibição de um atributo customizado) e `attributeValueCodec.ts` (codifica/decodifica valores tipados de atributo customizado para a única coluna de texto onde são armazenados).

---

## `apps/api`

Backend em **Elysia** (framework HTTP para **Bun**), **Drizzle ORM** sobre **PostgreSQL**, validação com **Zod** (schemas de `packages/shared`), autenticação **JWT** (`@elysiajs/jwt`), IDs **ULID**.

- **`src/db/`** - `schema/tables/*.ts`: 44 tabelas Drizzle do lado do servidor, uma por entidade sincronizável.
- **`src/modules/`** - um subdiretório por recurso, cada um com seu `*.route.ts`: `auth`, `sync`, `story`, `storyPermission`, `friend`, `user`, `media`, `websocket`, `admin` (que por sua vez agrupa `adminUser`, `adminTier`, `adminRegistration`, `adminRecovery`).
- **`src/services/`** - lógica de negócio (`SyncService`, `StoryPermissionService`, `FriendshipService`, `TierService`/`TierEnforcementService`, `MediaStorageService`, `StoryExportImportService`, etc.) e **`entity-sync-handlers/`** - um handler por entidade sincronizável (estende `BaseSyncEntityHandler`). OCC por `version`, lote não-atômico e mescla/conflito descritos em `conflict_resolution_client_strategy.md`.
- A API também serve o SPA compilado de `apps/admin` sob `/admin/*`, o export web do cliente na raiz (COOP/COEP para o SQLite WASM; sessão por cookie HttpOnly), a vitrine de histórias em `/showcase`, e o Swagger em `/swagger`.
- **`src/launcher/`** - assistente CLI do **Keres Server** (binário/zip sem Docker). `src/launcher.ts` é o entry; `src/server.ts` continua a ser o boot do Compose (`bun run start:api`). `--backup` copia a pasta de dados para `…-backups/<data>_<hora>/`. `src/config/resourceRoot.ts` acha migrações e o dist do admin no checkout ou ao lado do executável. `packaging/README.md` (pt+en) entra no zip. `bun run package:server` gera `apps/api/dist-server/keres-server/` e o zip `Keres-Server-<os>-<arch>-<versão>.zip` que o job `keres-server` de `.github/workflows/release.yml` anexa à GitHub Release.


---

## `apps/client`

**React Native + Expo**, com **React Native Web** - o mesmo código roda nativo (Android/iOS) e como app web (essa build web é exatamente o que `apps/desktop` empacota dentro do Electron; ver abaixo). Offline-first: todo o estado da história vive num banco SQLite local.

- **`src/db/`** - banco local via **Drizzle ORM + expo-sqlite**. `schemas/` contém 37 tabelas: entidades narrativas e transversais sincronizáveis, mais tabelas exclusivas do cliente sem equivalente no servidor (`clientSettings`, `servers`, `syncConflicts`).
- **`src/screens/`** - uma pasta por entidade/feature, cada uma com suas próprias telas de Lista/Detalhe/Formulário dedicadas (não existe uma tela genérica compartilhada; ver `screen_flow.md` para o fluxo completo de navegação):
  `characters/`, `locations/`, `chapters/`, `scenes/`, `choices/`, `items/`, `itemJourneys/`, `tags/`, `worldrules/`, `notes/`, `gallery/`, `characterrelations/`, `operationlog/`, `storyschema/`, `stats/`, `globalsearch/`, `mainstorystack/` (Dashboard, Configurações da História, Análise da História), `enterstack/` (Cold Install, seleção/CRUD de história, servidores, amizades, perfil), `examplestories/`.
- **`src/state/`** - stores **Zustand**, um por entidade (`characterStore`, `locationStore`, `tagStore`, ...) construídos pela factory compartilhada **`createEntityStore.ts`**, que centraliza o que antes era duplicado (~140 linhas) em cada store: estado de filtro/busca/ordenação, favoritar com atualização otimista + rollback, inicialização do serviço a partir do db + storyId, e o ciclo de fetch. Cada store só informa `collectionKey`, `createService` e `fetchEntities` (e opcionalmente `updateFavorite`/`extraActions`/`persistKey`); a API pública continua com nomes por entidade (`tags`/`fetchTags`) via mapped types. Stores de nível de app (`themeStore`, `storyStore`, `userSettingsStore`, `syncConflictStore`, `connectivityStore`, `notificationStore`, `appAlertStore`) vivem no mesmo diretório.
- **`src/services/`** - `storymanagement/` (um serviço de CRUD por entidade, ex: `CharacterService`, `GlobalSearchService`), `entity-sync-handlers/` (contraparte no cliente dos handlers da API, aplicando operações recebidas no banco local), `SyncEngineService`, `SyncConflictService`, `apiClient`/`AuthTokenManager`, `MediaFileService`/`webMediaStore`.
- **`src/navigation/`** - `AppNavigator.tsx` (raiz) alterna entre `ColdInstallStack`, `StorySelectionStack` e `MainSystemStack` (o drawer principal, descrito em `screen_flow.md`).
- **`src/components/`** - `common/` (componentes genéricos reutilizados entre entidades: `GenericFilterSortList`, `AdvancedSearchModal`, `GenericExpandedListItemWithActions`, etc.), `listitem/` (um item de lista por entidade), gerenciadores de relação (`CharacterRelationManager`, `NoteManager`, ...) e renderizadores de grafo (`StoryGraph`, `LocationGraph`, `CharacterRelationGraph`).
- **`src/hooks/`, `src/utils/`, `src/theme/`, `src/locales/`** (`en.json`/`pt.json`) - hooks compartilhados (`useEntityListScreen`, `useEntityRelations`, `useStorySchemaFields`, ...), utilitários (layout/SVG de grafos, i18n, `documentTitle.ts`, `entityNavigation.ts`), tema e traduções.

---

## `apps/desktop`

Wrapper **Electron** em torno do export web de `apps/client`. `main.ts`:

- Aponta `CLIENT_DIST` para o build web do client (`../../client/dist` em dev, `resourcesPath/client-dist` empacotado) e o serve através de um protocolo customizado `app://`, com headers COOP/COEP - exigidos pelo driver WASM/OPFS do `expo-sqlite` no navegador (SharedArrayBuffer só é permitido numa página "cross-origin isolated").
- Cria a `BrowserWindow` e mantém o título da janela sincronizado com o título dinâmico que o próprio client já define por tela (`DocumentTitleSync`/`setDocumentTitle`, ver `apps/client/src/utils/documentTitle.ts`).
- Expõe IPC de mídia (`media:write/read/delete-file/delete-directory/list-all`) para gravar/ler arquivos de mídia importados no sistema de arquivos real (fora do sandbox do Chromium), diferente do SQLite, que permanece em OPFS.

---

## `apps/admin`

SPA em **React + Vite + react-router-dom**, servido pela própria API sob `/admin/*`. É um painel **interno**, não voltado ao usuário final (o escritor): gerencia usuários, tiers/planos de assinatura, configurações de abertura de cadastro e recuperação de conta. O mesmo projeto também gera o **Showcase** (`vite.showcase.config.ts`, saída em `dist-showcase/`), a vitrine de histórias publicadas servida pela API — coisa distinta da landing do GitHub Pages.

---

## `apps/site`

Landing pública do Keres, um SPA **React + Vite** estático, em português e inglês, com o mesmo visual (claro/escuro) do Showcase. Não fala com a API: descreve o produto e aponta para o repositório, as GitHub Releases e a imagem Docker.

O workflow `.github/workflows/pages.yml` constrói `apps/site/dist` e publica no GitHub Pages. A URL do site de projeto é `https://<dono>.github.io/<repositório>/` — o `base` do Vite vem de `VITE_BASE` no CI, porque o nome do repositório preserva maiúsculas (`Keres`). Localmente: `bun run dev:site` (porta 5175) e `bun run build:site`.

Na primeira publicação, em Settings → Pages do repositório, a origem precisa ser **GitHub Actions**.
