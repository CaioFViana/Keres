import { MomentProfileDTO } from '@application/dtos/MomentDTOs';
import { IMomentRepository } from '@domain/repositories/IMomentRepository';

export class GetMomentUseCase {
  constructor(private readonly momentRepository: IMomentRepository) {}

  async execute(momentId: string): Promise<MomentProfileDTO | null> {
    const moment = await this.momentRepository.findById(momentId);
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
