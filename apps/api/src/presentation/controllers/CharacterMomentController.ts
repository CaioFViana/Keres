import type {
  CreateCharacterMomentUseCase,
  DeleteCharacterMomentUseCase,
  GetCharacterMomentsByCharacterIdUseCase,
  GetCharacterMomentsByMomentIdUseCase,
} from '@application/use-cases'
import type { Context } from 'hono'

import { CharacterMomentResponseSchema } from '@keres/shared'

export class CharacterMomentController {
  constructor(
    private readonly createCharacterMomentUseCase: CreateCharacterMomentUseCase,
    private readonly getCharacterMomentsByCharacterIdUseCase: GetCharacterMomentsByCharacterIdUseCase,
    private readonly getCharacterMomentsByMomentIdUseCase: GetCharacterMomentsByMomentIdUseCase,
    private readonly deleteCharacterMomentUseCase: DeleteCharacterMomentUseCase,
  ) {}

  async createCharacterMoment(c: Context) {
    const data = c.req.valid('json') // Validated by zValidator middleware

    try {
      const characterMoment = await this.createCharacterMomentUseCase.execute(data)
      return c.json(CharacterMomentResponseSchema.parse(characterMoment), 201)
    } catch (_error: unknown) {
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  }

  async getCharacterMomentsByCharacterId(c: Context) {
    const characterId = c.req.param('characterId') // Assuming characterId is passed as a param

    try {
      const characterMoments =
        await this.getCharacterMomentsByCharacterIdUseCase.execute(characterId)
      return c.json(
        characterMoments.map((cm) => CharacterMomentResponseSchema.parse(cm)),
        200,
      )
    } catch (_error) {
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  }

  async getCharacterMomentsByMomentId(c: Context) {
    const momentId = c.req.param('momentId') // Assuming momentId is passed as a param

    try {
      const characterMoments = await this.getCharacterMomentsByMomentIdUseCase.execute(momentId)
      return c.json(
        characterMoments.map((cm) => CharacterMomentResponseSchema.parse(cm)),
        200,
      )
    } catch (_error) {
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  }

  async deleteCharacterMoment(c: Context) {
    const characterId = c.req.query('characterId') // Assuming characterId is passed as a query param for delete
    const momentId = c.req.query('momentId') // Assuming momentId is passed as a query param for delete

    if (!characterId || !momentId) {
      return c.json({ error: 'characterId and momentId are required for deletion' }, 400)
    }

    try {
      const deleted = await this.deleteCharacterMomentUseCase.execute(characterId, momentId)
      if (!deleted) {
        return c.json({ error: 'CharacterMoment not found' }, 404)
      }
      return c.json({}, 204)
    } catch (_error) {
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  }
}
