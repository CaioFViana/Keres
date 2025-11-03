export interface User {
  id: string
  username: string
  displayName?: string // Publicly visible name
  avatarUrl?: string // URL to user's avatar
  createdAt: Date
  updatedAt: Date
  version: number // For synchronization and conflict resolution
  isDeleted: boolean // For tombstone-based conflict resolution
  deletedAt: number | null // For tombstone-based conflict resolution
  sourceServerId?: string // ID of the server this user originated from (for remote users)
}
