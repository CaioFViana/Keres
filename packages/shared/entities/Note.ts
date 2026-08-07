export interface Note {
  id: string
  storyId: string
  title: string
  body: string | null
  isFavorite: boolean
  extraNotes: string | null
  createdAt: Date
  updatedAt: Date
  version: number
  isDeleted: boolean // Added for conflict resolution (tombstones)
  deletedAt: Date | null // Added for conflict resolution (tombstones)
}

export interface NoteRelation {
  id: string
  storyId: string
  noteId: string
  relationId: string
  relationType: string // One of specific entities. Like Character, Location, Scene...
  
  createdAt: Date
  updatedAt: Date
  version: number
  isDeleted: boolean // Added for conflict resolution (tombstones)
  deletedAt: Date | null // Added for conflict resolution (tombstones)
}

export type NoteRelationEntities = 'Character' | 'WorldRule' | 'Location' | 'Scene' | 'Chapter' | 'Choice' | 'Item' | 'ItemJourney';