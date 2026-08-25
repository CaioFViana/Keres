export const MATRIX_PADDING = 24;
export const MATRIX_LABEL_WIDTH = 154;
export const MATRIX_SCENE_WIDTH = 124;
export const MATRIX_HEADER_HEIGHT = 82;
export const MATRIX_ROW_HEIGHT = 58;
/**
 * Respiro entre a borda da coluna e a célula desenhada dentro dela. Vive aqui, e não como um
 * `10` solto em cada desenho, porque o fio das séries é recortado exatamente por ele: se a
 * célula e o fio discordarem sobre onde a célula começa, um invade o outro.
 */
export const MATRIX_CELL_INSET = 10;

export function getPresenceMatrixSceneWidth(sceneCount: number) {
  if (sceneCount <= 6) return MATRIX_SCENE_WIDTH;
  if (sceneCount <= 14) return 104;
  return 88;
}

export interface PresenceMatrixRow {
  id: string;
  label: string;
  color: string;
  cells: Map<string, string>;
}

export interface PresenceMatrixScene {
  id: string;
  name: string;
  chapterName: string;
  chapterColor: string;
}

export interface PresenceMatrixLayout {
  rows: PresenceMatrixRow[];
  scenes: PresenceMatrixScene[];
  sceneWidth: number;
  width: number;
  height: number;
}

export function buildPresenceMatrixLayout(
  scenes: PresenceMatrixScene[],
  rows: PresenceMatrixRow[],
): PresenceMatrixLayout {
  const sceneWidth = getPresenceMatrixSceneWidth(scenes.length);
  return {
    scenes,
    rows,
    sceneWidth,
    width: MATRIX_PADDING * 2 + MATRIX_LABEL_WIDTH + scenes.length * sceneWidth,
    height: MATRIX_PADDING * 2 + MATRIX_HEADER_HEIGHT + rows.length * MATRIX_ROW_HEIGHT,
  };
}

/** Espessura e opacidade do fio: presente o bastante para se seguir, discreto o bastante para
 *  doze séries empilhadas não virarem sopa. */
export const MATRIX_THREAD_WIDTH = 2;
export const MATRIX_THREAD_OPACITY = 0.35;
/** Vãos são tracejados; o traço acompanha a espessura para não sumir em zoom pequeno. */
export const MATRIX_THREAD_GAP_DASH = '5 4';

export interface MatrixThreadSegment {
  x1: number;
  x2: number;
  /** O trecho passa por cenas em que a série não aparece. */
  isGap: boolean;
}

/**
 * O fio de uma série: da primeira à última cena em que ela aparece, quebrado em trechos
 * sólidos (células vizinhas) e trechos de vão (cenas em que ela não está).
 *
 * Cada trecho começa na borda direita de uma célula e termina na borda esquerda da próxima:
 * o fio liga as células por fora, sem cruzar por baixo delas - o preenchimento translúcido
 * deixaria o risco aparecer por cima da nota.
 *
 * O fio deliberadamente **não** atravessa a faixa inteira. Uma linha reta de ponta a ponta
 * seria decorativa - cada série já ocupa uma faixa só dela - e ainda sugeriria presença onde
 * não há. Assim ele responde o que contar células não responde de relance: onde a série
 * começa, onde termina, e se ela é contínua ou aparece em rajadas.
 *
 * Devolve vazio para menos de duas aparições: uma cena só não tem trajeto.
 */
export function buildMatrixThreadSegments(
  row: PresenceMatrixRow,
  scenes: PresenceMatrixScene[],
  sceneWidth: number,
): MatrixThreadSegment[] {
  const columnOf = (index: number) => MATRIX_PADDING + MATRIX_LABEL_WIDTH + index * sceneWidth;
  const cellStart = (index: number) => columnOf(index) + MATRIX_CELL_INSET;
  const cellEnd = (index: number) => columnOf(index) + sceneWidth - MATRIX_CELL_INSET;
  const present = scenes.reduce<number[]>((indices, scene, index) => {
    if (row.cells.has(scene.id)) indices.push(index);
    return indices;
  }, []);
  if (present.length < 2) return [];

  return present.slice(1).map((index, position) => {
    const previous = present[position]!;
    return { x1: cellEnd(previous), x2: cellStart(index), isGap: index > previous + 1 };
  });
}

/** Centro vertical de uma faixa, onde o fio corre. */
export function matrixRowCenterY(rowIndex: number): number {
  return (
    MATRIX_PADDING + MATRIX_HEADER_HEIGHT + rowIndex * MATRIX_ROW_HEIGHT + MATRIX_ROW_HEIGHT / 2
  );
}
