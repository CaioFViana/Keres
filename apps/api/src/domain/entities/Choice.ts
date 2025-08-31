export interface Choice {
  id: string
  sceneId: string
  nextSceneId: string
  text: string
  isImplicit: boolean
  createdAt: Date
  updatedAt: Date
}
