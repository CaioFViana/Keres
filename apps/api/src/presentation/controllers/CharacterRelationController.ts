import type {
  CreateCharacterRelationUseCase,
  DeleteCharacterRelationUseCase,
  GetCharacterRelationsByCharIdUseCase,
  GetCharacterRelationUseCase,
  UpdateCharacterRelationUseCase,
} from '@application/use-cases'

import { CharacterRelationCreateSchema, CharacterRelationResponseSchema } from '@keres/shared'
import z from 'zod'

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
    const updatedCharacterRelation = await this.updateCharacterRelationUseCase.execute({
      id,
      ...data,
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
