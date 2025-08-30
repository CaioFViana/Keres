import type { IRelationRepository } from '@domain/repositories/IRelationRepository'

export class DeleteRelationUseCase {
  constructor(private readonly relationRepository: IRelationRepository) {}

  async execute(id: string, charIdSource: string, charIdTarget: string): Promise<boolean> {
    const existingRelation = await this.relationRepository.findById(id)
    if (!existingRelation) {
      return false // Relation not found
    }
    if (
      existingRelation.charIdSource !== charIdSource ||
      existingRelation.charIdTarget !== charIdTarget
    ) {
      return false // Relation does not match source/target characters
    }
    await this.relationRepository.delete(id)
    return true
  }
}
