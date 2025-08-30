export interface CreateCharacterRelationDTO {
  charId1: string;
  charId2: string;
  relationType: string;
}

export interface UpdateCharacterRelationDTO {
  id: string;
  charId1?: string;
  charId2?: string;
  relationType?: string;
}

export interface CharacterRelationProfileDTO {
  id: string;
  charId1: string;
  charId2: string;
  relationType: string;
  createdAt: Date;
  updatedAt: Date;
}
