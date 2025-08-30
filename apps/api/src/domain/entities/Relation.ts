export interface Relation {
  id: string
  charIdSource: string
  charIdTarget: string
  sceneId: string | null
  momentId: string | null
  summary: string | null
  isFavorite: boolean
  extraNotes: string | null
  createdAt: Date
  updatedAt: Date
}
