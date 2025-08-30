export interface Location {
  id: string
  storyId: string
  name: string
  description: string | null
  climate: string | null
  culture: string | null
  politics: string | null
  isFavorite: boolean
  extraNotes: string | null
  createdAt: Date
  updatedAt: Date
}
