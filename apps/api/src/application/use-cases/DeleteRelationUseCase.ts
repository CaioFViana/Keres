import { IRelationRepository } from '@domain/repositories/IRelationRepository';

export class DeleteRelationUseCase {
  constructor(private readonly relationRepository: IRelationRepository) {}

  async execute(relationId: string): Promise<boolean> {
    const existingRelation = await this.relationRepository.findById(relationId);
    if (!existingRelation) {
      return false;
    }

    await this.relationRepository.delete(relationId);
    return true;
  }
}
