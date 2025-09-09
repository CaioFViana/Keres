import type {
  BulkDeleteCharacterMomentUseCase,
  CreateCharacterMomentUseCase,
  CreateManyCharacterMomentsUseCase,
  DeleteCharacterMomentUseCase,
  GetCharacterMomentsByCharacterIdUseCase,
  GetCharacterMomentsByMomentIdUseCase,
  UpdateManyCharacterMomentsUseCase,
} from '@application/use-cases'
import type z from 'zod'

import {
  type CharacterMomentCreateSchema,
  CharacterMomentResponseSchema,
  type CharacterMomentUpdateSchema,
} from '@keres/shared'

export class CharacterMomentController {
  constructor(
    private readonly createCharacterMomentUseCase: CreateCharacterMomentUseCase,
    private readonly getCharacterMomentsByCharacterIdUseCase: GetCharacterMomentsByCharacterIdUseCase,
    private readonly getCharacterMomentsByMomentIdUseCase: GetCharacterMomentsByMomentIdUseCase,
    private readonly deleteCharacterMomentUseCase: DeleteCharacterMomentUseCase,
    private readonly bulkDeleteCharacterMomentUseCase: BulkDeleteCharacterMomentUseCase,
    private readonly createManyCharacterMomentsUseCase: CreateManyCharacterMomentsUseCase,
    private readonly updateManyCharacterMomentsUseCase: UpdateManyCharacterMomentsUseCase,
  ) {}

  async createCharacterMoment(userId: string, data: z.infer<typeof CharacterMomentCreateSchema>) {
    const characterMoment = await this.createCharacterMomentUseCase.execute(userId, data)
    return CharacterMomentResponseSchema.parse(characterMoment)
  }

  async createManyCharacterMoments(
    userId: string,
    data: z.infer<typeof CharacterMomentCreateSchema>[],
  ) {
    const characterMoments = await this.createManyCharacterMomentsUseCase.execute(userId, data)
    return characterMoments.map((cm) => CharacterMomentResponseSchema.parse(cm))
  }

  async updateManyCharacterMoments(
    userId: string,
    data: z.infer<typeof CharacterMomentUpdateSchema>[],
  ) {
    const characterMoments = await this.updateManyCharacterMomentsUseCase.execute(userId, data)
    return characterMoments.map((cm) => CharacterMomentResponseSchema.parse(cm))
  }

  async getCharacterMomentsByCharacterId(userId: string, characterId: string) {
    const characterMoments = await this.getCharacterMomentsByCharacterIdUseCase.execute(
      userId,
      characterId,
    )
    return characterMoments.map((cm) => CharacterMomentResponseSchema.parse(cm))
  }

  async getCharacterMomentsByMomentId(userId: string, momentId: string) {
    const characterMoments = await this.getCharacterMomentsByMomentIdUseCase.execute(
      userId,
      momentId,
    )
    return characterMoments.map((cm) => CharacterMomentResponseSchema.parse(cm))
  }

  async deleteCharacterMoment(userId: string, characterId: string, momentId: string) {
    if (!characterId || !momentId) {
      throw new Error('characterId and momentId are required for deletion')
    }
    const deleted = await this.deleteCharacterMomentUseCase.execute(userId, characterId, momentId)
    if (!deleted) {
      throw new Error('CharacterMoment not found')
    }
    return
  }

  async bulkDeleteCharacterMoments(
    userId: string,
    ids: { characterId: string; momentId: string }[],
  ) {
    const result = await this.bulkDeleteCharacterMomentUseCase.execute(userId, ids)
    return result
  }
}
