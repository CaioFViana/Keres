import type {
  CreateCharacterRelationUseCase,
  DeleteCharacterRelationUseCase,
  GetCharacterRelationsByCharIdUseCase,
  GetCharacterRelationUseCase,
  UpdateCharacterRelationUseCase,
} from '@application/use-cases'
import type z from 'zod'

import {
  type CharacterRelationCreateSchema,
  CharacterRelationResponseSchema,
  type CharacterRelationUpdateSchema,
} from '@keres/shared'

export class CharacterRelationController {
  constructor(
    private readonly createCharacterRelationUseCase: CreateCharacterRelationUseCase,
    private readonly getCharacterRelationUseCase: GetCharacterRelationUseCase,
    private readonly updateCharacterRelationUseCase: UpdateCharacterRelationUseCase,
    private readonly deleteCharacterRelationUseCase: DeleteCharacterRelationUseCase,
    private readonly getCharacterRelationsByCharIdUseCase: GetCharacterRelationsByCharIdUseCase,
  ) {}

  async createCharacterRelation(data: z.infer<typeof CharacterRelationCreateSchema>) {
    const characterRelation = await this.createCharacterRelationUseCase.execute(data)
    return CharacterRelationResponseSchema.parse(characterRelation)
  }

  async getCharacterRelation(id: string) {
    const characterRelation = await this.getCharacterRelationUseCase.execute(id)
    if (!characterRelation) {
      throw new Error('Character relation not found')
    }
    return CharacterRelationResponseSchema.parse(characterRelation)
  }

  async getCharacterRelationsByCharId(charId: string) {
    const characterRelations = await this.getCharacterRelationsByCharIdUseCase.execute(charId)
    return characterRelations.map((cr) => CharacterRelationResponseSchema.parse(cr))
  }

  async updateCharacterRelation(id: string, data: z.infer<typeof CharacterRelationUpdateSchema>) {
    const { id: dataId, ...updateData } = data
    const updatedCharacterRelation = await this.updateCharacterRelationUseCase.execute({
      id,
      ...updateData,
    })
    if (!updatedCharacterRelation) {
      throw new Error('Character relation not found')
    }
    return CharacterRelationResponseSchema.parse(updatedCharacterRelation)
  }

  async deleteCharacterRelation(id: string) {
    const deleted = await this.deleteCharacterRelationUseCase.execute(id)
    if (!deleted) {
      throw new Error('Character relation not found')
    }
    return
  }
}
