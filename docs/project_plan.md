# Keres - Story Organizer Project Plan

Um organizador offline-first de histórias (solo ou colaborativas), com sincronização inteligente entre dispositivos locais e servidor remoto. O Keres oferece aos escritores uma forma de organizar personagens, locais, cenas, regras do mundo e a estrutura narrativa, com foco em acesso rápido e organização eficiente.

Backend com **Elysia (Bun)** + **Zod** para rotas/validação, **Drizzle ORM** para persistência (**PostgreSQL** no servidor), **ULID** como identificadores. Frontend em **React Native + Expo** (mobile nativo e web via React Native Web) com suporte a SQLite local (Drizzle + expo-sqlite) em um modelo offline-first com engine de sincronização própria. A build web do frontend é o que o app desktop (**Electron**) empacota para Windows/Mac/Linux. Um painel administrativo separado (React + Vite) é servido pela própria API.

> Ver `docs/file_structure.md` para o mapeamento completo e atualizado de diretórios - a estrutura abaixo é um resumo de alto nível.

---

## 📂 Estrutura de Repositório

```
Keres/
├── apps/
│ ├── api/      # API Elysia (Bun) + Drizzle/Postgres
│ │ ├── docker-compose.yml
│ │ ├── src/
│ │ │ ├── index.ts    # bootstrap Elysia app
│ │ │ ├── modules/    # rotas + handlers por recurso (auth, sync, story, friend, admin, ...)
│ │ │ ├── services/   # lógica de negócio + entity-sync-handlers/
│ │ │ └── db/         # schema Drizzle (Postgres) e migrations
│ ├── admin/    # painel administrativo interno (React + Vite), servido pela API em /admin
│ ├── site/     # landing pública (GitHub Pages)
│ ├── client/   # frontend (React Native + Expo, mobile e web)
│ │ └── src/
│ │   ├── db/        # schema Drizzle (SQLite local) e migrations
│ │   ├── screens/    # uma pasta por entidade/feature
│ │   ├── state/      # stores Zustand (createEntityStore.ts)
│ │   ├── services/   # CRUD por entidade + sync engine
│ │   └── navigation/
│ └── desktop/  # wrapper Electron do build web do client
│
├── packages/
│ └── shared/   # entities (TS), schemas Zod, metadata e utils compartilhados
│
├── package.json
└── README.md
```

---

## 🗄️ Estrutura de Dados

### Usuários
O aplicativo é de login único. Este usuário pode ter quantas histórias desejar, sem que as tabelas de outras histórias interfiram (Ex: "locais" de uma história não devem aparecer em outra).

**Nota sobre a Tabela `User` Local (Cliente):**
A tabela `User` no banco de dados local do cliente funcionará primariamente como um **cache de dados de referência**. Ela armazenará informações mínimas de usuários remotos (como `id`, `username`, `displayName`, `avatarUrl`, `version`) que são referenciados por histórias ou outras entidades que o usuário local possui ou com as quais interage. Esta tabela **não** se destina a ser uma cópia completa de todos os usuários do servidor remoto, nem uma "lista de amigos" social. O motor de sincronização será responsável por popular e manter este cache, garantindo que os dados de usuários relevantes estejam disponíveis offline para manter a integridade referencial das histórias.

**Nota Importante sobre Sincronização:** Para suportar a engine de sincronização offline-first, todas as entidades persistentes (como `Story`, `Character`, `Chapter`, etc.) incluirão um campo `version: number;`. Este campo é crucial para a detecção e resolução de conflitos durante o processo de sincronização entre clientes e o servidor, garantindo a consistência dos dados.

### Story
A tabela principal. Armazena os dados gerais da história (`title`, `type: 'linear' | 'branching'`, `description`, `genre`, `language`, `author`, ...). `userId` referencia o dono; `serverId` (só no cliente) referencia a que servidor remoto, se algum, a história está vinculada - `null` significa história estritamente local/offline.

### Characters
Nenhuma história existe sem personagens.

### Chapters
Uma coleção de cenas. Não significa ordem cronológica, mas sim "ordem de exibição".

### Scenes
Unidades narrativas fundamentais.

### Locations
Informações gerais sobre um local.

### Gallery / Gallery Relations
`Gallery` é um asset de mídia (imagem/vídeo/áudio) da história, identificado por hash de conteúdo. `GalleryRelation` é a tabela N:N que liga uma `Gallery` a qualquer entidade "dona" (`ownerId` + `ownerType`) - é assim que uma mesma imagem pode ilustrar um Personagem, um Local, uma Nota, etc., sem a Gallery precisar saber de antemão a quem pertence.

### Relational Tables

#### Character X Scene (`CharacterScene`)
Lista quem estava onde e quando.

#### Character X Character (`CharacterRelation`)
Relações fixas. Como "irmãos", "Mestre/Escravo", "Mãe/Filha"...

#### Location X Location (`LocationRelation`)
Relação entre dois locais, com `relationType`: `contains` (direcional - `locationAId` é o local "pai" que contém `locationBId`) ou `connected_to` (par não-ordenado, ex: duas cidades ligadas por estrada).

#### Tag X <entidade> (`TagRelation`) / Note X <entidade> (`NoteRelation`)
Mesmo padrão polimórfico de `GalleryRelation`: uma tabela de junção genérica ligando uma `Tag`/`Note` a qualquer entidade da história, em vez de uma coluna de FK fixa por tipo.

#### Status, modos e valores (`Stat`, `StatStrength`, `StatRelation`, `Mode`)
Quando `Story.statSystem` está ligado, `Stat` define um eixo mensurável (por exemplo, Força); apenas os eixos primários entram no radar. `StatStrength` define a escala padrão da história ou uma escala exclusiva de um stat. `StatRelation` guarda o valor de um personagem em um stat e, opcionalmente, em um `Mode`; sem valor próprio no modo, vale o valor normal do personagem. `Mode` existe independentemente do sistema de status e descreve uma forma/estado alternativo do personagem.

#### Comentários e "Veja também" (`Comment`, `SeeAlsoRelation`)
`Comment` é uma conversa anexada a um campo de uma entidade navegável, não apenas uma observação solta da entidade. Ele aponta para um campo nativo (`fieldKey`) ou personalizado (`fieldId`), preserva o conteúdo/excerto vistos no momento e registra autor e criticidade. `SeeAlsoRelation` é um vínculo recíproco livre entre duas entidades compatíveis.

### Choices
Representa as transições entre cenas em histórias ramificadas (CYOA) - `sceneId` (origem) → `nextSceneId` (destino) + `text`. Ver `docs/choice_mechanics.md` e `docs/dynamic_story_structure.md` para o detalhamento completo (histórias lineares nunca têm `Choice`s explícitas; a navegação segue o `index` das cenas).

### Items / Item Journeys
`Item` é um objeto da história (arma, artefato, ...). `ItemJourney` registra a "trajetória" de um item ao longo da narrativa: em que `sceneId` ele muda, para que `newState`, e opcionalmente muda de dono (`newCharacterOwnerId`) - é o histórico de posse/estado de um item contado cena a cena.

### World Rules
Por exemplo, quem pode fazer o quê? Qual é a relação de poder?

Ex: Mana é necessária para lançar feitiços.
Ex: Com cristais elementais, podemos carregar máquinas para lançar os mesmos feitiços daquele elemento.
Ex: Ninguém pode usar o elemento luz. Exceto nosso protagonista. É o que o torna especial.

### Notes
Qualquer autor deve ser capaz de escrever livremente, sem muita organização ou vinculação a algo. O sistema permitirá ancorar a algo, mas não o forçará. Ancoragem implementada via `NoteRelation` (ver acima) - uma nota pode estar ligada a zero ou mais entidades.

### Tags
Implementadas como uma entidade própria (`Tag`, com `name`/`color`) mais uma tabela de junção polimórfica (`TagRelation`) que permite aplicar qualquer tag a qualquer entidade da história, em vez de um enum fixo por campo.

### Story Schema Fields / Attribute Values (Atributos Customizados)
Além dos campos nativos de cada entidade, o usuário pode definir **campos customizados** por história para as entidades de `StorySchemaEntityType` (`Character`, `Location`, `Item`, `Scene`, `Chapter`, `Note`, `WorldRule`). `StorySchemaField` define o campo (nome, chave, tipo - `AttributeType`: texto, texto longo, número, booleano, data ou sugestão). `AttributeValue` é o valor desse campo para uma entidade específica (`entityType` + `entityId` + `fieldId` + `value`, sempre armazenado como texto e codificado/decodificado por `attributeValueCodec.ts` conforme o tipo). É esse par de tabelas que dá a cada história a flexibilidade de "adicionar qualquer atributo a qualquer personagem/local/etc" sem alterar o schema físico.

### Operation Log
Toda operação sincronizável (create/update/delete em qualquer entidade coberta por `OperationLogEntityType`) gera uma entrada no log de operações, tanto no cliente quanto no servidor - é a trilha de auditoria e a fonte de verdade para o mecanismo de pull/push de sincronização (ver seção de sincronização abaixo).

### Publicações (`StoryPublication`)
Uma publicação é um pacote imutável de uma versão da história para o Showcase. Ela referencia a história e o dono, mas fica deliberadamente fora da sincronização incremental e do log de operações; seus metadados descrevem o pacote e o snapshot público daquela versão.

### Suggestions
`Suggestion` é uma entidade sincronizável por história (`storyId`, `type`, `value`) que sustenta o sistema reutilizável de sugestões. O `type` identifica a fonte/catálogo usada por campos nativos e customizados; assim, valores inseridos numa fonte podem ser reaproveitados onde aquela fonte é oferecida. Além de texto simples, o sistema suporta listas nomeadas e campos customizados de sugestão ou lista de sugestões.

## Ajuda integrada

O cliente inclui um catálogo de ajuda em português e inglês, com busca local, páginas por tarefa, tabelas de campos visíveis e acesso contextual pelos cabeçalhos das telas.

## Recursos transversais da história

- **Favoritos:** uma história ou elemento pode ser destacado para filtros e listas. Em histórias compartilhadas, o comportamento do favorito é definido nas configurações da história.
- **Comentários:** colaboradores e leitores autorizados podem comentar um campo nativo ou personalizado de uma entidade navegável; cada comentário preserva o contexto do campo e a lista de comentários reúne essas conversas.
- **Veja também:** cria uma ligação livre e recíproca entre elementos relacionados, sem substituir etiquetas ou notas.
- **Histórias ramificadas:** escolhas podem ter condições (visitas, itens ou marcadores) e efeitos (dar/tirar item ou ligar/desligar marcador). Esses recursos formam o estado do leitor e são analisados junto ao mapa da história.
- **Colaboração:** uma história ligada a servidor pode ter colaboradores; permissões e comentários de leitores são configurados na própria história.

### Gráfico de Relações entre Entidades

> Diagrama da estrutura de conteúdo da história. Entidades administrativas e de infraestrutura ficam no diagrama separado abaixo. `Suggestion` é o catálogo reutilizável de sugestões da história. A publicação aparece pontilhada porque é um pacote derivado, fora da sincronização incremental.

```mermaid
graph LR
    users --> story

    story --> characters
    story --> gallery
    story --> chapters
    story --> locations
    story --> world_rules
    story --> notes
    story --> tags
    story --> items
    story --> modes
    story --> stats
    story --> stat_strengths
    story --> stat_relations
    story --> story_schema_fields
    story --> attribute_values
    story --> comments
    story --> see_also_relations
    story --> favorites
    story --> effects
    story --> suggestions
    story --> operation_log
    story -. immutable publication .-> story_publications

    chapters --> scenes
    locations -- occurs on --> scenes

    scenes -- source --> choices
    choices -- target next_scene_id --> scenes
    choices --> choice_check_groups
    choice_check_groups --> choice_checks
    scenes --> effects
    choices --> effects
    choice_checks -- scene/item condition --> scenes
    choice_checks -- item condition --> items
    effects -- grants/takes --> items

    tags -- via tag_relations (polymorphic) --> chapters/scenes/characters/locations/items/notes/world_rules
    notes -- via note_relations (polymorphic) --> chapters/scenes/characters/locations/items/world_rules
    gallery -- via gallery_relations (polymorphic) --> chapters/scenes/characters/locations/items/notes

    characters --> character_relations
    character_relations --> characters

    characters --> character_scenes
    character_scenes --> scenes

    locations --> location_relations
    location_relations --> locations

    items --> item_journeys
    item_journeys -- occurs on --> scenes
    item_journeys -- may reassign owner --> characters

    characters --> modes
    characters --> stat_relations
    modes -- optional override --> stat_relations
    stats --> stat_strengths
    stats --> stat_relations

    comments -- fieldId --> story_schema_fields
    comments -- fieldKey or entityType/entityId --> chapters/scenes/characters/locations/items/item_journeys/notes/tags/world_rules/choices
    see_also_relations -- reciprocal --> characters/locations/chapters/scenes/items/item_journeys/world_rules/choices
    favorites -- user marks --> story/characters/chapters/locations/scenes/notes/world_rules/items/gallery/tags

    story_schema_fields -- defines custom fields for --> attribute_values
    attribute_values -- value for entityType+entityId --> characters/locations/items/scenes/chapters/notes/world_rules
```

### Diagrama de Entidades Administrativas e do Servidor

> Este diagrama separa administração, configuração do servidor, auditoria e publicação do grafo narrativo. Onde uma relação alcança conteúdo da história, ela aponta para o nó **Diagrama de história** sem repetir suas entidades internas.

```mermaid
graph LR
    users[Usuário]
    tiers[Tier]
    registration_settings[Configuração de cadastro]
    recovery_codes[Códigos de recuperação]
    api_logs[Logs da API]
    showcase_settings[Configuração do Showcase]
    media_storage_settings[Configuração de mídia]
    showcase_entry[Publicação da história no Showcase]
    publication[Versão publicada]
    story_diagram[Diagrama de história]

    users -- pertence a / recebe limites --> tiers
    registration_settings -- tier padrão --> tiers
    users -- possui --> recovery_codes

    api_logs -- pode referenciar --> users
    api_logs -- pode referenciar --> story_diagram

    showcase_settings -- habilita --> showcase_entry
    media_storage_settings -- define destino de blobs para --> story_diagram

    story_diagram -- pode ter --> showcase_entry
    showcase_entry -- proprietário --> users
    showcase_entry -- reúne versões --> publication
    publication -- proprietário no momento da publicação --> users
    publication -- snapshot de --> story_diagram
```

## 🔗 Fluxo de Arquitetura

- **API** (`apps/api`)
  - Elysia (Bun) expõe rotas REST/JSON.
  - Zod valida inputs/outputs.
  - Drizzle manipula DB.
  - ULID gera IDs.
  - Engine de Sincronização (op-based replication)

### Estratégia de Resolução de Conflitos

O comportamento vigente está em `docs/conflict_resolution_client_strategy.md`. Resumo:

*   **OCC por `version` da entidade.** Update exige `changes.version` (a base lida pelo cliente). Comparação é de igualdade, não `<`. Omitir a base **não** é last-write-wins: o push 422.
*   **Campos diferentes da mesma entidade** são mesclados automaticamente. O mesmo campo, com valores diferentes, vira um conflito para o usuário (`SyncConflictService`).
*   **Exclusão vs. edição** não se resolve sozinha: a tela oferece restaurar, aceitar o tombstone ou reenviar o delete local. Tombstones usam `isDeleted` / `deletedAt`.
*   **Writer ≠ owner.** Só o dono apaga a história ou muda `userId` / `type` / `favoriteBehavior` / `allowReaderComments`. O cliente recusa as mesmas mutações localmente (`assertStoryIsOwned` / campos de política em `StoryService.updateStory`) para não enfileirar um push que o servidor recusaria para sempre.
*   O log de operações retransmite o payload sanitizado (o que o servidor gravou), não o JSON cru do cliente.

### Estratégias de Armazenamento de Atualizações para Sincronização

*   **Histórias ligadas a um servidor:** o log local guarda as operações ainda não aceitas (`isSynced = false`) e as já sincronizadas (auditoria / eco do pull). Não há poda automática das aceitas.
*   **Histórias só locais:** o mesmo log existe para a tela de operações; não há teto de 500 entradas implementado.

### Mecanismo Detalhado de Sincronização

1.  **Formato (`StoryUpdate`):** união Zod em `packages/shared/schemas/SyncSchemas.ts`. Create leva `id` (ULID do cliente) + `data`. Update leva `id` + `changes` com `changes.version` obrigatório. Delete leva `id` e, para entidades filhas, `version`. Reorder leva `reorderItems`.
2.  **Rastreamento:** cada mutação nos services de `storymanagement/` chama `recordLocalOperation` *depois* da escrita local. O payload de update/delete/reorder inclui a versão *resultante*; o motor deriva a base como `version - 1`.
3.  **Protocolo:** REST `POST /sync/:storyId` (push, até 200 ops) e `GET /sync/:storyId/pull` (páginas de até 500). WebSocket (`/events`) só notifica que há trabalho novo; o ciclo em si continua sendo pull/push HTTP. JWT + refresh.
4.  **Autorização:** `owner` / `writer` / `reader`. Reader só escreve Favorite próprio e, se permitido, Comment próprio.
5.  **Bootstrap:** história local sobe por `POST /stories/import`. História remota desce por `GET /stories/:id/export` + import local. O sync incremental começa depois do vínculo.
6.  **Mescla:** campos disjuntos no pull e na resposta de `version_conflict` (`changedFields`). Mesmo campo → folha de revisão no painel. Reorder disputa a ordem inteira.
7.  **Lote:** não é tudo-ou-nada. Cada operação é aplicada e registrada sozinha; a resposta lista `applied` e `conflicts`. O cliente só marca `isSynced` o que veio em `applied`.
8.  **Cursor:** `lastServerSyncedLog` avança só até a última operação remota realmente aplicada. Uma falha no meio da página não pula aquela operação.
9.  **Mídia:** bytes sobem/descem por `/media` depois dos metadados. Um hash já existente no storage só pode ser ligado a uma história que já o referencia.

- **Frontend** (`apps/client`)
  - Desenvolvido com React Native, Expo e React Native Web para uma base de código unificada (mobile nativo e web/desktop a partir do mesmo código).
  - Opera de forma offline-first utilizando **Drizzle ORM sobre expo-sqlite** como banco local (SQLite nativo em mobile/desktop; wa-sqlite/WASM + OPFS no navegador).
  - Sincroniza automaticamente com a API remota via o engine de sincronização.

### Configuração de Ambiente

O Keres adota uma abordagem offline-first, onde a configuração de ambiente para o banco de dados é adaptada para suportar tanto o uso local (SQLite) quanto a conexão com um servidor remoto (PostgreSQL).

#### Variável `DATABASE_URL`

A string de conexão para o banco de dados é a principal forma de configurar a persistência.

*   **Para uso local (offline-first):** O cliente usará um banco de dados SQLite local.
*   **Para conexão ao servidor:** O servidor se conectará a um banco de dados PostgreSQL (ex: `postgres://user:password@localhost:5432/keres_db`).

#### Variável `JWT_SECRET`

O segredo usado para assinar e verificar JSON Web Tokens (JWTs) é configurável:

*   **Para o servidor:** Recomenda-se um segredo forte e aleatório, gerenciado com segurança.
*   **Para o cliente (offline-first):** Pode ser um segredo fixo ou gerado na primeira execução, usado para verificações de tokens locais.

#### Exemplo de Arquivos `.env`

Você pode usar arquivos `.env` para gerenciar essas variáveis de ambiente.

**`.env` para o Servidor:**

```dotenv
DATABASE_URL=postgres://seu_usuario:sua_senha@seu_host_db:5432/seu_db_nome
JWT_SECRET=seu_segredo_jwt_forte_para_online
JWT_SECRET_REFRESH="seu_segredo_jwt_forte_para_online_refresh"
ROOT_ADMIN_USERNAME="root"
ROOT_ADMIN_PASSWORD="password"
```
---

## 🏗️ Marcos Já Concluídos

Esta seção era originalmente uma lista de próximos passos, escrita antes de qualquer implementação. Todos os itens abaixo já foram concluídos - mantidos aqui só como referência histórica de escopo, não como trabalho pendente:

- ~~Definir migrations no `packages/db` (Drizzle).~~ Migrations vivem em `apps/api/src/db/` (Postgres) e `apps/client/src/db/` (SQLite local) - não existe `packages/db`.
- ~~Criar contratos Zod no `packages/shared`.~~
- ~~Implementar rotas CRUD base (users, stories, characters).~~ CRUD completo para todas as entidades listadas na seção "Estrutura de Dados", não só as três originais.
- ~~Desenvolver o engine de sincronização.~~ Ver `apps/api/src/services/entity-sync-handlers/` e `apps/client/src/services/SyncEngineService.ts`/`entity-sync-handlers/`.
- ~~Criar app desktop com SQLite integrado (Tauri/Electron).~~ Electron, empacotando o build web do client (SQLite via expo-sqlite/OPFS, não um binding nativo separado) - ver `docs/file_structure.md`.

Para o estado atual e trabalho em andamento, não há um roadmap mantido nesta pasta no momento - consultar o histórico de commits/branches do repositório.
