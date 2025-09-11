export interface Suggestion {
  id: string
  userId: string
  scope: 'global' | 'story'
  storyId: string | null
  type: string
  value: string
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}
