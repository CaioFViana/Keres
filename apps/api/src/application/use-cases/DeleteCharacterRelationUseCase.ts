import type { ICharacterRelationRepository } from '@domain/repositories/ICharacterRelationRepository'

export class DeleteCharacterRelationUseCase {
  constructor(private readonly characterRelationRepository: ICharacterRelationRepository) {}

  async execute(id: string): Promise<boolean> {
    const existingCharacterRelation = await this.characterRelationRepository.findById(id)
    if (!existingCharacterRelation) {
      return false // Character relation not found
    }
    await this.characterRelationRepository.delete(id)
    return true
  }
}
