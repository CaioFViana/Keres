export interface Gallery {
  id: string
  storyId: string
  ownerId: string // Can refer to character.id, notes.id, or locations.id
  ownerType: string // Can refer to character, notes, or locations or dang Item
  imagePath: string
  isFavorite: boolean
  extraNotes: string | null
  createdAt: Date
  updatedAt: Date
  version: number
  isDeleted: boolean // Added for conflict resolution (tombstones)
  deletedAt: number | null // Added for conflict resolution (tombstones)
}
