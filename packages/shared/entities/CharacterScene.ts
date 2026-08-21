export interface CharacterScene {
  id: string;
  characterId: string;
  storyId: string;
  sceneId: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean; // Added for conflict resolution (tombstones)
  deletedAt: Date | null; // Added for conflict resolution (tombstones)
}
