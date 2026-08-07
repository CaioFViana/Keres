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
  deletedAt: Date | null // Added for conflict resolution (tombstones)
}

export interface ServerCharacterRelationPayload {
  id: string
  storyId: string
  character1Id: string
  character2Id: string
  relationType: string
  createdAt: Date
  updatedAt: Date
  version: number
  isDeleted: boolean
  deletedAt: Date | null
}
