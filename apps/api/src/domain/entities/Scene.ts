export interface Scene {
  id: string
  chapterId: string
  locationId: string
  name: string
  index: number
  summary: string | null
  gap: string | null // Storing as text for now
  duration: string | null // Storing as text for now
  isFavorite: boolean
  extraNotes: string | null
  createdAt: Date
  updatedAt: Date
}
