import { ICharacterRelationRepository } from '@domain/repositories/ICharacterRelationRepository';

export class DeleteCharacterRelationUseCase {
  constructor(private readonly characterRelationRepository: ICharacterRelationRepository) {}

  async execute(relationId: string): Promise<boolean> {
    const existingCharacterRelation = await this.characterRelationRepository.findById(relationId);
    if (!existingCharacterRelation) {
      return false;
    }

    await this.characterRelationRepository.delete(relationId);
    return true;
  }
}
