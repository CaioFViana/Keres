export interface Tag {
  id: string
  storyId: string
  name: string
  color: string | null
  isFavorite: boolean
  extraNotes: string | null
  createdAt: Date
  updatedAt: Date
  version: number
  isDeleted: boolean // Added for conflict resolution (tombstones)
  deletedAt: Date | null // Added for conflict resolution (tombstones)
}

export interface TagRelation {
  id: string
  storyId: string
  tagId: string
  relationId: string
  relationType: string // One of specific entities. Like Character, Location, Scene...
  
  createdAt: Date
  updatedAt: Date
  version: number
  isDeleted: boolean // Added for conflict resolution (tombstones)
  deletedAt: Date | null // Added for conflict resolution (tombstones)
}