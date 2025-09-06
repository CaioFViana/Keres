import type {
  CreateCharacterMomentUseCase,
  DeleteCharacterMomentUseCase,
  GetCharacterMomentsByCharacterIdUseCase,
  GetCharacterMomentsByMomentIdUseCase,
} from '@application/use-cases'
import type z from 'zod'

import { type CharacterMomentCreateSchema, CharacterMomentResponseSchema } from '@keres/shared'

export class CharacterMomentController {
  constructor(
    private readonly createCharacterMomentUseCase: CreateCharacterMomentUseCase,
    private readonly getCharacterMomentsByCharacterIdUseCase: GetCharacterMomentsByCharacterIdUseCase,
    private readonly getCharacterMomentsByMomentIdUseCase: GetCharacterMomentsByMomentIdUseCase,
    private readonly deleteCharacterMomentUseCase: DeleteCharacterMomentUseCase,
  ) {}

  async createCharacterMoment(userId: string, data: z.infer<typeof CharacterMomentCreateSchema>) {
    const characterMoment = await this.createCharacterMomentUseCase.execute(userId, data)
    return CharacterMomentResponseSchema.parse(characterMoment)
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
}
