# Scene Editor — plano do projeto

Modo de escrita por cena no Keres: cada cena ganha um corpo de manuscrito
editável numa tela dedicada (drawer Editor), com WIP local, sync via
infraestrutura existente e exportação por cena/rota.

Status geral: **fases 0–4 entregues** (fundação + editor por cena +
manuscrito + exportação DOCX/PDF/Markdown/texto). Pendente só verificação
manual em aparelho (impressão PDF, share sheets, abertura em Word/
LibreOffice) e instrumentação de performance. Detalhe em `.agents/plans/
2026-09-20-scene-editor-mvp.md`.

## 1. Decisões de dados

### 1.1 Corpo do texto: coluna `scenes.body`, não nova entidade

- `scenes.body TEXT NULL` no servidor (Postgres + SQLite) e no cliente,
  `body: string | null` em `Scene` (`packages/shared/entities/Scene.ts`).
- Herda de graça: update parcial via `updateScene` + `getChangedFields`,
  validação via `PartialSceneSchema`, OCC por `version`, `applyUpdate`
  genérico no cliente.
- Entidade Sync 1:1 rejeitada: exigiria handler servidor + cliente, registro,
  tipo no enum, export/import e testes, para ganho quase nulo. Único
  argumento a favor era isolar o contador `version` (colisões
  texto-vs-metadados); mitigado salvando só `{body}` e usando o fluxo de
  conflito existente. Reavaliar só se colisões se mostrarem frequentes.

### 1.2 Teto: 30.000 caracteres por cena (inclui markdown)

Dados reais: cena típica 1.000–3.000 palavras (~6–18k chars); cena grande
3.000–4.000 (~18–26k); capítulo padrão 2.000–4.000 palavras. 30k ≈ 5.000
palavras ≈ capítulo "muito longo" — generoso sem ser absurdo. Overhead de
markdown (negrito/itálico) fica bem abaixo de 10% em prosa normal.

- Fonte única: `body: z.string().max(30000).nullable()` no schema
  compartilhado (`SceneSchemas.ts`) — protege cliente, servidor e sync.
- UI deve mostrar contador (X / 30k); quem bater no teto recebe a sugestão
  de dividir a cena (bom conselho de escrita + combina com o modelo do app).

### 1.3 Formato: markdown puro no MVP

Negrito/itálico/títulos/diálogo via markdown; recuo de primeira linha é
decisão de **render/export** (CSS `text-indent`, indent no template DOCX),
não de armazenamento. JSON estruturado (TipTap/ProseMirror) só se v2
precisar de comentários inline ou blocos especiais — exige bump de versão
de export.

## 2. WIP local: tabela `editor_drafts` (client-only, planejada)

Substitui/unifica o que boards (`boardDraftStore` + `canvasDraftPersistence`)
e location maps fazem hoje com AsyncStorage + memória:

- SQLite, **fora** do registry de sync, do export e do operation log.
- Colunas: `id, storyId, entityType, entityId, field, content TEXT, updatedAt`.
- `content` guarda markdown (cenas) ou JSON serializado (canvas) — um
  mecanismo só, com purge por história e listagem (melhor que AsyncStorage,
  que ainda tem quota de ~6 MB no Android).
- Fluxo do editor: digitação → debounce ~400ms no draft; Save explícito →
  `updateScene({body})` + limpa draft. Nome `editor_drafts` preferido a
  `memory_drafts` (é SQLite durável, não memória).
- Migração de boards/location-maps para a tabela: depois do MVP.

## 3. Contenção de crescimento do operation log

### 3.1 Retenção no cliente (FASE 0 — implementar agora)

Regra do projeto original, perdida no caminho (não existe no código; a UI
só pagina de 20 em 20): por história, manter **os últimos 100 ops
sincronizados + todos os não-sincronizados**. Refinamento: nunca podar ops
com `conflictState` (`conflicted`/`abandoned`) — são evidência de conflito.
Alvo da poda: `isSynced=true AND conflictState IS NULL` além dos 100 mais
novos (ordenar por `operationVersion`, não `createdAt` — timestamp SQLite
só tem precisão de segundo). Executar como trim após push bem-sucedido.

### 3.2 Squash no servidor (FASE 0 — implementar agora)

Substituir cadeias de `update` da mesma entidade por **uma** linha de
versão = max, payload = estado final fundido + `{squashedFrom}`.

- Seguro contra cursores ("squashei 10–20, pediram 14+"): updates são
  *state-based* (valor final por campo), então aplicar a linha 20 sobre
  cursor 13 é correto; pull filtra `version > cursor` e nunca assume
  contiguidade. Buracos na sequência são inofensivos.
- **Só fundir cadeias de `update`; nunca atravessar `create`/`delete`/
  `reorder`.**
- Só cadeias com mais de X dias; manter os últimos K ops por entidade
  intactos (granularidade recente p/ revisão de conflito).
- `getChangedFieldsSinceVersion` pode super-reportar um campo (o auto-merge
  já trata coincidência de valor); AdminRecovery exibe 1 entrada "squashed".

### 3.3 Futuro (não fazer agora)

- **Coalescência no push** (só cliente): fundir ops pendentes por entidade
  antes de montar o lote. Hoje o push envia tudo (até 200/lote × 50 lotes);
  `mergeLocalOperationPayloads` só serve ao conflito. Mata o caso
  "30 saves offline = 30 corpos no fio".
- **gzip no transporte** (`@fastify/compress`): prosa encolhe ~70-80%.
- **Lotes por bytes + bissecção no 413**: estimar tamanho do lote; se o
  servidor recusar com 413, dividir ao meio recursivamente. (Não reusar
  `limit_exceeded` — ele significa limite de *plano*.)
- **Diff estilo git rejeitado para o MVP**: economizaria só o histórico (a
  linha atual continua cheia), ao custo de um mini-OT no servidor (aplicar
  patch, fallback p/ estado cheio, pull com gaps, recovery de cadeias de
  patch, UX de conflito legível). Revisitar só se storage doer após 3.1+3.2.

## 4. UI do editor (entregue)

- `SceneEditorScreen`: tela dedicada (não o form de resumo) com toggle no
  header **Escrever / Ler / Revisar**. Entradas: ação `document-text` no
  header do detalhe da cena + cartão "Manuscrito" (trecho + indicador de
  rascunho) sob o resumo.
- Escrever: `SceneBodyEditor` (input tela cheia) + `SceneBodyToolbar` fixa
  (negrito/itálico/sublinhado/títulos via `applyManuscriptFormat`) +
  `SceneBodyFooter` fixo (rascunho/contador/Save) + hook `useSceneBodyDraft`
  (snapshot de um campo sobre `useDurableFormDraft`, campo `body`). Ler:
  `MarkdownPreview` (parser mínimo próprio com `**`/`*`/`__`/`#`, sem
  dependência, texto selecionável). Revisar: threads de `Comment` da cena
  na chave `body` via `CommentThreadModal` — zero nova entidade.
- Toggle de modo e ações de header seguem o padrão `BoardCanvasHeaderActions`
  (ícones Ionicons 24, `primary` quando ativo).
- Seamless por construção: editor e preview compartilham
  `manuscriptTextMetrics` (fonte/tamanho/line-height/padding); `TextInput`
  borderless troca in place com o preview; Escrever/Ler dividem um
  `ScrollView` que preserva o offset.
- Comentário inline ancorado em trecho: v2 (o campo `excerptText` do
  comentário já permite citar o trecho manualmente).

### 4.1 Texto longo e virtualização (como ficou)

- Virtualização no nível da **seção do manuscrito** (`FlatList` de cenas),
  não dentro do preview: `MarkdownPreview` renderiza blocos em Views
  simples (teto 30k limita o pior caso) para evitar `FlatList` aninhada.
- Edição: `TextInput` nativo + teto 30k; um único input montado por vez
  (seção expandida). "Janela deslizante": proibida (mantido).
- Busca própria com contador + anterior/próximo + `scrollToIndex`
  (sem highlight intra-preview no MVP).
- Editor por blocos: só com evidência de lag em aparelho fraco (mantido).

### 4.2 Manuscrito (telas juntas — lacuna fechada)

- `ManuscriptScreen` (botão `book-outline` no header da lista de elementos
  narrativos): todas as cenas em sequência com separação por cena, espelhando
  o padrão `RouteReaderScreen` (título tocável → detalhe).
- Linear: capítulos por `index` com suas cenas, depois containers de evento,
  depois seção "sem capítulo". Branching: seletor de rota + `routeSteps`
  (sem validação de travessia — ler prosa não valida execução).
- Sem edição inline: título da cena → detalhe, lápis ao lado → tela dedicada
  de edição; corpo selecionável sem cliques. Modo leitura pura (olho no
  header) esconde títulos/botões e pula cenas vazias. Divisórias: capítulos
  full-bleed, entre cenas recuada e sutil.
- Dados via hook próprio `useManuscriptData` (containers todos os tipos +
  cenas + choices + rotas/steps, com refresh em `scene_changed` etc.):
  `useStoryRoutes` não servia (capítulos excluem eventos; carrega
  checks/effects desnecessários).

## 5. Branching e exportação (entregue)

- `manuscriptCompiler` puro (linear + por rota): blocos título/subtítulo/
  capítulo/cena/parágrafo/choice; um bookmark por cena (`scene-<id>`,
  primeira ocorrência vence em rotas com loop); choices órfãs degradam
  para nome sem referência.
- **Cenas avulsas = `chapterId` nulo OU capítulo `type: 'event`'**
  (`isLooseScene`, predicado confirmado contra `ChapterType.ts`). O
  manuscrito mostra tudo; o exportador linear tem switch "Incluir N cenas
  avulsas" (default incluir) com apêndice final. Em rotas os steps são
  explícitos (sem switch).
- DOCX via lib `docx`: headings, bookmarks, `PageReference` com hyperlink
  por choice ("vá para a página X" resolvido no Word/LibreOffice, nenhuma
  paginação no app), rodapé `PAGE/NUMPAGES`, recuo de primeira linha,
  sublinhado (`__`).
- Export segue o padrão `ImportExportScreen`: `AppAlert` encadeado (cenas
  avulsas → formato) + `showNotification` de sucesso/aviso/erro. Entrega:
  `Packer.toBase64String()` → bytes → `deliverFile` (reuso de
  `storyTransfer`, que ganhou `buildManuscriptFileName`).
- PDF via `expo-print` (`printToFileAsync` sobre template HTML próprio com
  TOC/âncoras/links internos): **limitação honesta** — a API não retorna
  mapeamento layout→página, então o PDF referencia destinos por nome de
  cena com link clicável, nunca por número de página. PDF indisponível na
  web (sem pipeline de impressão); lá o export oferece DOCX/MD/TXT.
- Markdown + texto puro saem do mesmo compilador (bônus + fallback).
- `scenes.body` viaja no pacote de história via `SceneSchema` (`.default
  (null)`, sem bump de formato).
- Spike de viabilidade: bundle ESM do `docx` sem imports node-core;
  `expo export -p web` (Metro) passa com as novas dependências.

## 6. Fases

- [x] **Fase 0 (fundação, feito):** retenção cliente (3.1) + `body`
      30k em shared/API/client/export (1.1+1.2) + squash servidor (3.2),
      cada um com teste mantido.
- [x] **Fase 1 (feito):** tabela `editor_drafts` + serviço de draft genérico
      (`EditorDraftService`, bound via `setEditorDraftDb` como `setAuthDb`).
- [x] **Migração antecipada (era Fase 4):** boards, location maps e secondary
      drafts de forms portados para `editor_drafts`, com adoção transparente
      (fallback de leitura) das chaves legadas em AsyncStorage. Sem UI ainda.
- [x] **Drafts primários de forms (extra):** hook genérico `useDurableFormDraft`
      (restore no mount, escrita debounced, flush no unmount, limpeza só no
      save/delete, guarda de stale via `updatedAt` em edição, chave `new` em
      criação). Piloto plugado no form de Local. Rollout para os outros 16
      forms: pendente (mecânico após o piloto).
- [x] **Corrida restore-vs-clear (investigada e corrigida):** expo-sqlite não
      garante ordem de conclusão (fila concurrent no iOS, pool IO no Android),
      então o hook agora só rastreia após o restore assentar. Prova em
      `useDurableFormDraft.sequencing.test.ts` (falhava 3/3 sem o gate).
- [x] **Botão reset no form de Local (piloto):** ação `arrow-undo-outline` no
      header via `useScreenHeader`, desabilitada quando pristine, com
      confirmação (`form_reset_*` em en/pt). Create volta ao branco, edit
      restaura os valores salvos; ambos apagam o draft sem desarmar o
      tracking (`deleteStoredDraft`). Filas secundárias mantêm o ciclo próprio.
- [x] **Rollout drafts+reset p/ 13 forms (feito):** Character, Scene, Chapter,
      Choice, Note, Item, Tag, Plot, Route, Stat, WorldRule, ItemJourney,
      StorySchemaField — todos com `useDurableFormDraft` + `clearFormDraft`
      no save/delete + botão de reset via hook compartilhado
      `useFormResetHeaderAction` (lógica de confirmação testada uma vez em
      `test/hooks/useFormResetHeaderAction.test.ts`; sem novas chaves de
      locale). Regras do rollout: (a) forms com prefill de create (Scene/
      Chapter/Choice/ItemJourney) compõem o pristine com o prefill — reset
      mantém o prefill e nenhum draft é escrito até digitar; (b) flags
      transientes que afetam edição (ex. `keyManuallyEdited` do schema
      field) entram no draft para o restore não mudar comportamento;
      (c) Story, Friendship e Pack ficaram DE FORA — Story já tem
      `useStoryIdentityDraft` próprio e os três vivem fora do escopo
      história (sem storyId estável para a chave). Cada form ganhou testes
      de draft no seu `useXFormState.test.ts` + asserts de clear no
      `useXFormActions.test.ts`; telas com captura de header ganharam
      testes de wiring do botão.
- [x] **Fase 2 (feito):** `SceneEditorScreen` (Escrever/Ler) + entradas no
      detalhe da cena + preview + contador/teto + `useSceneBodyDraft`
      sobre `editor_drafts` (campo `body`); `ManuscriptScreen` com lista
      virtualizada, busca própria e edição inline por seção.
- [x] **Fase 3 (feito):** modo Revisar (comments de cena na chave `body`,
      zero nova entidade); export linear com body (DOCX/PDF/MD/TXT).
- [x] **Fase 4 (feito):** export por rota com "vá para a página X" via
      `PAGEREF` + switch de cenas avulsas. Coalescência no push e gzip:
      continuam diferidos (só com medição de dor — ver 3.3).
      (Migração p/ `editor_drafts` já feita — ver acima.)
- [ ] **Verificação manual pendente (requer aparelho):** impressão PDF via
      `expo-print`, share sheets iOS/Android, abertura do DOCX em Word/
      LibreOffice (números `PAGEREF`), sensação de scroll/jank e do
      seamless em aparelho fraco.
- [ ] **Futuro incerto:** comentários inline (v2), editor por blocos (só
      com evidência), diff-sync (só se storage doer).

## 7. Lacunas conhecidas

- Teto exato de bytes do body HTTP no deploy (Fastify default ~1 MB;
  confirmar em produção antes de fixar expectativas de lote gigante).
- [x] Mapeamento fino da UI atual do detalhe da cena (fase 2) — feito.
- [x] Modelo completo de routes/routeSteps para o export (fase 4) — feito;
      predicado de avulsas resolvido (`chapterId` nulo ou capítulo-evento).
