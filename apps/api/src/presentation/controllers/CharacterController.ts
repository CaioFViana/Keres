import { Context } from 'hono';
import {
  CreateCharacterUseCase,
  GetCharacterUseCase,
  UpdateCharacterUseCase,
  DeleteCharacterUseCase,
  GetCharactersByStoryIdUseCase,
} from '@application/use-cases';
import { CharacterCreateSchema, CharacterUpdateSchema, CharacterResponseSchema } from '@keres/shared';

export class CharacterController {
  constructor(
    private readonly createCharacterUseCase: CreateCharacterUseCase,
    private readonly getCharacterUseCase: GetCharacterUseCase,
    private readonly updateCharacterUseCase: UpdateCharacterUseCase,
    private readonly deleteCharacterUseCase: DeleteCharacterUseCase,
    private readonly getCharactersByStoryIdUseCase: GetCharactersByStoryIdUseCase
  ) {}

  async createCharacter(c: Context) {
    const data = c.req.valid('json'); // Validated by zValidator middleware

    try {
      const character = await this.createCharacterUseCase.execute(data);
      return c.json(CharacterResponseSchema.parse(character), 201);
    } catch (error: any) {
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async getCharacter(c: Context) {
    const characterId = c.req.param('id');

    try {
      const character = await this.getCharacterUseCase.execute(characterId);
      if (!character) {
        return c.json({ error: 'Character not found' }, 404);
      }
      return c.json(CharacterResponseSchema.parse(character), 200);
    } catch (error) {
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async getCharactersByStoryId(c: Context) {
    const storyId = c.req.param('storyId'); // Assuming storyId is passed as a param

    try {
      const characters = await this.getCharactersByStoryIdUseCase.execute(storyId);
      return c.json(characters.map(character => CharacterResponseSchema.parse(character)), 200);
    } catch (error) {
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async updateCharacter(c: Context) {
    const characterId = c.req.param('id');
    const data = c.req.valid('json'); // Validated by zValidator middleware

    try {
      const updatedCharacter = await this.updateCharacterUseCase.execute({ id: characterId, ...data });
      return c.json(CharacterResponseSchema.parse(updatedCharacter), 200);
    } catch (error: any) {
      if (error.message === 'Character not found') {
        return c.json({ error: error.message }, 404);
      }
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async deleteCharacter(c: Context) {
    const characterId = c.req.param('id');

    try {
      await this.deleteCharacterUseCase.execute(characterId);
      return c.json({}, 204);
    } catch (error) {
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }
}