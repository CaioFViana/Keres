export interface CharacterRelation {
  id: string
  storyId: string
  charId1: string
  charId2: string
  relationType: string
  createdAt: Date
  updatedAt: Date
  version: number
  isDeleted: boolean // Added for conflict resolution (tombstones)
  deletedAt: number | null // Added for conflict resolution (tombstones)
}
