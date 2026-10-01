# Notas da sessão — 2026-09-23

Handoff para a próxima sessão: o que foi entregue, o que foi descoberto (produto e código),
o backlog combinado e minha opinião sobre o programa de testes de sync.

Convenções da sessão (continuam valendo): suítes com `--maxWorkers=2` e 512MB
(`NODE_OPTIONS=--max-old-space-size=512` no shared; `--workerIdleMemoryLimit=512MB` no client);
código e comentários em inglês; sem mudanças fora do escopo pedido.

---

## 1. Entregue hoje (código, tudo com gates verdes)

### 1.1 CI lint `react-hooks/refs` (2 erros + 2 warnings)
- Causa: arrays de closures `[['add', () => canvas.current?.zoomBy(...)]]` mapeados no JSX —
  a regra não reconhece closures em array como handlers (só `onPress` direto). Os disables
  existentes estavam em linhas erradas.
- Correção: 4 `TouchableOpacity` explícitos com handlers `useCallback`, sem suppressions:
  `StoryTimelineScreen.tsx`, `PlotMatrixScreen.tsx`, `PresenceMatrixViewerContent.tsx`
  (este último de bônus: sumiram também 3 casts `as`).
- Gates: eslint 0 nos 3 arquivos, `tsc` client 0.

### 1.2 Inventário e limpeza de supressões (~86 ocorrências catalogadas)
- Removidas 10 com correção real: 7× `no-explicit-any` nos testes ScopeA (viraram
  `RenderResult['container']` + tipagem contextual do `queryAll` — o tipo correto é o
  `TestInstance` do `test-renderer` via RNTL, não `react-test-renderer` legado; o tsc
  corrigiu a primeira tentativa); 1× `exhaustive-deps` no `ImageZoomViewer` (dep adicionada);
  1× `react/display-name` (mock nomeado); 1× `refs` (item 1.1).
- Documentada 1 (mantida de propósito): `useResolvedMediaUris` (depender de `key` é correto).
- Mantidas com rationale: ~37 `set-state-in-effect` (a regra não enxerga através de `await`),
  refs em gestos/PanResponder, `immutability`/`purity` do Reanimated, `no-require-imports` em
  `jest.mock` (exigência do Jest), 2 `import/*`, 1 `@ts-expect-error`. Zero `@ts-ignore`,
  `@ts-nocheck`, `prettier-ignore` e testes pulados no repo; 7/7 `tsconfig` com `strict: true`.
- Assimetria anotada: `api` e `shared` desligam `no-explicit-any` globalmente no eslint config;
  o client mantém ligado.

### 1.3 Timeout `compileStoryManuscript` (>5s → 129ms)
- Causa raiz: `parseInlineLine` (`ManuscriptDocument.ts`) escaneava 1 char/iteração com
  `slice` + `pushText` por char — 15M iterações num corpo de 15MB.
- Correção: consumo em rajadas (runs sem markup num `slice` só); máquina de estados idêntica,
  saída byte-igual. O teste de 15MB virou teste de regressão de performance implícito.
- Gates: shared 948/948 (vitest, workers=2, 512MB).

### 1.4 SyncEngineService abaixo do teto (609 → 573 linhas de código)
- Oportunidade encontrada: o loop de busca paginada do pull (fingerprint + até 20 páginas)
  ainda morava no engine; casa natural é o `SyncPull`.
- `SyncPull.fetchRemoteUpdates({ lastSyncedLog, lastPublicFavoriteLog, favoriteBehavior,
  fallbackRole })` — corpo movido verbatim (mesma URL, params, cursor, limite); engine só
  consome `{ updates, publicFavorites, role }`. Nenhuma assinatura pública mudou.
- Bônus: `throwIfCycleAborted` virou `throwIfSyncAborted` em `syncPure.ts` (engine delega);
  imports mortos removidos; +5 testes (`SyncPull.test.ts`: paginação, fingerprint,
  adoção do fingerprint do servidor, fallback de role, abort).
- Gates: `SyncPull` 29/29, engine+transfer 112/112, tsc 0, eslint 0.
- Resta acima de 600 no repo: `manuscriptPdf.ts` (682, shared) — fora do escopo, próximo
  candidato natural.

### 1.5 Bug: listas de characters/locations/items não filtravam por arco
- Confirmado como bug pelo usuário. World rules continuam mostrando tudo (intocado).
- Implementação: `StoryArcService.listEntityArcIds` (bulk, 1 query por tipo, mesmos joins e
  tombstones do "appears in"), predicado `entityBelongsToActiveArc`, hook `useEntityArcIds`
  (mesmos eventos do `useAppearsInArcs`), filtro memoizado nas 3 telas, hook registrado na
  lista de lifecycle owners do `importBoundaries`.
- Semântica decidida: entidade sem link capitular **continua visível** sob qualquer arco
  (precedente das unchaptered scenes; criar um personagem com arco ativo não o faz sumir).
- A ajuda (`help/content/arcs/en.ts`) já documentava esse comportamento — o produto agora cumpre.
- Testes: serviço (bulk + multi-arco + link deletado), hook (mockado), predicado (novo bloco
  no arquivo de teste **pre-existente**, que foi restaurado após overwrite acidental),
  1 teste de filtro por tela.
- Gates: 8 suítes / 54 testes, tsc 0, eslint 0 erros.
- **Fragilidade latente encontrada**: `LocationListScreen.test.tsx` é ordem-dependente
  (warnings de overlapping-act já existem no pristine; um 6º teste no fim do arquivo nunca
  tem seu mount commitado — 0 chamadas em todos os mocks). O teste novo roda primeiro no
  arquivo, com comentário explicando. Higiene futura desse arquivo: pêndente (não corrigir
  a causa agora foi decisão de escopo).

### 1.6 Itens 1, 3, 5 do backlog + refinamentos round-2
- **Quick capture em modal**: quick-add de scene saiu da linha inline (o container do
  capítulo não cresce, a nova scene ficava escondida) para `QuickAddSceneModal`
  (`ResponsiveModal` + `FormActions`, conforme modais do sistema). O input/botão viraram
  `QuickAddSceneRow` reutilizado dentro do modal.
- **Busca no manuscript com scroll até o match ativo**: jump indexado por seção +
  fine-scroll medido (`computeScrollAdjustment`, margem 96) até o host do hit ativo via
  `measureInWindow`; scenes de várias páginas agora mantêm o hit corrente visível.
  Lógica extraída para `useManuscriptSearch`, o que trouxe `ManuscriptScreen` de volta
  para baixo do teto de 600 linhas (file-size gate verde).
- **Derivação do texto dos checks no shared**: sentenças de check/effect saíram do
  client para `packages/shared/manuscript/choiceAnnotations.ts`; API
  (`StoryPublicationService`, via showcase) e client geram documentos idênticos
  (inglês default; client localiza via formatter).
- **Busca: hits no título agora rolam até o match**: duas causas. (1) Corrida stale —
  o retry de 120ms/rAF do hit anterior disparava depois do jump e puxava a lista para
  longe; titles sofriam mais por não terem correção própria. Fix: geração em
  `scrollActiveIntoView` (novo attach/detach invalida continuações pendentes).
  (2) Cobertura — o título nunca recebia `activeRef`; agora o `MarkedText` do título
  ativo anexa o mesmo ref dos corpos.
- Gates: client tsc/eslint 0, suítes tocadas 194/194 (jest, incl. layering);
  shared tsc/eslint 0, 982/982 (vitest); api tsc/eslint 0, `publicationManuscript`
  12/12 (sqlite); `locales:audit` 0.

### 1.7 Modo revisão no manuscript + comentários em tudo (U1–U8)
- Correção de escopo do usuário: threads de `scenes.body` já existiam na per-scene
  (criação/edição via `CommentService` + `CommentThreadModal`); nada disso foi
  duplicado — só leitura bulk nova (`getCommentsForEntities` + `useSceneBodyComments`).
- Manuscript geral: modos read/review no header (olho/`pureRead` removidos com chave
  de locale, testes e referências); review tem `ManuscriptReviewTools` fixo (barra da
  scene corrente + thread), marcas estilo search em títulos/corpos, tap abre a thread.
- Scene editor: barra de review para fora do `ScrollView` (fixa); marcas + tap só em
  review; read continua limpo.
- Todas as detail screens (via `CommentableDetailField` + custom attributes): trechos
  comentados marcados, tap abre a thread; comentário vence mention/link em overlap.
- Modal: `initialExcerpt` pré-preenche na abertura; seleção web (só) via
  `useWebSelectionClip` (clipping DOM preciso por campo; nativo sem API no `Text` —
  verificado na doc oficial — mantém excerpt manual).
- Shared: `findAllFoldedMatches` + `splitTextByCommentRanges` (normalize unificado;
  comportamento dos splitters antigos preservado pelos testes).
- Gates: client full 596/596 suítes, 5990/5990 (jest maxWorkers=2/512MB); shared
  84/84, 988/988 (vitest); tsc/eslint 0 ambos; `locales:audit` 0; file-size gate
  verde (construção de bar/thread mora no hook, não na tela).

### 1.8 Round-3: posição do leitor, índice com pendências, olho de volta, âncora única
- **Barra acusava scene fantasma (vazia, fora da tela)**: `itemVisiblePercentThreshold:
  50` nunca dispara para scenes de várias páginas, travando a posição na última
  scene curta. Fix (verificado no source instalado do virtualized-lists):
  `viewAreaCoveragePercentThreshold: 20` + first-by-index = scene substancial do
  topo; corrige também o highlight do índice (mesmo callback).
- **Índice lista pendências**: badge de contagem por scene + agregado por capítulo
  (e grupo loose), visível sem expandir; `commentCountsBySceneId` vem do hook.
- **Olho de volta como read mode**: read = prosa pura (sem títulos/pencils/scenes
  vazias), review = tudo. Busca conta title hits nos dois modos (semântica do olho
  original, sem tratamento especial).
- **Marcas first-match-only** (supercede decisão all-occurrences): aviso do modal,
  snapshot e prosa agora concordam — cada excerpt marca só sua âncora (primeiro
  match do campo; na prosa, primeiro hit do primeiro span que contém). Removidos
  `findAllFoldedMatches` + testes.
- File-size: seções por modo foram para `useManuscriptReview` e a toolbar de busca
  virou `ManuscriptSearchToolbar` (testIDs/estilos idênticos, zero churn de teste).
- Gates: client full 596/596, 5995/5995; shared 84/84, 985/985; tsc/eslint 0;
  layering verde.
- Pergunta aberta: labels de anotação na API são inglês-only por ora; localização
  futura se o showcase precisar.

### 1.9 Round-4: comentários ignoram marcação na comparação
- **Diagnosis**: excerpts citam o texto renderizado (o que a seleção copia), mas a
  âncora comparava contra o raw com marcadores — `**bold** word` nunca continha
  `bold word`, e na prosa o match por span falhava em toda fronteira de estilo.
- **Fix shared**: `stripInlineMarkup` (em `ManuscriptDocument`, ao lado da gramática
  que espelha decisão por decisão) + `findFirstExcerptMatchInMarkdown` (compara no
  texto renderizado, reporta offsets raw, expande sobre marcadores adjacentes para
  a marca cobrir `**bold**` inteiro) + `sliceMatchAcrossSpans`.
- **Modal**: composer de prosa (`showExcerptAnchorNotice`: editor + manuscript)
  ancora markdown-aware; campos de detalhe mantêm match exato (asteriscos deles
  são prosa literal). Seleção → comentar em texto estilizado agora ancora e acende
  a marca ao vivo em vez de cair no aviso de mismatch.
- **Prosa**: `MarkdownPreview` casa cada excerpt no texto renderizado do bloco e
  fatia o hit nos spans que ele cruza — mesma âncora do snapshot do modal.
- Testes: 13 shared (incl. golden stripper-vs-parser em 13 fixtures cabeludas) +
  3 client (modal prosa, pin do modo plano, fronteira de estilo na prosa).
- Gates: client full 596/596, 5998/5998; shared 84/84, 998/998; tsc/eslint 0;
  locales audit ok. Arquivos tocados seguem < 600 linhas.

### 1.10 Round-5: botão de comentário por scene no manuscript
- **Sintoma**: scene curta (1-2 linhas) no fim do tail unchaptered — o botão da
  barra de review acusava a scene de cima. Causa provável: scene curta nunca cobre
  20% do viewport (`viewAreaCoveragePercentThreshold`), então nunca vira posição
  do leitor e a barra segue apontando a anterior. Detecção intocada por decisão
  do usuário; a saída foi atribuição explícita em vez de inferida.
- **Fix**: botão `chatbubble-outline` ao lado do lápis em cada cabeçalho de scene
  (review mode), `manuscript-comment-{sceneId}`, que abre a thread daquela scene
  (`openThread`, mesmo callback das marcas). Barra e marcas inalterados.
- Label de acessibilidade reusa `comments_title` (zero churn de locale).
- Teste: botão da loose trailing abre s-3 com snapshot `Lost pages.` enquanto a
  barra ainda aponta s-1.
- Gates: client full 596/596, 5999/5999; shared 998/998 (intocado); tsc/eslint 0;
  locales audit ok. ManuscriptScreen ~561/600 linhas de código.

### 1.11 Round-6: preview do comentário em prosa mostra texto renderizado
- **Pedido**: o snapshot acima do excerpt exibia `**` etc; para `scene.body`, o
  preview deve mostrar o texto como no documento. Seleção/detecção já estavam ok.
- **Fix**: modal exibe `stripMarkdownText(snapshot)` no modo prosa e ancora o
  excerpt no mesmo espaço renderizado (strip dos dois lados + regra plain) —
  mesma detecção, marca sempre alinhada ao que se vê. Campos de detalhe seguem
  raw/exato.
- **Refactor honesto**: com display renderizado, os offsets raw do round-4
  perderam o propósito — removidos `findFirstExcerptMatchInMarkdown` (+9 testes)
  e o mapa/expansion; `stripInlineMarkup` volta a retornar só texto e ganha o
  wrapper multilinha `stripMarkdownText`. Golden stripper-vs-parser mantido.
- Gates: client full 596/596, 5999/5999; shared 84/84, 992/992; tsc/eslint 0;
  locales audit ok.

### 1.12 Round-7: preview do comentário enquadra a âncora (estilo backlinks)
- **Pedido**: preview mostrava sempre o começo; em scenes longas com excerpt no
  meio, nada útil. Agora: `...contexto marcado contexto...` como global
  search/backlinks.
- **Fix shared**: `frameMatchWindow` — mesmo framing de `excerptAroundMatch`
  (150 chars, ellipsis por lado cortado, trim das bordas) mais a marca
  relocalizada/clampada na janela; `excerptAroundMatch` virou delegação fina
  (5 testes antigos verdes sem tocar).
- **Modal**: preview usa a janela quando há âncora; textos curtos passam
  intactos e sem âncora o head mostra como antes. Vale para prosa e detalhe
  (detalhes são curtos: no-op natural).
- Testes: 4 shared (passthrough, centro, bordas sem ellipsis, clamp de match
  maior que a janela) + 1 client (snapshot longo em prosa enquadra `needle`
  marcada entre dois `…`, head cortado).
- Gates: client full 596/596, 6000/6000; shared 84/84, 996/996; tsc/eslint 0;
  locales audit ok.

### 1.13 Round-8: preview do comentário ignora quebras de linha
- **Pedido**: quebras de linha no snapshot corrompiam o preview enquadrado.
- **Fix**: `collapseWhitespace` no shared (toda run de whitespace vira um
  espaço, bordas aparadas); modal aplica no snapshot E no excerpt, então a
  âncora continua casando — excerpt digitado atravessa quebra como espaço.
  Bônus: prefill de seleção multilinha ancora também.
- Testes: 1 shared + 1 client (snapshot `A **bold**\nnew line.` flui como
  `A bold new line.` e `bold new line` marca sem warning).
- Gates: client full 596/596, 6001/6001; shared 84/84, 997/997; tsc/eslint 0;
  locales audit ok.

### 1.14 Round-9: navegação por ocorrência (fecha §3.3)
- **Entrega**: tap numa ocorrência (backlink ou busca global) pousa na detail
  com scroll medido até o trecho + flash forte de 2s. Cobertura total: 12
  details. Sem ciclo prev/next (decisão do usuário).
- **Desenho**: alvo `{field, needle?}` viaja nos params de navegação; agulha
  (texto de superfície, não offset) é localizada no valor renderizado — imune
  a formatação/fallbacks. `DetailContainer` provê contexto + scroller;
  `DetailField` pisca (fill forte do manuscript) e mede o próprio span;
  factory injeta `fieldKey` em todos os campos comentáveis; customs usam
  `custom:<fieldId>`. Scroll segue o padrão manuscript (janela, retry, geração).
- **Busca global**: resultados carregam occurrence (títulos e Modes pousam no
  topo/lista, como antes) e snippets emoldurados no match (`excerptAroundMatch`)
  em vez de truncar o head.
- **Testes**: +19 (controller, flash, serviço, presses, fiação Character/Plot).
  Achado de ambiente: fake timers não descarregam estado de hook nem sobrevivem
  a renders RNTL aqui — fade testado com timers reais (~2s).
- Gates: client full 597/597, 6020/6020; shared 84/84, 997/997; tsc/eslint 0;
  locales audit ok. SceneDetailScreen em 580/600 — próximo toque nela pede split.

### 1.15 Round de overlays do canvas (handoff anterior, sem detalhe neste contexto)
- Errata dos overlays + lock + onboarding + fix de cor no export. Entregue com gates
  verdes: client 618/6126, shared 88/1023 na época.

### 1.16 Pack de ícones Keres (59 SVGs, picker v2, fiação completa)
- **Curadoria**: 59 SVGs do game-icons.net (CC BY 3.0) em
  `packages/shared/metadata/keres/` + `keresIcons.json` (nome/autor/source/categoria/
  keywords) + `NOTICE.md` no repo. Autores: Lorc, Delapouite, Carl Olsen.
- **Decisões**: Skia-only, sem react-native-svg; nomes guardados com namespace
  (`keres:`, `ion:` explícito, plano = ion); atribuição in-app vai para um botão em
  Settings (decisão do usuário — NÃO implementar agora).
- **Render**: `MapIcon` com branch por família (fonte Ionicons / Skia `ImageSVG`;
  escala 0.8 na entrega, **0.9** depois do §1.19); `tintIconShapes` compartilhado;
  `keresIconPaths.ts` gerado por
  `scripts/generate-keres-icon-paths.ts` (valida bg/viewBox, sem grupos/transform).
- **Picker v2** (`IconPickerModal`): busca (nome+keywords), 11 chips de categoria,
  recentes duráveis (`useIconRecents`, 8), grid responsivo 4/5/6 colunas. Keres
  sempre anexado; avatar usa essentials, mapas usam `MAP_ICON_OPTIONS`.
- **Fiação**: Avatar, `CanvasStampView`, `LocationMapNodeView`, export SVG dos mapas
  (`renderMapIconSvg`) e Showcase (plugin vite corta os 59 para o virtual module;
  `OwnerAvatar` sem mudança lógica). API/DB trafegam `keres:` como string opaca.
- Testes: manifest (nomes/categorias/SVG por entry), MapIcon (3 branches), pickers,
  export, showcase (`keres:castle` renderiza o glifo, não o fallback).

### 1.17 Curadoria do pack (revisão visual, 9 trocas)
- Renderizei os 59 + candidatos em contact sheets (Chrome headless) e revisei um a
  um (`C:\tmp\sheet\sheet-a.png` … `sheet-d.png`, throwaway).
- Trocas (mesmo nome, nova arte — só station mudou de nome): `space-station`
  (era a Death Star) → **`lunar-module`**; `sword` broadsword → **gladius (Skoll,
  4º autor no NOTICE)**; `spear` (lia-se pena) → spears; `staff` (onda) →
  crescent-staff; `scroll` (bota) → tied-scroll; `potion` (granada) →
  standing-potion; `volcano` (planta) → smoking-volcano; `spaceship` (origami) →
  rocket; `alien` (cthulhu) → alien-stare. Keywords ajustadas onde mudou o conceito.
- Valores antigos `keres:space-station` caem no fallback `location`, sem quebrar.
- Regen byte-idêntica fora as trocas; suítes do pack verdes.

### 1.18 Ícones de story arc (form + estrutura + drawer)
- **Form**: campo de ícone no `StoryArcFormScreen` (essentials + Keres), com estado,
  draft durável, dirty/reset, create/update; chave `arc_icon` en+pt; oculto em
  leitura. Service/sync/schemas já trafegavam `icon` — zero buraco.
- **Drawer**: `drawerStoredIcon` (MapIcon) na entrada ArcContext do
  `MainSystemStack`; fallback `library-outline` sem arco ativo.
- **Render**: `StoryArcListScreen` e `AppearsInArcsSection` via MapIcon;
  `EntityRelationList.icon` agora opcional (leading desenha). `ArcPickerModal`
  intocado por decisão de escopo (ver §6).
- Testes: form (pick/save/hydrate), lista, ScopeAArcs, EntityRelationList sem
  ícone, drawer helpers + stack (arco ativo e fallback).

### 1.19 Picker no web (pills, render Keres, wrap, recents)
- **Pills vazando**: scrollers horizontais e grid sem largura — no web, filho sem
  largura em coluna centralizada dimensiona pelo conteúdo e derrama. Fix:
  `width: 100%` nos três.
- **Keres em branco no web**: Skia-web monta o SVG num `<img>` escondido com
  decode assíncrono mas `drawSvg` dá snapshot síncrono (e ignora o tamanho pedido)
  — confirmado no source instalado. Fix: branch web no `MapIcon` renderiza o
  mesmo markup tintado via data URI no `Image` do RN (`keresIconMarkup.ts`);
  Skia segue no nativo. Verificação por pixel em Chrome headless com os bytes
  exatos dos módulos de produção (26/32/55px, tints claro/escuro).
- **Sem scroll horizontal nas pills**: chips quebram em linhas (`flexWrap` + `gap`),
  compactas em telas estreitas; container limitado (`altura − 120px`), grid com
  `flexGrow/flexShrink` cede o espaço; glifos Keres 0.8 → **0.9** (detalhe pede).
- **Recentes cortados ao meio** (regressão do cap, print do usuário): web encolhe
  flex items por default e o ScrollView do RNW tem `overflowY: hidden` — fileira
  achatada = células cortadas, grid pintando por cima. Fix: `flexShrink: 0` em
  todas as fileiras fixas, só o grid cede; travado em teste de contrato de estilo.
- **Fechar no topo**: Cancel embaixo virou X no header (padrão MultiSelectPill),
  sempre alcançável em telas curtas; `icon-picker-close` nos testes.

### 1.20 Color picker com paridade visual (opção B)
- Cancel/Select embaixo viraram X (esquerda) + check (direita) no header, mesmo
  padrão do modal de ícones; estilos mortos dos botões removidos.
- **Opção B** (escolha do usuário): check com fundo tintado da cor picked ao vivo
  (glifo por `getContrastTextColor`, borda sutil) + hex como legenda do título —
  fileira de preview + hex embaixo eliminada (~100px economizados). Chaves
  `close`/`select` reutilizadas, zero churn de locale.
- Testes: confirm/close pelos testIDs + fundo do check = cor picked + contraste
  do glifo. `DatePickerModal` mantém os botões antigos (ver §6).

---

## 2. Achados de análise (produto, sem código)

Fonte: `docs/finished_planning/FEATURE_LANDSCAPE.md` (auditado em 01/09/2026) + pesquisa web
sobre críticas aos concorrentes. Veredito de uma linha: Keres não ganha em polimento de um
job específico; o caso é ser o único bible estruturado, local-first, com sync assíncrono
sério e sem impor método — exatamente onde os concorrentes mais apanham.

- **Scrivener** (sync é a crítica nº 1: Dropbox obrigatório, manual, sem Android): Keres
  responde com SQLite local + operation log + sync assíncrono com roles/OCC/conflitos
  visíveis. Ressalva: só vale se for "boringly reliable" (ver §4).
- **Plottr** (sem colaboração, sem drafting, glitches/data-loss, outline rápido): Keres
  responde nos dois primeiros; perde em velocidade do primeiro outline (ver backlog).
- **World Anvil** (curva íngreme, UI poluída, paywall de privacidade): Keres inverte
  (privacidade arquitetural, entidades em vez de 25+ templates); perde em catálogo,
  mapas para audiência, descoberta pública e RPG.
- **Dabble/Novelcrafter/Campfire** (fadiga de assinatura; rigidez act/chapter/scene):
  Keres responde com pacotes (saída garantida) e "não impor método". Custo: MPL-2.0,
  licença zero, servidor auto-hospedável; `.exe` double-click = fricção baixa em LAN;
  gap restante = multi-usuário online (host real ou port forwarding; VPN zero-config
  como meio-termo possível).
- **Obsidian** (liberdade vira débito sem estrutura): Keres é o oposto arquitetural
  (entidades de primeira classe); perde em backlinks (ver backlog) e extensibilidade.
- **articy/Twine** (executam/publicam; Keres só planeja): buraco honesto declarado no doc.
  Nuance nova (ver §3): PDF CYOA conta como **publicação de artefato**, não interativa.
- **Arcos como série** (reframe aceito): Story = canon/mundo isolado; Arcos = livros dentro
  do canon. Muda a avaliação de "ausente" para "estruturalmente presente": entidades
  compartilhadas + "appears in" derivado + export por arco é melhor que copiar canon.
  Faltava: superfície de produto ("Livro 1/2/3", não "subdivisão editorial") e filtro por
  arco nas listas de entidades — **o filtro foi feito hoje (item 1.5)**. Canon entre
  Stories distintas vira premissa documentada (by design), não gap.
- **Mapas**: cartografia do WA (pins linkados, camadas, filtros, visibilidade por camada
  para jogadores) é apresentação para **audiência** — fora da premissa do Keres. Camadas
  dá para improvisar (cópia de mapa + links via marcadores). Único potencial real:
  desenho de linhas/formas — conexões hoje são aresta nó→nó (`fromNodeId`/`toNodeId`,
  drag, path SVG em cache); desenho livre precisa de primitivo polyline novo sobre a
  mesma infra de canvas/gestos/render.
- **Backlinks vs Obsidian** (investigado no código): painel por ocorrência com excerpt
  centrado no match (corrigido: não mais os primeiros 150 chars), ambíguas com
  see-also em um toque, guards de perf. Do Obsidian falta: navegação por ocorrência;
  grafo segue fora do escopo. Estado por sub-item no §3.3.
  A versão honesta de "unlinked" no Keres = expor **nomes ambíguos** (hoje silenciam por
  design) como sugestão com resolução em um toque — e o sink correto é o **see also**
  (derivado sugere, só o usuário persiste; zero entidade/sync nova). Perf: índice O(texto),
  ~50-200ms em aparelho fraco numa story grande, só em saves, atrás de toggle — upgrades
  cabem com guards (debounce ~500ms, SELECT só das colunas usadas). Grafo: fora do escopo.

---

## 3. Backlog combinado para a próxima sessão

- [ ] **Quick capture** — criar cena só com título (cena avulsa mínima, modelo já permite),
  anexar a capítulo depois. Packs como esqueleto inicial **já são oferecidos no onboarding**
  (não reimplementar — confirmar e medir). Métrica que decide o gap vs Plottr: tempo/taps
  de "story nova" até "10 cenas tituladas em ordem".
- [ ] **Linhas/desenho no mapa** — só a intenção por enquanto; será elaborado. Direção:
  primitivo polyline novo reaproveitando canvas/gestos/render das conexões.
- [x] **Backlinks (sem grafo)** — estado verificado no código:
  - [x] excerpt centrado no match (`buildMentionBacklinkIndex` + `excerptAroundMatch`)
  - [x] navegação por ocorrência — pouso no campo com flash 2s (scroll medido +
    marca forte), backlinks e busca global; sem ciclo prev/next (fora do escopo)
  - [x] nomes ambíguos como sugestão com see-also em um toque
    (`buildAmbiguousMentionIndex` + card de sugestões + `useResolveAmbiguousMention`)
  - [x] guards de perf (debounce 500ms nos rebuilds, SELECT só de colunas de texto,
    build único por story, token anti-stale)
  - [x] **Bugfix junto** (busca no manuscript não avançava até o hit salvo se longe):
    corrigido no §1.6 (`activeMatch` + fine-scroll medido + geração anti-stale)
  - Compartilhar código com comentários: `frameMatchWindow`/`stripMarkdownText`/
    `collapseWhitespace` no shared, prontos para reuso.
- [ ] **Planejar a "mini-engine"** — export HTML estático (público: itch.io, beta readers,
  arquivo; hospedável em qualquer lugar). MVP sobre os sistemas de **choice checks e
  effects**: mostrar/ocultar/desabilitar opções por estado em memória, via configuração no
  momento da exportação; campos de publicação nas scenes/choices escondidos por padrão
  (padrão do stats). Linha a não cruzar: sem estado persistido de jogo no export (isso
  seria runtime, decisão separada). Export continua projeção read-only.
- [ ] **Checks no export (descoberta de hoje)** — verificado: `packages/shared/manuscript`
  tem ZERO menções a check/condition/requires/effect e `ManuscriptChoice` não carrega
  checks. O "exige este item / ter isto bloqueia a opção" é **feature ausente**, não só
  teste ausente. Implementar no compilador (derivar texto dos checks) + renderizar nos
  4 formatos + testes CYOA em todos os formatos. Nota: `docs/TESTING_ROADMAP.md` §3
  rank 1 cita exatamente "choice checks/groups/effects missing from the client export
  for years, schema-valid" como caso de referência — converge com este item.

---

## 4. Opinião: sync "boringly reliable" (minha análise)

### 4.1 Não reinventar: o programa já existe
`docs/TESTING_ROADMAP.md` §3.1 + Phase 1A **é** o programa "boringly reliable", com o gate
certo (branches, não linhas: `SyncEngineService` estava em 72% linhas / 51% branches) e a
especificação dos testes (matriz de conflitos 6 razões × 5 resoluções × 4 tipos de operação
em §5.1 + comportamentos do ciclo em §5.2). O split 1A.0 (scheduler/pull/push/transfer) já
foi feito — inclusive o `fetchRemoteUpdates` de hoje continua esse trabalho. O que o usuário
pede (testes de integração até client+servidor de verdade) é a camada que falta **por cima**
desse programa, não um programa novo.

### 4.2 Onde os testes de integração entram
Hoje o lado client testa o engine com adapter HTTP mockado (fixtures de pull/push) e o lado
API tem integração com postgres em docker — mas nada executa os dois lados juntos, então
**deriva de contrato** (o que um lado assume vs o que o outro faz) passa batido. Proposta
em camadas, em ordem de custo-benefício:

1. **Matriz de conflitos fim-a-fim in-process**: engine real do client (sqlite real) +
   handlers reais da API no mesmo processo, sem rede. Executar as células críticas do §5.1
   através da fronteira real (pelo menos: `deleted_on_server`+restore/discard,
   merge disjunto, merge mesmo-valor, `keep_local`/`keep_server`, reorder+`keep_local`,
   validation/unauthorized nunca reenviados, `blockedEntities` por entidade).
2. **Falhas e resume**: abort mid-page/mid-push, restart mid-cycle, 500s, offline no meio,
   reenvio idempotente. Maior rendimento de bugs por esforço, na minha avaliação.
3. **Convergência com 2 clientes**: operações interleaved → mesmo estado final
   (property-based; o teste mais valioso e o mais caro).
4. **Soak**: backlog grande (páginas cheias de 500), adoção de fingerprint, ciclos longos.

### 4.3 Onde eu esperaria que os testes achem bugs (achismo calibrado)
Abort paths (`throwIfCycleAborted` e o que cada `catch` faz depois); avanço de cursor em
páginas vazias/curtas; reorder vs delete concorrentes; base-version no rebase; semântica de
`blockedEntities` dentro do batch; transições de contexto mid-cycle
(`deactivateStoryFromActiveCycle`, `pendingContextTransitions`); races do scheduler
(`stopAndWait` vs ciclo ativo); adoção de fingerprint em backlog multipágina. Concordo com
o usuário: **assumir que vão achar bugs** — especialmente em abort/resume, que é o tipo de
path que teste unitário com mocks almost-sempre mente sobre.

### 4.4 O que seria drástico (aviso antecipado, como pedido)
- **Full E2E em rede** (client + API subidos, HTTP real, docker): pesado, lento e flaky por
  natureza. Quase certamente desnecessário se o harness dual in-process (camada 1) funcionar.
  Não recomendo.
- **FLAG antes de começar**: inspecionar se os handlers da API são acionáveis fora do HTTP.
  Se estiverem acoplados ao framework web, o harness dual exige estilo-supertest ou refator
  para extrair — aí sim pode ficar drástico, e eu aviso antes de mexer em produção para
  acomodar teste.
- Gate proposto: branches ≥90% na superfície de sync (o roadmap manda) **mais** matriz
  crítica executada na fronteira real **mais** zero flakes — teste de sync flaky é bug ou
  teste errado, nunca "retry".

### 4.5 Ordem sugerida de ataque
1. Inspecionar o harness de integração da API (composabilidade com o engine do client).
2. Matriz crítica fim-a-fim (lista do item 4.2.1).
3. Abort/resume/idempotência.
4. Convergência 2-clientes.
5. Soak + ratchet dos floors de coverage (roadmap §12).

---

## 5. Riscos e pendências soltas
- `manuscriptPdf.ts` (682 linhas) segue acima do teto de 600 — próximo candidato a split.
- `LocationListScreen.test.tsx` tem fragilidade de ordem pré-existente (warnings de
  overlapping-act no pristine). Contornada com teste em primeiro + comentário; higiene
  real do arquivo está pendente.
- Assimetria de lint config: `no-explicit-any` off global em `api`/`shared`, on no client.
- `SvgRasterHost` (raster de PNG no export) usa o mesmo caminho Skia-SVG quebrado no
  web (§1.19) — PNG exportado no web pode sair em branco. Não reportado; se aparecer,
  mesma causa, fix análogo.

---

## 6. Metas que faltaram (handoff)

Gates finais da sessão, tudo verde: typecheck, lint, `locales:audit`, format,
`code:lines`; testes shared 89/1025, client 621/6149, api 41/274, admin 29/356,
desktop 7/101, site 5/35.

- [ ] **Créditos in-app do pack (decisão adiada, não esquecida)** — atribuição CC BY
  hoje só no `keres/NOTICE.md` + autores no manifest (o futuro credits screen lê
  dali). Falta o botão em Settings; usuário decide o desenho depois.
- [ ] **Paridade visual do pack em aparelho real** — legibilidade/peso dos 59 foi
  validada em contact sheets no desktop; falta olhar amostral no nativo (Skia) e
  na web real, especialmente glifos detalhados em 20–30px.
- [ ] **Confirmação do fix de recentes no web do usuário** — validado por leitura
  do fonte do RNW + teste de contrato de estilo (sem driver de automação aqui);
  pedir print de confirmação na janela real.
- [ ] **`DatePickerModal` com header X/check** — único picker restante com botões
  embaixo; mesma paridade dos §§1.19–1.20 se o usuário quiser.
- [ ] **Ícones dos arcos no `ArcPickerModal`** — fileiras seguem check/elipse de
  seleção; mostrar o `MapIcon` de cada arco é follow-up natural do §1.18.
- [ ] **Backlog §3 em aberto** — quick capture, linhas/desenho no mapa,
  mini-engine (export HTML), checks no export. Nada disso foi iniciado.
- [ ] **Riscos §5 em aberto** — split do `manuscriptPdf.ts`, higiene do
  `LocationListScreen.test.tsx`, assimetria do `no-explicit-any`.
