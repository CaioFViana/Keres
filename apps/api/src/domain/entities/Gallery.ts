export interface Gallery {
  id: string
  storyId: string
  ownerId: string // Can refer to character.id, notes.id, or locations.id
  ownerType: 'character' | 'note' | 'location'
  imagePath: string
  isFile: boolean
  isFavorite: boolean
  extraNotes: string | null
  createdAt: Date
  updatedAt: Date
}
