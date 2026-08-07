export interface Choice {
  id: string
  storyId: string
  sceneId: string
  nextSceneId: string
  text: string
  createdAt: Date
  updatedAt: Date
  version: number
  isDeleted: boolean // Added for conflict resolution (tombstones)
  deletedAt: Date | null // Added for conflict resolution (tombstones)
}
