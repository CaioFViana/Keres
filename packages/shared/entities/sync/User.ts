export interface User {
  // Friends/contacts/ppl related to your story
  idUser: string // Friends id there.
  idServer: string
  displayName: string // Publicly visible name
  createdAt: Date
  updatedAt: Date
  version: number // For synchronization and conflict resolution
  isDeleted: boolean // For tombstone-based conflict resolution
  deletedAt: number | null // For tombstone-based conflict resolution
}
