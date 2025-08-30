import { MomentProfileDTO } from '@application/dtos/MomentDTOs';
import { IMomentRepository } from '@domain/repositories/IMomentRepository';

export class GetMomentsBySceneIdUseCase {
  constructor(private readonly momentRepository: IMomentRepository) {}

  async execute(sceneId: string): Promise<MomentProfileDTO[]> {
    const moments = await this.momentRepository.findBySceneId(sceneId);
    return moments.map(moment => ({
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
    }));
  }
}
