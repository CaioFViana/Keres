import { IMomentRepository } from '@domain/repositories/IMomentRepository';
import { MomentResponse } from '@keres/shared';

export class GetMomentUseCase {
  constructor(private readonly momentRepository: IMomentRepository) {}

  async execute(id: string): Promise<MomentResponse | null> {
    const moment = await this.momentRepository.findById(id);
    if (!moment) {
      return null;
    }

    return {
      id: moment.id,
      sceneId: moment.sceneId,
      name: moment.name,
      location: moment.location,
      index: moment.index,
      summary: moment.summary,
      isFavorite: moment.isFavorite,
      extraNotes: moment.extraNotes,
      createdAt: moment.createdAt,
      updatedAt: moment.updatedAt,
    };
  }
}