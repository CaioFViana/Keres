import { IMomentRepository } from '@domain/repositories/IMomentRepository';

export class DeleteMomentUseCase {
  constructor(private readonly momentRepository: IMomentRepository) {}

  async execute(momentId: string, sceneId: string): Promise<boolean> {
    const existingMoment = await this.momentRepository.findById(momentId);
    if (!existingMoment || existingMoment.sceneId !== sceneId) {
      // Moment not found or does not belong to the specified scene
      return false;
    }

    await this.momentRepository.delete(momentId);
    return true;
  }
}
