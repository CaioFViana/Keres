export interface CreateMomentDTO {
  sceneId: string
  name: string
  location?: string | null
  index: number
  summary?: string | null
  isFavorite?: boolean
  extraNotes?: string | null
}

export interface UpdateMomentDTO {
  id: string
  sceneId: string
  name?: string
  location?: string | null
  index?: number
  summary?: string | null
  isFavorite?: boolean
  extraNotes?: string | null
}

export interface MomentProfileDTO {
  id: string
  sceneId: string
  name: string
  location: string | null
  index: number
  summary: string | null
  isFavorite: boolean
  extraNotes: string | null
  createdAt: Date
  updatedAt: Date
}
