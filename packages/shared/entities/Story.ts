export type FavoriteBehavior = 'global' | 'individual' | 'individual_public'

export interface Story {
  id: string
  userId: string // ID of the user who owns this story
  title: string
  type: 'linear' | 'branching'
  description: string | null
  genre: string | null
  language: string | null
  // Free-text credit for who wrote the story, separate from `userId` (the account that
  // owns/manages it in the app) - e.g. the original author for an imported public-domain tale.
  author: string | null
  isFavorite: boolean
  favoriteBehavior: FavoriteBehavior
  extraNotes: string | null
  theme: string | null
  normalizeSceneTiming: boolean
  // Só é relevante (e só exibido na UI) para histórias vinculadas a um servidor - histórias
  // locais só têm o papel 'owner', então a distinção reader/writer não existe para elas.
  allowReaderComments: boolean
  // Optional: ID of the server this story is synchronized with.
  // This ID references an entry in the local 'Server' entity.
  // If null or undefined, the story is considered offline-only.
  serverId: string | null
  lastOperationLog: number,
  lastServerSyncedLog: number,

  createdAt: Date
  updatedAt: Date
  version: number
  isDeleted: boolean // Added for conflict resolution (tombstones)
  deletedAt: Date | null // Added for conflict resolution (tombstones)
}
