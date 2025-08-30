export interface CreateCharacterMomentDTO {
  characterId: string
  momentId: string
}

export interface CharacterMomentProfileDTO {
  characterId: string
  momentId: string
  createdAt: Date
  updatedAt: Date
}
