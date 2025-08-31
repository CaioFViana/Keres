import type {
  CreateCharacterUseCase,
  DeleteCharacterUseCase,
  GetCharactersByStoryIdUseCase,
  GetCharacterUseCase,
  UpdateCharacterUseCase,
} from '@application/use-cases'
import type { z } from 'zod'

import {
  type CharacterCreateSchema,
  CharacterResponseSchema,
  type CharacterUpdateSchema,
} from '@keres/shared'

export class CharacterController {
  constructor(
    private readonly createCharacterUseCase: CreateCharacterUseCase,
    private readonly getCharacterUseCase: GetCharacterUseCase,
    private readonly updateCharacterUseCase: UpdateCharacterUseCase,
    private readonly deleteCharacterUseCase: DeleteCharacterUseCase,
    private readonly getCharactersByStoryIdUseCase: GetCharactersByStoryIdUseCase,
  ) {}

  async createCharacter(data: z.infer<typeof CharacterCreateSchema>) {
    const character = await this.createCharacterUseCase.execute(data)
    return CharacterResponseSchema.parse(character)
  }

  async getCharacter(id: string) {
    const character = await this.getCharacterUseCase.execute(id)
    if (!character) {
      throw new Error('Character not found')
    }
    return CharacterResponseSchema.parse(character)
  }

  async getCharactersByStoryId(storyId: string) {
    const characters = await this.getCharactersByStoryIdUseCase.execute(storyId)
    return characters.map((character) => CharacterResponseSchema.parse(character))
  }

  async updateCharacter(id: string, data: z.infer<typeof CharacterUpdateSchema>) {
    const { id: dataId, ...updateData } = data
    const updatedCharacter = await this.updateCharacterUseCase.execute({
      id,
      ...updateData,
    })
    if (!updatedCharacter) {
      throw new Error('Character not found')
    }
    return CharacterResponseSchema.parse(updatedCharacter)
  }

  async deleteCharacter(id: string) {
    const deleted = await this.deleteCharacterUseCase.execute(id)
    if (!deleted) {
      throw new Error('Character not found')
    }
    return
  }
}
