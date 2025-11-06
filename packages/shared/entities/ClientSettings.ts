export interface ClientSettings {
  id: string; // ULID for unique identification
  localUsername: string; // Local display name for the client
  language: string; // Preferred language for this device
  darkMode: boolean; // Preferred dark mode setting for this device
  createdAt: Date;
  updatedAt: Date;
  version: number; // For synchronization and conflict resolution
  isDeleted: boolean; // For tombstone-based conflict resolution
  deletedAt: number | null; // For tombstone-based conflict resolution
}
