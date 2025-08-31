import type { IMomentRepository } from '@domain/repositories/IMomentRepository'

export class DeleteMomentUseCase {
  constructor(private readonly momentRepository: IMomentRepository) {}

  async execute(id: string): Promise<boolean> {
    const existingMoment = await this.momentRepository.findById(id)
    if (!existingMoment) {
      return false // Moment not found
    }

    await this.momentRepository.delete(id)
    return true
  }
}
