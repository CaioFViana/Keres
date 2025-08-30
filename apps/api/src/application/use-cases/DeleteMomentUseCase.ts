import type { IMomentRepository } from '@domain/repositories/IMomentRepository'

export class DeleteMomentUseCase {
  constructor(private readonly momentRepository: IMomentRepository) {}

  async execute(id: string, sceneId: string): Promise<boolean> {
    const existingMoment = await this.momentRepository.findById(id)
    if (!existingMoment) {
      return false // Moment not found
    }
    if (existingMoment.sceneId !== sceneId) {
      // Check ownership
      return false // Moment does not belong to this scene
    }
    await this.momentRepository.delete(id)
    return true
  }
}
