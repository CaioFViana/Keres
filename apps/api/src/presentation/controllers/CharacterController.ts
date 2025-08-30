import { Context } from 'hono';
import {
  CreateCharacterUseCase,
  GetCharacterUseCase,
  GetCharactersByStoryIdUseCase,
  UpdateCharacterUseCase,
  DeleteCharacterUseCase,
} from '@application/use-cases';
import { createCharacterSchema, updateCharacterSchema, characterProfileSchema } from '@presentation/schemas/CharacterSchemas';

export class CharacterController {
  constructor(
    private readonly createCharacterUseCase: CreateCharacterUseCase,
    private readonly getCharacterUseCase: GetCharacterUseCase,
    private readonly getCharactersByStoryIdUseCase: GetCharactersByStoryIdUseCase,
    private readonly updateCharacterUseCase: UpdateCharacterUseCase,
    private readonly deleteCharacterUseCase: DeleteCharacterUseCase
  ) {}

  async createCharacter(c: Context) {
    const body = await c.req.json();
    const validation = createCharacterSchema.safeParse(body);

    if (!validation.success) {
      return c.json({ error: validation.error.errors }, 400);
    }

    try {
      const characterProfile = await this.createCharacterUseCase.execute(validation.data);
      return c.json(characterProfileSchema.parse(characterProfile), 201);
    } catch (error: any) {
      console.error('Error creating character:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async getCharacter(c: Context) {
    const characterId = c.req.param('id');

    try {
      const characterProfile = await this.getCharacterUseCase.execute(characterId);
      if (!characterProfile) {
        return c.json({ error: 'Character not found' }, 404);
      }
      return c.json(characterProfileSchema.parse(characterProfile), 200);
    } catch (error: any) {
      console.error('Error getting character:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async getCharactersByStoryId(c: Context) {
    const storyId = c.req.param('storyId');

    try {
      const characters = await this.getCharactersByStoryIdUseCase.execute(storyId);
      return c.json(characters.map(character => characterProfileSchema.parse(character)), 200);
    } catch (error: any) {
      console.error('Error getting characters by story ID:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async updateCharacter(c: Context) {
    const characterId = c.req.param('id');
    const body = await c.req.json();
    const validation = updateCharacterSchema.safeParse({ id: characterId, ...body });

    if (!validation.success) {
      return c.json({ error: validation.error.errors }, 400);
    }

    try {
      const updatedCharacter = await this.updateCharacterUseCase.execute(validation.data);
      if (!updatedCharacter) {
        return c.json({ error: 'Character not found or unauthorized' }, 404);
      }
      return c.json(characterProfileSchema.parse(updatedCharacter), 200);
    } catch (error: any) {
      console.error('Error updating character:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async deleteCharacter(c: Context) {
    const characterId = c.req.param('id');
    // Assuming storyId comes from the request body or a header for authorization
    const storyId = c.req.header('x-story-id'); // For testing purposes

    if (!storyId) {
      return c.json({ error: 'Unauthorized: Missing story ID' }, 401);
    }

    try {
      const deleted = await this.deleteCharacterUseCase.execute(characterId, storyId);
      if (!deleted) {
        return c.json({ error: 'Character not found or unauthorized' }, 404);
      }
      return c.json({ message: 'Character deleted successfully' }, 200);
    } catch (error: any) {
      console.error('Error deleting character:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }
}
