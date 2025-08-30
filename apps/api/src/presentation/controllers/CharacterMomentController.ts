import { Context } from 'hono';
import {
  CreateCharacterMomentUseCase,
  GetCharacterMomentsByCharacterIdUseCase,
  GetCharacterMomentsByMomentIdUseCase,
  DeleteCharacterMomentUseCase,
} from '@application/use-cases';
import { createCharacterMomentSchema, characterMomentProfileSchema } from '@presentation/schemas/CharacterMomentSchemas';

export class CharacterMomentController {
  constructor(
    private readonly createCharacterMomentUseCase: CreateCharacterMomentUseCase,
    private readonly getCharacterMomentsByCharacterIdUseCase: GetCharacterMomentsByCharacterIdUseCase,
    private readonly getCharacterMomentsByMomentIdUseCase: GetCharacterMomentsByMomentIdUseCase,
    private readonly deleteCharacterMomentUseCase: DeleteCharacterMomentUseCase
  ) {}

  async createCharacterMoment(c: Context) {
    const body = await c.req.json();
    const validation = createCharacterMomentSchema.safeParse(body);

    if (!validation.success) {
      return c.json({ error: validation.error.errors }, 400);
    }

    try {
      const characterMomentProfile = await this.createCharacterMomentUseCase.execute(validation.data);
      return c.json(characterMomentProfileSchema.parse(characterMomentProfile), 201);
    } catch (error: any) {
      console.error('Error creating character moment:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async getCharacterMomentsByCharacterId(c: Context) {
    const characterId = c.req.param('characterId');

    try {
      const characterMoments = await this.getCharacterMomentsByCharacterIdUseCase.execute(characterId);
      return c.json(characterMoments.map(cm => characterMomentProfileSchema.parse(cm)), 200);
    } catch (error: any) {
      console.error('Error getting character moments by character ID:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async getCharacterMomentsByMomentId(c: Context) {
    const momentId = c.req.param('momentId');

    try {
      const characterMoments = await this.getCharacterMomentsByMomentIdUseCase.execute(momentId);
      return c.json(characterMoments.map(cm => characterMomentProfileSchema.parse(cm)), 200);
    } catch (error: any) {
      console.error('Error getting character moments by moment ID:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async deleteCharacterMoment(c: Context) {
    const characterId = c.req.param('characterId');
    const momentId = c.req.param('momentId');

    try {
      const deleted = await this.deleteCharacterMomentUseCase.execute(characterId, momentId);
      if (!deleted) {
        return c.json({ error: 'Character moment not found' }, 404);
      }
      return c.json({ message: 'Character moment deleted successfully' }, 200);
    } catch (error: any) {
      console.error('Error deleting character moment:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }
}
