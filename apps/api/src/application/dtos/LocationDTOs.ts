export interface CreateLocationDTO {
  storyId: string
  name: string
  description?: string | null
  climate?: string | null
  culture?: string | null
  politics?: string | null
  isFavorite?: boolean
  extraNotes?: string | null
}

export interface UpdateLocationDTO {
  id: string
  storyId: string
  name?: string
  description?: string | null
  climate?: string | null
  culture?: string | null
  politics?: string | null
  isFavorite?: boolean
  extraNotes?: string | null
}

export interface LocationProfileDTO {
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
