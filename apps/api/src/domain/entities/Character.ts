export interface Character {
  id: string
  storyId: string
  name: string
  gender: string | null
  race: string | null
  subrace: string | null
  personality: string | null
  motivation: string | null
  qualities: string | null
  weaknesses: string | null
  biography: string | null
  plannedTimeline: string | null
  isFavorite: boolean
  extraNotes: string | null
  createdAt: Date
  updatedAt: Date
}
