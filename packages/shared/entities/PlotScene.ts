/**
 * Limite da nota de uma relação Plot-Cena: uma linha curta explicando o papel daquela cena
 * naquela trama, não um segundo resumo da cena.
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
