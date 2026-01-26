export interface Item {
  id: string
  storyId: string
  characterOwnerId: string | null
  name: string
  category: string | null // Will be added on Suggestion system!
  description: string | null // Ex: a sword that belonged to a knight
  initialState: string | null // Ex: Rusty.
  isFavorite: boolean
  extraNotes: string | null
  createdAt: Date
  updatedAt: Date
  version: number
  isDeleted: boolean // Added for conflict resolution (tombstones)
  deletedAt: Date | null // Added for conflict resolution (tombstones)
}

export interface ItemJourney {
  id: string
  storyId: string
  itemId: string
  sceneId: string
  newCharacterOwnerId: string | null // A it could have changed hands
  newState: string // As during this event or before this event the item could have changed somehow. Ex: blacksmith polished it. Polished now.

  extraNotes: string | null
  createdAt: Date
  updatedAt: Date
  version: number
  isDeleted: boolean // Added for conflict resolution (tombstones)
  deletedAt: Date | null // Added for conflict resolution (tombstones)
}
