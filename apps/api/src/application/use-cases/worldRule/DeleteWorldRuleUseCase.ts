import type { IWorldRuleRepository } from '@domain/repositories/IWorldRuleRepository'

export class DeleteWorldRuleUseCase {
  constructor(private readonly worldRuleRepository: IWorldRuleRepository) {}

  async execute(id: string): Promise<boolean> {
    const existingWorldRule = await this.worldRuleRepository.findById(id)
    if (!existingWorldRule) {
      return false // WorldRule not found
    }
    await this.worldRuleRepository.delete(id)
    return true
  }
}
