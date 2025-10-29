export interface Suggestion {
  id: string
  storyId: string
  type: string
  value: string
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
  version: number
}
