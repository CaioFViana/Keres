export interface Suggestion {
  id: string
  storyId: string
  type: string
  value: string
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
  version: number
  isDeleted: boolean // Added for conflict resolution (tombstones)
  deletedAt: Date | null // Added for conflict resolution (tombstones)
}
