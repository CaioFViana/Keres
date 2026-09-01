# Expansão de Boards e Mapas de Localização

## Decisão

Boards e Mapas de Localização continuarão como documentos espaciais independentes. Ambos usam
canvas, pan/zoom, edição local e um único save do documento JSON, mas não devem compartilhar o
mesmo schema: um Board é uma superfície de pensamento livre; um Mapa representa espaço e imagens.

O reaproveitamento será feito na interação: seleção, alças de redimensionamento, arraste,
acessibilidade, estado sujo e exportação coerente.

## Interação de seleção

O modal não abrirá ao primeiro toque durante a edição de layout, pois ele cobriria o elemento que
precisa ser redimensionado.

- Em **visualização**, tocar abre os detalhes como hoje.
- Em **editar layout**, o primeiro toque seleciona o elemento no canvas; a seleção mostra borda,
  alça de redimensionamento e um botão explícito de detalhes.
- Arrastar o corpo move; arrastar a alça redimensiona; o gesto de pinça continua reservado ao
  canvas.
- No desktop, foco ou hover revela a alça. No mobile, a alça aparece depois da seleção.
- Tocar no espaço vazio remove a seleção.

O mesmo contrato será usado para cards do Board e imagens-base do Mapa. Pontos de mapa mantêm uma
área de toque acessível, mas não precisam de resize na primeira fase.

## Fase 1 — Cards ricos e redimensionáveis no Board

Cada nó de entidade passa a poder ter configuração de apresentação própria:

```ts
{
  displayMode: 'compact' | 'summary' | 'note' | 'summary-and-note',
  cardNote: string | null,
  width?: number,
  height?: number,
}
```

`cardNote` não cria uma entidade `Note`: é uma anotação contextual daquele pin. O resumo é vivo e
vem da entidade atual; a nota pertence ao desenho. Pins existentes continuam compactos por padrão.

Ao redimensionar, o card revela progressivamente título, tipo, resumo e/ou anotação de acordo com
o modo escolhido. Bounds, arestas e exportação SVG precisam usar as dimensões persistidas. Em caso
de entidade excluída, `labelAtPin` e `cardNote` continuam visíveis no ghost.

## Fase 2 — Imagens-base do Mapa

As imagens já persistem `width`, `height` e `locked`. A fase substitui o resize por botões por
alça direta no canvas, mantendo os botões como alternativa acessível. A proporção original continua
preservada na primeira versão.

## Fase 3 — Marcadores livres e destinos

“Ghost” continuará significando uma referência a uma entidade apagada. O novo elemento será um
**marcador livre**, para loot, portas, perigos, regiões ou pontos sem uma `Location` real.

```ts
type LocationMapNode =
  | { kind: 'location'; locationId: string; labelAtPin: string; destinationMapId?: string | null }
  | { kind: 'marker'; title: string; note?: string | null; destinationMapId?: string | null };
```

Ambas as variantes mantêm posição, ícone e cor. A interface continuará a aceitar cada Location uma
vez por mapa; o schema também validará essa regra. Pins de Location passam a salvar `labelAtPin`
para sobreviver de forma legível à exclusão da Location.

Um destino é uma ligação cartográfica, não uma `LocationRelation`.

- Pode apontar para um mapa existente da mesma história ou criar um novo mapa.
- Ao criar, o mapa novo já recebe o ponto de chegada.
- Excluir origem ou Location não modifica o mapa de destino.
- Excluir o destino mantém a referência e apresenta destino indisponível.
- Clone/importação precisa remapear `destinationMapId`, além de Gallery e Location.

## Fase 4 — Comparação de mapas

Começar como uma comparação temporária: escolher outro mapa, sobrepor suas imagens, mover,
escalar e ajustar opacidade. Não salvar a transformação inicialmente e não assumir que os mapas
têm coordenadas compatíveis.

Persistir alinhamentos (offset, escala e possivelmente rotação) só será considerado depois de uso
real. “Camadas” não entra antes disso, para não prometer composição cartográfica automática.

## Ciclo de vida e testes obrigatórios

Toda mudança persistida deve cobrir schema compartilhado, SQLite, PostgreSQL, sync, operation log,
exportação, importação, clone, exclusão, conflito de `content`, SVG e interface touch/web.

O `FEATURE_LANDSCAPE.md` deve ser corrigido na mudança que entregar a expansão: seu texto ainda
descreve uma versão anterior dos Mapas de Localização, sem imagens e pinos.
