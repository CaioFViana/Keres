import type { IChoiceRepository } from '@domain/repositories/IChoiceRepository'

export class DeleteChoiceUseCase {
  constructor(private choiceRepository: IChoiceRepository) {}

  async execute(id: string): Promise<void> {
    await this.choiceRepository.delete(id)
  }
}
