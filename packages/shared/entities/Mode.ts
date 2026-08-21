/**
 * Um estado alternativo de um personagem ao longo da obra ("Desperto", "Depois do treinamento").
 *
 * Independente do sistema de status: modos existem mesmo com `Story.statSystem` desligado, porque
 * descrever o que muda numa transformação é útil por si só. Quando o sistema está ligado, cada
 * modo pode sobrescrever os valores de stats do personagem (ver `StatRelation.modeId`).
 */
export interface Mode {
  id: string;
  storyId: string;
  characterId: string;
  name: string;
  /** O que muda nesta forma, em texto livre. */
  modeChanges: string | null;
  /** Ordem de exibição, crescente. */
  order: number;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean;
  deletedAt: Date | null;
}
