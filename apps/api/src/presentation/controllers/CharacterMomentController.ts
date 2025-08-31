import type {
  CreateCharacterMomentUseCase,
  DeleteCharacterMomentUseCase,
  GetCharacterMomentsByCharacterIdUseCase,
  GetCharacterMomentsByMomentIdUseCase,
} from '@application/use-cases'

import { CharacterMomentCreateSchema, CharacterMomentResponseSchema } from '@keres/shared'
import z from 'zod'

export class CharacterMomentController {
  constructor(
    private readonly createCharacterMomentUseCase: CreateCharacterMomentUseCase,
    private readonly getCharacterMomentsByCharacterIdUseCase: GetCharacterMomentsByCharacterIdUseCase,
    private readonly getCharacterMomentsByMomentIdUseCase: GetCharacterMomentsByMomentIdUseCase,
    private readonly deleteCharacterMomentUseCase: DeleteCharacterMomentUseCase,
  ) {}

  async createCharacterMoment(data: z.infer<typeof CharacterMomentCreateSchema>) {
    const characterMoment = await this.createCharacterMomentUseCase.execute(data)
    return CharacterMomentResponseSchema.parse(characterMoment)
  }

  async getCharacterMomentsByCharacterId(characterId: string) {
    const characterMoments = await this.getCharacterMomentsByCharacterIdUseCase.execute(characterId)
    return characterMoments.map((cm) => CharacterMomentResponseSchema.parse(cm))
  }

  async getCharacterMomentsByMomentId(momentId: string) {
    const characterMoments = await this.getCharacterMomentsByMomentIdUseCase.execute(momentId)
    return characterMoments.map((cm) => CharacterMomentResponseSchema.parse(cm))
  }

  async deleteCharacterMoment(characterId: string, momentId: string) {
    if (!characterId || !momentId) {
      throw new Error('characterId and momentId are required for deletion')
    }
    const deleted = await this.deleteCharacterMomentUseCase.execute(characterId, momentId)
    if (!deleted) {
      throw new Error('CharacterMoment not found')
    }
    return
  }
}
