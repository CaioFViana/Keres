import type {
  BulkDeleteCharacterUseCase,
  CreateCharacterUseCase,
  CreateManyCharactersUseCase,
  DeleteCharacterUseCase,
  GetCharactersByStoryIdUseCase,
  GetCharacterUseCase,
  UpdateCharacterUseCase,
  UpdateManyCharactersUseCase,
} from '@application/use-cases'
import type { z } from 'zod'

import {
  type CharacterCreateSchema,
  CharacterResponseSchema,
  type CharacterUpdateSchema,
  type ListQueryParams,
  type PaginatedResponse,
  CreateManyCharactersSchema,
  UpdateManyCharactersSchema,
  CharacterResponse,
} from '@keres/shared'

export class CharacterController {
  constructor(
    private readonly createCharacterUseCase: CreateCharacterUseCase,
    private readonly getCharacterUseCase: GetCharacterUseCase,
    private readonly updateCharacterUseCase: UpdateCharacterUseCase,
    private readonly deleteCharacterUseCase: DeleteCharacterUseCase,
    private readonly bulkDeleteCharacterUseCase: BulkDeleteCharacterUseCase,
    private readonly getCharactersByStoryIdUseCase: GetCharactersByStoryIdUseCase,
    private readonly createManyCharactersUseCase: CreateManyCharactersUseCase,
    private readonly updateManyCharactersUseCase: UpdateManyCharactersUseCase,
  ) {}

  async createCharacter(userId: string, data: z.infer<typeof CharacterCreateSchema>) {
    const character = await this.createCharacterUseCase.execute(userId, data)
    return CharacterResponseSchema.parse(character)
  }

  async createManyCharacters(userId: string, data: z.infer<typeof CreateManyCharactersSchema>) {
    const characters = await this.createManyCharactersUseCase.execute(userId, data)
    return characters.map((character) => CharacterResponseSchema.parse(character))
  }

  async updateManyCharacters(userId: string, data: z.infer<typeof UpdateManyCharactersSchema>) {
    const characters = await this.updateManyCharactersUseCase.execute(userId, data)
    return characters.map((character) => CharacterResponseSchema.parse(character))
  }

  async getCharacter(userId: string, id: string, include: string[] = []) {
    const character = await this.getCharacterUseCase.execute(userId, id, include)
    if (!character) {
      throw new Error('Character not found')
    }
    return CharacterResponseSchema.parse(character)
  }

  async getCharactersByStoryId(
    userId: string,
    storyId: string,
    query: ListQueryParams,
  ): Promise<PaginatedResponse<z.infer<typeof CharacterResponseSchema>>> {
    const paginatedCharacters = await this.getCharactersByStoryIdUseCase.execute(userId, storyId, query)
    const items = paginatedCharacters.items.map((character: CharacterResponse) => CharacterResponseSchema.parse(character))

    return {
      items,
      totalItems: paginatedCharacters.totalItems,
    }
  }

  async updateCharacter(
    userId: string,
    id: string,
    data: Omit<z.infer<typeof CharacterUpdateSchema>, 'id'>,
  ) {
    const updatedCharacter = await this.updateCharacterUseCase.execute(userId, id, data)
    if (!updatedCharacter) {
      throw new Error('Character not found')
    }
    return CharacterResponseSchema.parse(updatedCharacter)
  }

  async deleteCharacter(userId: string, id: string) {
    const deleted = await this.deleteCharacterUseCase.execute(userId, id)
    if (!deleted) {
      throw new Error('Character not found')
    }
    return
  }

  async bulkDeleteCharacters(userId: string, ids: string[]) {
    const result = await this.bulkDeleteCharacterUseCase.execute(userId, ids)
    return result
  }
}
