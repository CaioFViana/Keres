export interface Story {
  id: string
  userId: string // ID of the user who owns this story
  title: string
  type: 'linear' | 'branching'
  description: string | null // Changed from summary to description
  genre: string | null
  language: string | null
  isFavorite: boolean
  extraNotes: string | null
  // Optional: ID of the server this story is synchronized with.
  // This ID references an entry in the local 'Server' entity.
  // If null or undefined, the story is considered offline-only.
  serverId: string | null
  createdAt: Date
  updatedAt: Date
  version: number
  isDeleted: boolean // Added for conflict resolution (tombstones)
  deletedAt: Date | null // Added for conflict resolution (tombstones)
}
