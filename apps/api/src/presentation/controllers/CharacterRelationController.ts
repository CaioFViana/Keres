import type {
  BulkDeleteCharacterRelationUseCase,
  CreateCharacterRelationUseCase,
  CreateManyCharacterRelationsUseCase,
  DeleteCharacterRelationUseCase,
  GetCharacterRelationsByCharIdUseCase,
  GetCharacterRelationUseCase,
  UpdateCharacterRelationUseCase,
  UpdateManyCharacterRelationsUseCase,
} from '@application/use-cases'
import type z from 'zod'

import {
  type CharacterRelationCreateSchema,
  CharacterRelationResponseSchema,
  type CharacterRelationUpdateSchema,
  CreateManyCharacterRelationsSchema,
  UpdateManyCharacterRelationsSchema,
} from '@keres/shared'

export class CharacterRelationController {
  constructor(
    private readonly createCharacterRelationUseCase: CreateCharacterRelationUseCase,
    private readonly getCharacterRelationUseCase: GetCharacterRelationUseCase,
    private readonly updateCharacterRelationUseCase: UpdateCharacterRelationUseCase,
    private readonly deleteCharacterRelationUseCase: DeleteCharacterRelationUseCase,
    private readonly bulkDeleteCharacterRelationUseCase: BulkDeleteCharacterRelationUseCase,
    private readonly getCharacterRelationsByCharIdUseCase: GetCharacterRelationsByCharIdUseCase,
    private readonly createManyCharacterRelationsUseCase: CreateManyCharacterRelationsUseCase,
    private readonly updateManyCharacterRelationsUseCase: UpdateManyCharacterRelationsUseCase,
  ) {}

  async createCharacterRelation(
    userId: string,
    data: z.infer<typeof CharacterRelationCreateSchema>,
  ) {
    const characterRelation = await this.createCharacterRelationUseCase.execute(userId, data)
    return CharacterRelationResponseSchema.parse(characterRelation)
  }

  async createManyCharacterRelations(
    userId: string,
    data: z.infer<typeof CreateManyCharacterRelationsSchema>,
  ) {
    const characterRelations = await this.createManyCharacterRelationsUseCase.execute(userId, data)
    return characterRelations.map((cr) => CharacterRelationResponseSchema.parse(cr))
  }

  async updateManyCharacterRelations(
    userId: string,
    data: z.infer<typeof UpdateManyCharacterRelationsSchema>,
  ) {
    const characterRelations = await this.updateManyCharacterRelationsUseCase.execute(userId, data)
    return characterRelations.map((cr) => CharacterRelationResponseSchema.parse(cr))
  }

  async getCharacterRelation(userId: string, id: string) {
    const characterRelation = await this.getCharacterRelationUseCase.execute(userId, id)
    if (!characterRelation) {
      throw new Error('Character relation not found')
    }
    return CharacterRelationResponseSchema.parse(characterRelation)
  }

  async getCharacterRelationsByCharId(userId: string, charId: string) {
    const characterRelations = await this.getCharacterRelationsByCharIdUseCase.execute(
      userId,
      charId,
    )
    return characterRelations.map((cr) => CharacterRelationResponseSchema.parse(cr))
  }

  async updateCharacterRelation(
    userId: string,
    id: string,
    data: z.infer<typeof CharacterRelationUpdateSchema>,
  ) {
    const updatedCharacterRelation = await this.updateCharacterRelationUseCase.execute(userId, {
      id,
      relationType: data.relationType,
    })
    if (!updatedCharacterRelation) {
      throw new Error('Character relation not found')
    }
    return CharacterRelationResponseSchema.parse(updatedCharacterRelation)
  }

  async deleteCharacterRelation(userId: string, id: string) {
    const deleted = await this.deleteCharacterRelationUseCase.execute(userId, id)
    if (!deleted) {
      throw new Error('Character relation not found')
    }
    return
  }

  async bulkDeleteCharacterRelations(userId: string, ids: string[]) {
    const result = await this.bulkDeleteCharacterRelationUseCase.execute(userId, ids)
    return result
  }
}
