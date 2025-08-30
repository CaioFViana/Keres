import { Context } from 'hono';
import {
  CreateCharacterRelationUseCase,
  GetCharacterRelationUseCase,
  GetCharacterRelationsByCharIdUseCase,
  UpdateCharacterRelationUseCase,
  DeleteCharacterRelationUseCase,
} from '@application/use-cases';
import { createCharacterRelationSchema, updateCharacterRelationSchema, characterRelationProfileSchema } from '@presentation/schemas/CharacterRelationSchemas';

export class CharacterRelationController {
  constructor(
    private readonly createCharacterRelationUseCase: CreateCharacterRelationUseCase,
    private readonly getCharacterRelationUseCase: GetCharacterRelationUseCase,
    private readonly getCharacterRelationsByCharIdUseCase: GetCharacterRelationsByCharIdUseCase,
    private readonly updateCharacterRelationUseCase: UpdateCharacterRelationUseCase,
    private readonly deleteCharacterRelationUseCase: DeleteCharacterRelationUseCase
  ) {}

  async createCharacterRelation(c: Context) {
    const body = await c.req.json();
    const validation = createCharacterRelationSchema.safeParse(body);

    if (!validation.success) {
      return c.json({ error: validation.error.errors }, 400);
    }

    try {
      const characterRelationProfile = await this.createCharacterRelationUseCase.execute(validation.data);
      return c.json(characterRelationProfileSchema.parse(characterRelationProfile), 201);
    } catch (error: any) {
      console.error('Error creating character relation:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async getCharacterRelation(c: Context) {
    const relationId = c.req.param('id');

    try {
      const characterRelationProfile = await this.getCharacterRelationUseCase.execute(relationId);
      if (!characterRelationProfile) {
        return c.json({ error: 'Character relation not found' }, 404);
      }
      return c.json(characterRelationProfileSchema.parse(characterRelationProfile), 200);
    } catch (error: any) {
      console.error('Error getting character relation:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async getCharacterRelationsByCharId(c: Context) {
    const charId = c.req.param('charId');

    try {
      const characterRelations = await this.getCharacterRelationsByCharIdUseCase.execute(charId);
      return c.json(characterRelations.map(cr => characterRelationProfileSchema.parse(cr)), 200);
    } catch (error: any) {
      console.error('Error getting character relations by character ID:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async updateCharacterRelation(c: Context) {
    const relationId = c.req.param('id');
    const body = await c.req.json();
    const validation = updateCharacterRelationSchema.safeParse({ id: relationId, ...body });

    if (!validation.success) {
      return c.json({ error: validation.error.errors }, 400);
    }

    try {
      const updatedCharacterRelation = await this.updateCharacterRelationUseCase.execute(validation.data);
      if (!updatedCharacterRelation) {
        return c.json({ error: 'Character relation not found' }, 404);
      }
      return c.json(characterRelationProfileSchema.parse(updatedCharacterRelation), 200);
    } catch (error: any) {
      console.error('Error updating character relation:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async deleteCharacterRelation(c: Context) {
    const relationId = c.req.param('id');

    try {
      const deleted = await this.deleteCharacterRelationUseCase.execute(relationId);
      if (!deleted) {
        return c.json({ error: 'Character relation not found' }, 404);
      }
      return c.json({ message: 'Character relation deleted successfully' }, 200);
    } catch (error: any) {
      console.error('Error deleting character relation:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }
}
