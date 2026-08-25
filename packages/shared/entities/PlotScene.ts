/**
 * The limit for a plot-scene relation's note: a short line explaining that scene's role in that
 * plot, not a second summary of the scene.
 */
export const PLOT_SCENE_NOTE_MAX_LENGTH = 160;

export interface PlotScene {
  id: string;
  storyId: string;
  plotId: string;
  sceneId: string;
  note: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean;
  deletedAt: Date | null;
}
