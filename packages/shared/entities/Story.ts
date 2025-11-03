export interface Story {
  id: string
  title: string
  type: 'linear' | 'branching'
  summary: string | null
  genre: string | null
  language: string | null
  isFavorite: boolean
  extraNotes: string | null
  createdAt: Date
  updatedAt: Date
  version: number
  isDeleted: boolean // Added for conflict resolution (tombstones)
  deletedAt: number | null // Added for conflict resolution (tombstones)
  // Optional: ID of the server this story is synchronized with.
  // This ID references an entry in the local 'Server' entity.
  // If null or undefined, the story is considered offline-only.
  // Authentication tokens (authToken, refreshToken) for the associated server
  // should be stored securely using platform-specific secure storage
  // (e.g., expo-secure-store) and NOT directly in this entity.
  serverId?: string
}
