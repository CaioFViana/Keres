export interface CharacterScene {
  characterId: string
  storyId: string
  sceneId: string
  createdAt: Date
  updatedAt: Date
  version: number
  isDeleted: boolean // Added for conflict resolution (tombstones)
  deletedAt: number | null // Added for conflict resolution (tombstones)
}
