# Canvas overlays — plano (Boards + Location Maps)

**Status:** aprovado, em implementação (fatia 1).
**Escopo:** linhas/formatos desenháveis compartilhados por Boards e Location Maps,
mais trajectories derivadas (personagem/item) projetadas nos mapas.

## Decisões congeladas

- `trajectory` é visão **derivada** (appearances + `scene.locationId` em ordem
  narrativa), zero persistência de geometria. Só em mapas. Branching exige Route.
- Toggle "mostrar trajetos" no mapa é **efêmero** (mapa é uso geral).
- Paradas sem nó no mapa: indicador "+N fora deste mapa", sem ghosts.
- Linha livre desenhada chama-se **`line`**; trajectory é conceito de história.
- Framework de overlays compartilhado; cada superfície escolhe quais kinds oferece.
- Carimbo v1 reusa os 33 Ionicons; resolver com namespace desde já (`ion:`/`keres:`).
- Sem `react-native-svg` (removida do repo): tudo via Skia.

## Restrições duras

1. **Skia-only.** Nenhuma nova dependência de render vetorial.
2. **Quirks Skia-web** (aprendidos do `SkiaEdgeCanvas` — respeitar todos):
   - Overlay desmontado até CanvasKit pronto (`useCanvasKitReady`); degrada para
     "nós agora, vetores quando o WASM chegar", nunca tela preta.
   - Wrapper touch-transparent obrigatório (`pointerEvents="none"`): a view web
     da Skia derruba `pointerEvents`, sem o wrapper o canvas engole os gestos.
   - `matchFont` não existe na web: rótulos só via `useEdgeFont` (twin
     nativo/web) e sempre null-safe ("sem fonte = sem rótulo, nunca sem forma").
   - Framebuffer sempre do tamanho do viewport + câmera via `Group`: nunca
     colocar canvas dentro do plano escalado (foi o que estourou o bitmap no
     Android).
   - Tudo sob `SkiaOverlayErrorBoundary`.
   - Sem `textAnchor`: centralizar texto por largura medida
     (`measureEdgeLabelWidth`).
3. **Export SVG/PNG é essencial; paridade é meta secundária.** Regra de
   construção: geometria dos overlays vive no **shared** (como `spatialCanvas`),
   e o render Skia + os builders SVG consomem a mesma matemática. Paridade por
   construção, não por recriação aproximada.

## Modelo de dados (shared)

Novo `packages/shared/schemas/CanvasOverlaySchemas.ts`:

- `CanvasPointSchema`: `{ x, y }` finitos.
- Union discriminada em `kind`:
  - `line`: `points` (2..N), `label?`, `color?`, `strokeWidth?`, `dashed?`,
    `directed?` (seta no último ponto).
  - `polygon`: `points` (3..N), `label?`, `color?`, `fillOpacity?`,
    `strokeWidth?`.
  - `frame`: `x, y, width, height` positivos, `label?`, `color?`, `dashed?`
    (default true).
  - `shape`: `shapeType: rect | ellipse`, `x, y, width, height`, `label?`,
    `color?`, `filled?`.
  - `stamp`: `x, y`, `size?`, `icon` (string; v1 = nome Ionicons),
    `color?`, `label?`.
- Caps espelhando as superfícies (`MAX_*`, pontos/overlay limitado, strings
  ≤200, `zIndex?` opcional). Ids: string local ao documento; cada
  `superRefine` de conteúdo impõe seu próprio formato e unicidade (precedente:
  markers no `LocationMapContentSchema`).
- `BoardContentSchema` e `LocationMapContentSchema` ganham
  `overlays?: CanvasOverlay[]` (**opcional**, sem default — documentos antigos
  parseiam; precedente: `markers`).

## Trajectory derivada

- Entrada: `characterScenes` (appearances) ou `ItemJourney[]` + cenas +
  capítulos/Route; saída: `[{ sceneId, locationId }]` em ordem narrativa
  (reusar a estratégia de `orderItemJourneysByNarrative`).
- UI: seção "trajeto" no CharacterDetail (espelho do `ItemJourneyTimeline`) +
  toggle efêmero no mapa desenhando a polilinha sobre os nós (match por
  `locationId`); paradas fora do mapa agregadas no indicador.
- Sem persistência: nada no conteúdo do mapa, nada no sync/export.

## Ícones (carimbo + futuro pack SVG)

- v1: `icon` = um dos 33 `MAP_ICON_OPTIONS`; seletor reusa o padrão dos
  sheets de ponto/marcador.
- `resolveMapIcon(name)`: entende `ion:` (default implícito, zero migração) e
  reserva `keres:` para o pack próprio (SVG→Skia Path em build time, sem nova
  dep; Showcase lê os mesmos `.svg`).

## Fatias

1. **Modelo + render.** Schema shared + testes; `overlays` nos dois conteúdos;
   componentes Skia (`OverlayLayer`) sob o `SkiaEdgeCanvas`/`Group` da câmera,
   culling por `renderWindow` como os nós.
2. **Toolbar + desenho + edição.** Pill "adicionar objetos" em modo-ação
   (grupos Nota | Formas | Linha | Carimbo) no lugar do botão de nota; modo de
   desenho por kind (vértices por toque + concluir, drag-to-rect, toque para
   carimbo) com pan desligado + hint bar; edição v1 (mover, arrastar vértices,
   rótulo/cor no sheet, excluir). i18n em todas as strings.
3. **Trajectory.** Derivação shared + testes; seção no CharacterDetail; toggle
   efêmero + indicador off-map no LocationMap.
4. **Carimbo (feita).** `resolveMapIcon` no shared (`ion:` explícito,
   `keres:` reservado, resto → fallback) + helper `mapIconGlyph` usado pelo
   carimbo e pelos pontos do mapa; grupo Carimbo na pill (boards E mapas —
   o componente é compartilhado), ferramenta `stamp` com commit de um toque,
   linha de ícone no sheet do carimbo. Sem pack SVG ainda: nomes `keres:`
   caem no glifo `location` até o pack existir.
5. **(Secundária, feita) Paridade de export.** `canvasOverlaySvg.ts` desenha
   os overlays nos dois exportadores via geometria compartilhada (mesmos
   `d`, setas, tracejados, fills e rótulos da tela; vetores sob os nós,
   carimbos acima); `deliverMapExport`/`exportFormat` inalterados, PNG pega
   carona no mesmo SVG. Dedup sem mudar um byte: `svgExport.ts` (escape,
   round, título, documento), `mapIconSvg.ts` (ícones + namespace
   `ion:`/`keres:`) e `SvgExportColors` único (com `primary` para carimbos
   sem cor). Alturas de cabeçalho e tamanhos mínimos ficam por superfície
   — são layout, não deriva.

## Arquivos-touch previstos

- `packages/shared/schemas/CanvasOverlaySchemas.ts` (novo),
  `BoardSchemas.ts`, `LocationMapSchemas.ts`, `packages/shared/test/graphs/`
- `components/features/graphs/SkiaEdgeCanvas/` (só consumo),
  `components/features/boards/`, `components/features/location-maps/`
- `screens/boards/BoardCanvasScreen.tsx`, toolbar do mapa, CharacterDetail
- `utils/storyMapSvgExport.ts`, `utils/locationMapSvg.ts` (fatia 5)
- locales (todas as strings novas) + `locales:audit`

## Gates

`bun run test` (maxWorkers 2, 512MB), `typecheck`, `lint`, `locales:audit`;
testes focados mínimos por fatia no layout normal do repo; gate de 600 linhas
por arquivo.

## Errata — toolbars e edição (feita)

- Toolbars viraram fileira de ícones (`CanvasActionBar`, padrão manuscript):
  mapas = imagem, locations, marker, objetos, editar; boards = entidade,
  objetos, nota, editar. Pickers abrem o exato mesmo modal via `trigger`
  no `MultiSelectPill`; nota saiu de dentro do pill no board.
- Edição refeita no molde do layout dos nós: select não abre mais o sheet
  (só criação e o botão de detalhes abrem); seleção mostra handles +
  coluna (detalhes, frente, trás, desselecionar); fechar o sheet volta aos
  handles em vez de desselecionar; barra de select com Concluir; camada
  via `moveOverlayLayer` (mesma matemática dos nós). Sem cadeado — schema
  não tem `locked` (follow-up natural).
