export interface Choice {
  id: string
  storyId: string
  sceneId: string
  nextSceneId: string
  text: string
  notes: string | null
  createdAt: Date
  updatedAt: Date
  version: number
  isDeleted: boolean // Added for conflict resolution (tombstones)
  deletedAt: Date | null // Added for conflict resolution (tombstones)
}
