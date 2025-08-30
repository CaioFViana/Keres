import { Context } from 'hono';
import {
  CreateCharacterRelationUseCase,
  GetCharacterRelationUseCase,
  UpdateCharacterRelationUseCase,
  DeleteCharacterRelationUseCase,
  GetCharacterRelationsByCharIdUseCase,
} from '@application/use-cases';
import { CharacterRelationCreateSchema, CharacterRelationUpdateSchema, CharacterRelationResponseSchema } from '@keres/shared';

export class CharacterRelationController {
  constructor(
    private readonly createCharacterRelationUseCase: CreateCharacterRelationUseCase,
    private readonly getCharacterRelationUseCase: GetCharacterRelationUseCase,
    private readonly updateCharacterRelationUseCase: UpdateCharacterRelationUseCase,
    private readonly deleteCharacterRelationUseCase: DeleteCharacterRelationUseCase,
    private readonly getCharacterRelationsByCharIdUseCase: GetCharacterRelationsByCharIdUseCase
  ) {}

  async createCharacterRelation(c: Context) {
    const data = c.req.valid('json'); // Validated by zValidator middleware

    try {
      const characterRelation = await this.createCharacterRelationUseCase.execute(data);
      return c.json(CharacterRelationResponseSchema.parse(characterRelation), 201);
    } catch (error: any) {
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async getCharacterRelation(c: Context) {
    const relationId = c.req.param('id');

    try {
      const characterRelation = await this.getCharacterRelationUseCase.execute(relationId);
      if (!characterRelation) {
        return c.json({ error: 'Character relation not found' }, 404);
      }
      return c.json(CharacterRelationResponseSchema.parse(characterRelation), 200);
    } catch (error) {
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async getCharacterRelationsByCharId(c: Context) {
    const charId = c.req.param('charId'); // Assuming charId is passed as a param

    try {
      const characterRelations = await this.getCharacterRelationsByCharIdUseCase.execute(charId);
      return c.json(characterRelations.map(cr => CharacterRelationResponseSchema.parse(cr)), 200);
    } catch (error) {
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async updateCharacterRelation(c: Context) {
    const relationId = c.req.param('id');
    const data = c.req.valid('json'); // Validated by zValidator middleware

    try {
      const updatedCharacterRelation = await this.updateCharacterRelationUseCase.execute({ id: relationId, ...data });
      if (!updatedCharacterRelation) {
        return c.json({ error: 'Character relation not found' }, 404);
      }
      return c.json(CharacterRelationResponseSchema.parse(updatedCharacterRelation), 200);
    } catch (error: any) {
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
      return c.json({}, 204);
    } catch (error) {
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }
}