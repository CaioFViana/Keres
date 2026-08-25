export const MATRIX_PADDING = 24;
export const MATRIX_LABEL_WIDTH = 154;
export const MATRIX_SCENE_WIDTH = 124;
export const MATRIX_HEADER_HEIGHT = 82;
export const MATRIX_ROW_HEIGHT = 58;
/**
 * Breathing room between a column's border and the cell drawn inside it. It lives here, instead of
 * a loose `10` in each drawing, because the series thread is clipped by exactly this value: if the
 * cell and the thread disagree about where the cell starts, one invades the other.
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

/**
 * Thickness and opacity of the thread: present enough to be followed, discreet enough that twelve
 * stacked series do not turn into soup.
 */
export const MATRIX_THREAD_WIDTH = 2;
export const MATRIX_THREAD_OPACITY = 0.35;
/** Gaps are dashed; the dash follows the thickness so it does not vanish at small zoom levels. */
export const MATRIX_THREAD_GAP_DASH = '5 4';

export interface MatrixThreadSegment {
  x1: number;
  x2: number;
  /** The stretch passes through scenes in which the series does not appear. */
  isGap: boolean;
}

/**
 * A series' thread: from the first to the last scene in which it appears, broken into solid
 * stretches (neighbouring cells) and gap stretches (scenes it is not in).
 *
 * Each stretch starts at one cell's right border and ends at the next one's left border: the thread
 * links the cells from outside, without crossing underneath them - the translucent fill would let
 * the stroke show through over the note.
 *
 * The thread deliberately does **not** cross the whole band. A straight line from end to end would
 * be decorative - each series already has a band of its own - and would also suggest presence where
 * there is none. This way it answers what counting cells does not answer at a glance: where the
 * series starts, where it ends, and whether it is continuous or shows up in bursts.
 *
 * Returns empty for fewer than two appearances: a single scene has no trajectory.
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
