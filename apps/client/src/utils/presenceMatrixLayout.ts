export const MATRIX_PADDING = 24;
export const MATRIX_LABEL_WIDTH = 154;
export const MATRIX_SCENE_WIDTH = 124;
export const MATRIX_HEADER_HEIGHT = 82;
export const MATRIX_ROW_HEIGHT = 58;

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
