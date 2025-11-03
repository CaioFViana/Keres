export interface Scene {
  id: string
  storyId: string
  chapterId: string
  locationId: string
  name: string
  index: number
  summary: string | null
  gap: number | null
  gapType: string | null
  duration: number | null
  durationType: string | null
  isFavorite: boolean
  extraNotes: string | null
  createdAt: Date
  updatedAt: Date
  version: number
  isDeleted: boolean // Added for conflict resolution (tombstones)
  deletedAt: number | null // Added for conflict resolution (tombstones)
}
