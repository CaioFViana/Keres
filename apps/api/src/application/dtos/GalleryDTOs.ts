export interface CreateGalleryDTO {
  storyId: string
  ownerId: string // Can refer to character.id, notes.id, or locations.id
  imagePath: string
  isFile?: boolean
  isFavorite?: boolean
  extraNotes?: string | null
}

export interface UpdateGalleryDTO {
  id: string
  storyId: string
  ownerId?: string // Can refer to character.id, notes.id, or locations.id
  imagePath?: string
  isFile?: boolean
  isFavorite?: boolean
  extraNotes?: string | null
}

export interface GalleryProfileDTO {
  id: string
  storyId: string
  ownerId: string
  imagePath: string
  isFile: boolean
  isFavorite: boolean
  extraNotes: string | null
  createdAt: Date
  updatedAt: Date
}
