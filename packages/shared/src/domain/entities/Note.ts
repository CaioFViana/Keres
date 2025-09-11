export interface Note {
  id: string
  storyId: string
  title: string
  body: string | null
  galleryId: string | null
  isFavorite: boolean
  createdAt: Date
  updatedAt: Date
}
