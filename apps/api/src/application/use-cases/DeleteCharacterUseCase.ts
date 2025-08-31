import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository'

export class DeleteCharacterUseCase {
  constructor(private readonly characterRepository: ICharacterRepository) {}

  async execute(id: string): Promise<boolean> {
    const existingCharacter = await this.characterRepository.findById(id)
    if (!existingCharacter) {
      return false // Character not found
    }
    await this.characterRepository.delete(id)
    return true
  }
}
