# Plano: atributo customizado do tipo Entidade (`AttributeType.ENTITY`)

Status: Implementado.
Branch base: `ouroboros`.

## 1. Objetivo

Adicionar um novo tipo ao sistema de custom attributes (`StorySchemaField`) que permite ao
usuário **selecionar uma entidade** em vez de digitar texto. O campo resultante:

- é preenchido por um **picker** no Form screen (não texto livre);
- é **clicável** na Detail screen, navegando para a entidade referenciada
  (mesmo comportamento das relações já existentes — ver `SeeAlsoManager`);
- continua **comentável** (`CommentableDetailField`, sem regressão);
- funciona em **todos os 7 tipos** que já suportam Story Schema
  (`Character`, `Location`, `Item`, `Scene`, `Chapter`, `Note`, `WorldRule`).

Tipos de entidade **selecionáveis** (alvo da referência), são os mesmos de Story Schema:
`Character`, `Location`, `Scene`, `Item`, `Chapter`, `Note`, `WorldRule`.

Como o sistema é online/sincronizado, a mudança precisa atravessar shared → client (SQLite +
migração) → API (Postgres + migração + sync handlers + export/import).

---

## 2. Decisões de design (e por quê)

### 2.1 O alvo é declarado **no campo**, não no valor

Novo campo em `StorySchemaField`: `targetEntityType: StorySchemaEntityType | null`.

Reusa `STORY_SCHEMA_ENTITY_TYPES` em vez de criar uma constante nova: com a lista de alvos
igual à lista de tipos que recebem Story Schema (os 7), uma segunda constante idêntica só
existiria para divergir em silêncio depois. Efeito colateral aceito e documentado: adicionar um
8º tipo ao Story Schema o torna automaticamente referenciável — e o requisito para isso é que
ele exista em `ENTITY_ROUTES` (`utils/entityNavigation.ts`), senão o campo não navega.

- `null` para todos os tipos existentes; obrigatório quando `type === ENTITY`.
- Imutável após a criação, exatamente como `key` e `entityType` já são — trocar o alvo
  invalidaria silenciosamente todo valor já salvo.

Alternativa descartada: guardar `"Character:<id>"` no `value` (padrão de
`encodeSeeAlsoValue`), o que tornaria o valor auto-descritivo e permitiria "qualquer tipo"
por campo. Descartada porque (a) o picker fica sem restrição e a UX piora numa história
grande, (b) a validação de análise/busca precisa saber o tipo alvo de antemão, (c) o campo
declarado permite navegar sem parse. Fica registrado como caminho de evolução caso um dia se
queira um campo "referência polimórfica".

### 2.2 `AttributeValue.value` guarda o ULID cru da entidade

Sem mudança de coluna nem de tipo — continua `text` nas duas bases, coerente com a razão
documentada em `packages/shared/utils/attributeValueCodec.ts` (uma única coluna de texto).
`decodeAttributeValue(ENTITY, v)` cai no `default` (string), mas ganha `case` explícito para
não depender de fallback.

### 2.3 Referência pendente (dangling) é permitida, não é erro

Hoje nada limpa `attributeValues` quando a entidade dona é soft-deletada (verificado: só
`AttributeValueService` e `GlobalSearchService` tocam a tabela). Manter a mesma postura:
apagar um Character referenciado **não** apaga o valor. A Detail screen mostra
`attribute_entity_deleted` e o campo deixa de ser clicável; a Análise da História levanta um
`warning` (§3.7). Isso evita cascatas polimórficas novas em 7 serviços de entidade.

### 2.4 `defaultValue` não se aplica a ENTITY

Um valor padrão apontando para uma entidade específica é quase sempre sem sentido e
complicaria o remapeamento de IDs no import/clone. O form esconde o input de valor padrão
quando `type === ENTITY` e grava `null`; o schema Zod recusa `defaultValue` não-nulo nesse caso.

---

## 3. Mudanças por camada

### 3.1 `packages/shared`

| Arquivo | Mudança |
|---|---|
| `metadata/AttributeType.ts` | `ENTITY = 'entity'` |
| `metadata/StorySchemaEntityType.ts` | só um comentário: a lista passa a ter um segundo papel (alvo de referência), e todo tipo listado precisa existir em `ENTITY_ROUTES` no client. Nenhuma constante nova — ver §2.1 |
| `entities/StorySchemaField.ts` | `targetEntityType: StorySchemaEntityType \| null` documentado como imutável |
| `schemas/StorySchemaFieldSchemas.ts` | campo novo usando o `StorySchemaEntityTypeSchema` já existente; `.nullable().default(null)` no `Create...`; `superRefine`: `type===ENTITY ⇒ targetEntityType != null && defaultValue == null`, `type!==ENTITY ⇒ targetEntityType == null` |
| `utils/attributeValueCodec.ts` | `case ENTITY` explícito (pass-through com `String(raw).trim()`); exportar `isEntityAttributeType(type)` para os call sites pararem de comparar string solta |
| `index.ts` | exportar o novo metadata/schema |

Testes: `test/utils/attributeUtils.test.ts` (codec ENTITY), novo teste de `superRefine`,
`test/schemas/FullStorySchemas.test.ts` (round-trip com o campo novo).

### 3.2 API — banco e sync

| Arquivo | Mudança |
|---|---|
| `apps/api/src/db/schema/tables/storySchemaFields.ts` | `targetEntityType: text('target_entity_type')` (nullable) |
| `apps/api/drizzle/0007_*.sql` | gerar com `bun run --cwd apps/api db:generate` (não escrever à mão) |
| `services/entity-sync-handlers/StorySchemaFieldSyncHandler.ts` | `create`: inserir `targetEntityType`; rejeitar `type==='entity'` sem `targetEntityType` (o Zod já pega, mas manter a checagem explícita como as outras deste handler). `update`: adicionar `targetEntityType` — **e `type`** — à lista de chaves removidas de `changes`, junto de `entityType`/`key`. Hoje `type` não é removido; a UI nunca oferece editar, mas com ENTITY a consequência de uma troca vira "todo valor vira um ULID órfão", o que justifica fechar a brecha agora. |
| `services/entity-sync-handlers/AttributeValueSyncHandler.ts` | **sem mudança.** O servidor não valida FK polimórfica em nenhuma outra tabela (`NoteRelation.relationId`, `GalleryRelation.ownerId`); introduzir validação só aqui criaria uma assimetria e um custo de query por update de sync. |

### 3.3 API — export/import (`StoryExportImportService.ts`)

Ponto mais delicado do plano. Hoje o bloco de `attributeValues` (fim do arquivo, ~linha 916)
remapeia `fieldId` e `entityId`, mas trata `value` como opaco. Para um campo ENTITY, `value`
**é um ID** e precisa passar pelo `idMap`, senão a história importada aponta para entidades da
história de origem.

Plano:

1. Antes do bloco de `attributeValues`, montar
   `entityFieldIds = new Set(storySchemaFields.filter(f => f.type === 'entity').map(f => f.id))`
   a partir do bundle validado (os campos são inseridos logo acima, então os IDs originais
   ainda estão à mão).
2. No `map`, quando `entityFieldIds.has(original.fieldId)`:
   `value = original.value ? (idMap.get(original.value) ?? null) : null`.
3. **Não lançar** quando o alvo não está no `idMap` — vira `null`. É o mesmo caso da §2.3
   (referência para entidade apagada/não exportada), e diferente de `fieldId`/`entityId`, que
   são estruturais e continuam lançando.
4. Ordem já está correta: `attributeValues` é o último bloco de entidade, todos os 7 tipos
   alvo já estão no `idMap`.

Export (`exportStory`) não muda — já leva `storySchemaFields` e `attributeValues` inteiros, e
a coluna nova entra pelo `findMany` sem seleção explícita.

Teste: round-trip de export→import com um campo ENTITY apontando para um Character, mais um
caso com alvo ausente do bundle (espera `null`, não exceção).

### 3.4 Client — banco

| Arquivo | Mudança |
|---|---|
| `src/db/schemas/storySchemaFields.ts` | `targetEntityType: text('target_entity_type')` |
| `src/db/migrations/0006_*.ts` **(novo)** | `ALTER TABLE story_schema_fields ADD COLUMN target_entity_type text;` — SQLite aceita `ADD COLUMN` nullable sem recriar a tabela |
| `src/db/migrations/index.ts` | regenerado pelo `generate-migrations-index.js` (roda no `prestart`); o arquivo já aparece modificado no working tree, conferir antes de commitar |
| `services/storymanagement/StorySchemaFieldService.ts` | `createField` propaga `targetEntityType`; `updateField` continua sem tocar nele |

### 3.5 Client — picker: estender `GroupedMultiSelectPill`

Base escolhida: **`GroupedMultiSelectPill`** — o picker da Galeria (`GalleryDetailContent`) e
do "Veja também" (`SeeAlsoManager`). Ele já é um seletor de entidade em dois passos
(tipo → entidade), com busca por texto dentro do grupo, contagem por tipo, ícone por tipo e
estado vazio tratado. `LocationPickerModal` foi considerado e descartado: é
`LocationSelect`-específico, não tem busca, e usá-lo como base significaria reescrever busca +
gatilho do zero — mais código novo, não menos.

O que falta nele para o caso de uso, e como resolver (tudo aditivo, os 2 call sites atuais não
mudam):

1. **Seleção única.** Nova prop `singleSelect?: boolean` (default `false`). Com ela,
   `toggleOption` substitui a seleção por `[value]` em vez de acumular, e fecha o modal ao
   escolher. Tocar no item já selecionado devolve `[]` — é o "limpar seleção" de graça, sem UI
   nova. O gatilho renderiza uma pill só; ícone de `add-circle` vira `chevron-down`.
2. **Grupo único.** Como `targetEntityType` é fixo por campo, a lista de grupos teria um item
   só e custaria um toque a mais. Quando `groups.length === 1`, entrar direto no grupo
   (`activeGroupKey` inicial) e esconder o botão de voltar. É melhoria genérica, não gambiarra
   para este caso.
3. **Codificação de valor.** Os `value` são strings opacas para o componente — os hooks atuais
   usam `"Tipo:id"`, mas aqui passamos o ULID puro (§2.2). Zero mudança no componente.

Novo `components/common/inputs/EntityPickerInput/EntityPickerInput.tsx`: fininho, envolve o
`GroupedMultiSelectPill` em `singleSelect` com um grupo só (o `targetEntityType`), converte
`string[] ↔ string | null`, e é o que `AttributeValueInput` e `AdvancedSearchModal` renderizam.

Novo `utils/entityOptions.ts`: `loadEntityOptions(db, storyId, entityType)` devolvendo
`{id, name}[]`. A tabela sai de `getEntityTable` e a coluna de nome de
`globalSearchFieldConfig[T].titleField` (`name` para Character/Location/Scene/Item/Chapter,
`title` para Note/WorldRule) — os dois já existem, nenhum mapeamento novo. Hoje esse par
tabela/coluna está escrito à mão dentro de `useSeeAlsoEntityOptions`; extrair e fazer aquele
hook consumir o helper mantém uma fonte só, e é o mesmo par que a busca global usa (§3.7.1).

Novo `hooks/useEntityPickerOptions.ts`: envolve o helper com estado/loading para o input.

`LocationPickerModal`/`LocationRelationManager` ficam **como estão** — são "escolher um
candidato de uma lista já pré-filtrada por regra de ciclo/parentesco", interação diferente da
de um campo de formulário. Consolidar os dois é um refactor à parte, não desta feature.

Observação de performance (pré-existente, herdada): o modal lista as opções num `ScrollView`,
não num `FlatList` — numa história com centenas de personagens ele monta tudo de uma vez.
Já vale hoje para Galeria/Veja também. Trocar por `FlatList` é contido e pode entrar junto,
mas afeta os 2 call sites existentes; tratar como melhoria opcional, verificada com o app real.

### 3.6 Client — form, detail e navegação

| Arquivo | Mudança |
|---|---|
| `screens/storyschema/StorySchemaFieldFormScreen.tsx` | `Select` de "tipo de entidade alvo", visível só quando `type === ENTITY`, `disabled` em edição (igual ao Select de tipo); validação "obrigatório quando ENTITY"; esconder o `AttributeValueInput` de valor padrão quando ENTITY |
| `components/common/forms/CustomAttributeFields/AttributeValueInput.tsx` | nova prop `targetEntityType?`; `case AttributeType.ENTITY` → `EntityPickerInput` (fallback para `TextInput` desabilitado se vier sem `storyId`/`targetEntityType`, mesmo padrão defensivo do `case SUGGESTION`) |
| `components/common/forms/CustomAttributeFields/CustomAttributeFields.tsx` | repassar `targetEntityType={field.targetEntityType}` |
| `components/common/display/DetailField/DetailField.tsx` | prop opcional `onPress`; quando presente, valor renderiza em `colors.primary` dentro de `TouchableOpacity` com `chevron-forward` — mesmo tratamento visual das linhas de `SeeAlsoManager` |
| `components/features/comments/CommentableDetailField/CommentableDetailField.tsx` | repassar `onPress` para o `DetailField` interno (nos dois caminhos: com e sem botão de comentário). É o que preserva "clicável **e** comentável" |
| `components/common/forms/CustomAttributeFields/CustomAttributeDetailFields.tsx` | para campos ENTITY: resolver o nome da entidade referenciada e navegar ao tocar |
| `utils/entityNavigation.ts` | **sem mudança** — os 7 tipos alvo já estão em `ENTITY_ROUTES` (verificado: inclui `Chapter`, `Note` e `WorldRule`) |

Detalhe de `CustomAttributeDetailFields`:

- no mesmo `fetchValues` já existente, depois de carregar os valores, resolver em lote os nomes
  dos campos ENTITY. Reusar `EntityService.getEntityIdentifier(db, type.toLowerCase(), id,
  storyId, t)`, que já devolve **só o nome** (diferente de `useEntityName`, que devolve
  `"Tipo - Nome"`, formato errado para um valor de campo);
- `displayValue` = nome resolvido, ou `t('attribute_entity_deleted')` quando não resolve;
- `onPress` só quando resolveu, chamando `navigateToEntityDetail(navigation.getParent(), ...)`
  — mesmo trecho de `SeeAlsoManager.handlePress`;
- `contentSnapshot` do comentário passa a ser o nome resolvido (não o ULID), preservando a
  utilidade do snapshot no histórico de comentários.

### 3.7 Client — busca, análise e log

| Arquivo | Mudança |
|---|---|
| `packages/shared/metadata/entityFields.ts` | novo `FieldType` `'entity'` + campo opcional `entityTargetType?` em `EntityFieldMetadata` |
| `utils/customAttributeFieldMetadata.ts` | ENTITY → `type: 'entity'`, `entityTargetType: field.targetEntityType`. (Mapear para `'string'`/`'id'` faria a Busca Avançada pedir um ULID digitado — inaceitável.) |
| `components/common/modals/AdvancedSearchModal/AdvancedSearchModal.tsx` | `case 'entity'` no switch de renderização → `EntityPickerInput` (o mesmo componente da §3.5, sem custo extra) |
| `utils/attributeSearchPredicate.ts` | `case ENTITY` → `eq(attributeValues.value, String(rawValue))`, comparação exata; hoje cairia no `LIKE %...%`, que é errado para ID |
| `services/storymanagement/GlobalSearchService.ts` | casar pelo **nome da entidade referenciada**, não pelo ULID — ver §3.7.1 |
| `utils/storyAnalysisChecks.ts` | em `checkStorySchema`, para campo ENTITY: se `raw` não-nulo e o ID não existe no `entitiesByType[field.targetEntityType]`, emitir `warning` `analysis_attribute_entity_missing`. O input já carrega as 7 coleções de entidades e os `attributeValues`; falta levar `targetEntityType` em `AnalysisStorySchemaField` |
| `services/storymanagement/StoryAnalysisService.ts` | selecionar `targetEntityType` ao montar o input da análise |
| `services/EntityService.ts` | no `case OperationLogEntityType.AttributeValue`, quando o campo é ENTITY, resolver o ULID para nome via `_resolveRelationEntityName` antes de montar `attribute_value_attributed_to_entity` — senão o log de operações mostra um ULID cru |
| `exampleStories/cloneExampleStory.ts` | no `map` de `attributeValues`, remapear `value` quando o campo é ENTITY (mesma lógica da §3.3, com o `idMap` local); `storySchemaFields` já passa `targetEntityType` pelo spread |

`SuggestionService` não precisa de mudança: `getValueUsageCounts` só é chamado no ramo
`custom:<fieldId>` de campos SUGGESTION.

#### 3.7.1 Busca global casa pelo nome da entidade referenciada

O que o usuário vê no campo é o **nome** da entidade (§3.6) — é por esse nome que ele vai
procurar. Buscar "Aragorn" tem que trazer o Character cujo atributo "Mentor" aponta para
Aragorn, e o snippet tem que dizer `Mentor: Aragorn`, não `Mentor: 01HXYZ...`.

`useEntityName` é o precedente de comportamento, mas não é reusável aqui: é um hook React, uma
entidade por vez. Numa busca global isso seria N+1 queries por resultado. A mesma resolução é
feita em SQL, com join — resultado idêntico ao que a tela mostra, num único statement por tipo.

O bloco `attributeQuery` (hoje uma query só) vira dois caminhos que alimentam o mesmo `Map` de
resultados:

1. **Campos de texto** — a query atual, com `ne(storySchemaFields.type, 'entity')` adicionado ao
   `where`. Campo ENTITY sai daqui porque casar substring contra ULID só gera ruído; o caminho
   dele é o (2).
2. **Campos ENTITY** — primeiro carrega os campos `type='entity'` da história
   (`id`, `name`, `targetEntityType`). Se não houver nenhum, o caminho inteiro é pulado (custo
   zero para as histórias que não usam a feature). Havendo, agrupa por `targetEntityType` e roda
   uma query por tipo alvo em uso: `attributeValues` ⋈ tabela alvo em
   `attributeValues.value = alvo.id`, filtrando por `fieldId IN (campos daquele alvo)`,
   `alvo.isDeleted = false` e `alvo.<titleField> LIKE %termo% COLLATE NOCASE`.
   A tabela vem de `getEntityTable`, a coluna de nome de `globalSearchFieldConfig[T].titleField`
   — nenhum mapeamento novo. Mesmo `ATTRIBUTE_RESULT_LIMIT` do caminho (1).

O trecho final do bloco (resolver o título da entidade **dona**, respeitar o
`results.has(key) → continue` que dá precedência ao match de campo nativo, montar o
`GlobalSearchResult`) é genérico e passa a ser um helper compartilhado pelos dois caminhos,
recebendo linhas no formato `{ entityType, entityId, fieldName, displayValue }` — em (1)
`displayValue` é o valor cru, em (2) é o nome da entidade referenciada. Sem duplicar o
tratamento de dedup/título.

Custo: no máximo uma query extra por tipo alvo efetivamente usado, dentro do `Promise.all` que
já existe, e zero quando a história não tem campo ENTITY.

### 3.8 i18n, help e docs

`apps/client/src/locales/{en,pt}.json` — chaves novas:
`attribute_type_entity`, `attribute_target_entity_type`, `attribute_target_entity_type_hint`,
`attribute_target_entity_type_required`, `attribute_entity_select_placeholder`,
`attribute_entity_search_placeholder`, `attribute_entity_clear`, `attribute_entity_none`,
`attribute_entity_deleted`, `analysis_attribute_entity_missing`.
Rodar `bun run --cwd apps/client locales:audit` no fim.

`src/help/content/custom-attributes/{en,pt}.ts` — seção sobre o tipo Entidade: para que serve,
que o alvo é fixado na criação, que apagar a entidade referenciada deixa o campo "vazio" em vez
de apagar o atributo. Conferir `src/help/catalog.ts`/`fieldSources.ts` e o índice gerado
(`bun run --cwd apps/client help:generate`) — o teste de help do client valida o índice.

`docs/` — sem arquivo dedicado hoje para custom attributes; não criar um só por isso.

---

## 4. Ordem de execução sugerida

1. **shared**: enum, metadata do alvo, entidade, schemas Zod, codec, exports + testes.
2. **API**: coluna, `db:generate`, sync handler, export/import + testes (inclui integração).
3. **client/db**: coluna, migração `0006`, `StorySchemaFieldService`.
4. **client/picker**: `singleSelect` + grupo-único no `GroupedMultiSelectPill`,
   `utils/entityOptions.ts`, `useEntityPickerOptions`, `EntityPickerInput`. Conferir que
   Galeria e "Veja também" continuam idênticos (as props novas são opcionais).
5. **client/form**: `StorySchemaFieldFormScreen`, `AttributeValueInput`, `CustomAttributeFields`.
6. **client/detail**: `DetailField`, `CommentableDetailField`, `CustomAttributeDetailFields`.
7. **client/transversal**: busca avançada, predicate, global search, análise, `EntityService`,
   `cloneExampleStory`.
8. **i18n + help**.
9. `bun run typecheck` → `bun run lint` → `bun run test:report` → `bun run test:integration`.

Passos 1–3 são o "esqueleto online" e devem ir juntos: um client atualizado falando com uma API
sem a coluna faz o sync perder `targetEntityType` silenciosamente.

---

## 5. Compatibilidade e migração

- **Coluna nullable, sem backfill.** Campos existentes ficam com `target_entity_type = NULL`,
  que é exatamente o valor válido para os 6 tipos antigos.
- **Client antigo × API nova**: cliente antigo nunca cria campo `entity`, nunca envia a coluna;
  o `Partial` schema a trata como opcional. Sem quebra.
- **Client novo × API antiga**: o insert do handler antigo ignora `targetEntityType` e o campo
  volta do pull sem alvo → o Detail cai em "referência inválida". Não corrompe dados, mas é
  motivo para subir API antes de publicar o client.
- **Stories exportadas antes da feature**: importam sem mudança (campos opcionais).
- **`unique(storyId, entityType, key)`** não é tocada.

## 6. Riscos e pontos de atenção

1. **`value` deixa de ser opaco no import/clone.** É o único lugar onde o texto de um
   `AttributeValue` vira um ID que precisa de remap. Se esquecido, a história importada aponta
   para entidades de outra história — falha silenciosa, sem erro. É o item que mais merece teste.
2. **Ordem dos blocos no import.** `attributeValues` tem que continuar depois de todos os 7
   tipos alvo. Já é o caso; o comentário existente no arquivo deve ser atualizado para
   mencionar também o `value`.
3. **Referência cruzando histórias.** O picker só lista entidades da `storyId` corrente, então
   não há caminho de UI para isso; nada valida no servidor (coerente com §3.2).
4. **`type` mutável no update de sync** é uma brecha pré-existente que esta feature transforma
   em risco real (§3.2) — fechar junto.
5. **`ScrollView` em vez de `FlatList`** dentro do picker (§3.5): risco de performance
   pré-existente que esta feature amplia, já que o campo pode aparecer em toda entidade de toda
   Detail/Form screen.

Não é risco: o terceiro call site do `GroupedMultiSelectPill`. A mudança é "um modo de seleção
única" ao lado do múltiplo, com props opcionais — coberta pelos testes do componente (§7).

## 7. Cobertura de testes prevista

- `packages/shared`: codec ENTITY; `superRefine` (ENTITY sem alvo, não-ENTITY com alvo,
  ENTITY com `defaultValue`); `FullStorySchemas` com a coluna nova.
- `apps/api`: `StorySchemaFieldSyncHandler` (create com alvo; update ignorando
  `type`/`targetEntityType`); `StoryExportImportService` (remap de `value`; alvo ausente → null).
- `apps/client`: `GroupedMultiSelectPill` em `singleSelect` (troca em vez de acumular, fecha ao
  escolher, re-tocar limpa) e com um grupo só (entra direto, sem botão de voltar);
  `customAttributeFieldMetadata` (ENTITY → `'entity'` + `entityTargetType`);
  `attributeSearchPredicate` (igualdade exata); `GlobalSearchService` (buscar pelo nome da
  entidade referenciada acha a entidade dona, com snippet `Campo: Nome`; o ULID **não** casa;
  história sem campo ENTITY não dispara query extra); `storyAnalysisChecks` (referência quebrada);
  `cloneExampleStory` (remap); render de `CustomAttributeDetailFields` (clicável quando
  resolve, texto de apagado quando não, botão de comentário presente nos dois casos).
