export interface CreateChoiceDTO {
  sceneId: string
  nextSceneId: string
  text: string
  isImplicit?: boolean
}

export interface UpdateChoiceDTO {
  id: string
  sceneId?: string
  nextSceneId?: string
  text?: string
  isImplicit?: boolean
}

export interface ChoiceProfileDTO {
  id: string
  sceneId: string
  nextSceneId: string
  text: string
  isImplicit: boolean
  createdAt: Date
  updatedAt: Date
}
