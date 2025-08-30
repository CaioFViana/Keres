export interface Story {
  id: string
  userId: string
  title: string
  summary: string | null
  genre: string | null
  language: string | null
  isFavorite: boolean
  extraNotes: string | null
  createdAt: Date
  updatedAt: Date
}
