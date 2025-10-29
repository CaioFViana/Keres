export interface Choice {
  id: string
  storyId: string
  sceneId: string
  nextSceneId: string
  text: string
  isImplicit: boolean
  createdAt: Date
  updatedAt: Date
  version: number
}
