export interface CreateStoryDTO {
  userId: string
  type?: 'linear' | 'branching' // Default to 'linear'
  title: string
  summary?: string
  genre?: string
  language?: string
  isFavorite?: boolean
  extraNotes?: string
}

export interface UpdateStoryDTO {
  id: string
  userId: string
  type?: 'linear' | 'branching'
  title?: string
  summary?: string
  genre?: string
  language?: string
  isFavorite?: boolean
  extraNotes?: string
}

export interface StoryProfileDTO {
  id: string
  userId: string
  type: 'linear' | 'branching'
  title: string
  summary: string | null
  genre: string | null
  language: string | null
  isFavorite: boolean
  extraNotes: string | null
  createdAt: Date
  updatedAt: Date
}
