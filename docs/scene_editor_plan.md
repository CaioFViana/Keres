# Scene Editor — plano do projeto

Modo de escrita por cena no Keres: cada cena ganha um corpo de manuscrito
editável numa tela dedicada (drawer Editor), com WIP local, sync via
infraestrutura existente e exportação por cena/rota.

Status geral: **fase 0 em implementação** (fundação de dados + contenção de
crescimento). UI do editor ainda não iniciada.

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

## 4. UI do editor (planejada, não iniciada)

- Botão "Escrever" no detalhe da cena → drawer/tela dedicada (não o form
  de resumo). Toggle no header: **Escrever / Revisar / Ler** (espírito do
  modo sugestão do Google Docs).
- MVP: Escrever (input + contador + draft), Revisar (comentários em nível
  de cena — reutilizar entidade Comment existente, sem inline), Ler
  (preview markdown).
- Comentário inline ancorado em trecho: v2 (modelo de âncora por offset
  com invalidação a cada edição — custo alto).

### 4.1 Texto longo e virtualização

- Leitura: preview markdown → blocos → `FlatList` virtualizada. 100%
  seamless, barato — fazer desde o dia 1.
- Edição: `TextInput` nativo + teto 30k (nessa faixa o desempenho é
  aceitável). Não virtualizar *dentro* do input (quebra IME/seleção).
- "Janela deslizante" num input único: proibido (saltos, clipboard/find
  quebrados).
- Busca própria (contador + anterior/próximo via selection/scroll), não
  find nativo.
- Editor por blocos (1 input por parágrafo): só com evidência de lag em
  aparelho fraco.

## 5. Branching e exportação

- Linear: compilar cenas por `index`/capítulo. Branching: compilar **por
  rota** seguindo `routeSteps` (telas `RouteReaderScreen`/`StoryNavigator`
  já existem).
- "Vá para a página X": paginação **em tempo de exportação** para PDF/DOCX
  — nunca dado armazenado.
- `scenes.body` viaja no pacote de história junto com a cena (writer/import
  narrativo já trafegam scenes; incluir no schema de export).

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
- [ ] **Fase 2:** drawer Editor (Escrever/Ler) + botão na cena + preview
      virtualizado + busca + contador.
- [ ] **Fase 3:** modo Revisar com comments de cena; export linear com body.
- [ ] **Fase 4:** export por rota com "página X"; coalescência no push; gzip.
      (Migração p/ `editor_drafts` já feita — ver acima.)
- [ ] **Futuro incerto:** comentários inline (v2), editor por blocos (só
      com evidência), diff-sync (só se storage doer).

## 7. Lacunas conhecidas

- Teto exato de bytes do body HTTP no deploy (Fastify default ~1 MB;
  confirmar em produção antes de fixar expectativas de lote gigante).
- Mapeamento fino da UI atual do detalhe da cena (fase 2).
- Modelo completo de routes/routeSteps para o export (fase 4).
