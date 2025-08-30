export interface CreateRelationDTO {
  charIdSource: string
  charIdTarget: string
  sceneId?: string | null
  momentId?: string | null
  summary?: string | null
  isFavorite?: boolean
  extraNotes?: string | null
}

export interface UpdateRelationDTO {
  id: string
  charIdSource?: string
  charIdTarget?: string
  sceneId?: string | null
  momentId?: string | null
  summary?: string | null
  isFavorite?: boolean
  extraNotes?: string | null
}

export interface RelationProfileDTO {
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
