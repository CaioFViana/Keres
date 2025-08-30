import { UpdateMomentDTO, MomentProfileDTO } from '@application/dtos/MomentDTOs';
import { IMomentRepository } from '@domain/repositories/IMomentRepository';

export class UpdateMomentUseCase {
  constructor(private readonly momentRepository: IMomentRepository) {}

  async execute(data: UpdateMomentDTO): Promise<MomentProfileDTO | null> {
    const existingMoment = await this.momentRepository.findById(data.id);
    if (!existingMoment || existingMoment.sceneId !== data.sceneId) {
      // Moment not found or does not belong to the specified scene
      return null;
    }

    const updatedMoment = {
      ...existingMoment,
      name: data.name ?? existingMoment.name,
      location: data.location ?? existingMoment.location,
      index: data.index ?? existingMoment.index,
      summary: data.summary ?? existingMoment.summary,
      isFavorite: data.isFavorite ?? existingMoment.isFavorite,
      extraNotes: data.extraNotes ?? existingMoment.extraNotes,
      updatedAt: new Date(),
    };

    await this.momentRepository.update(updatedMoment);

    return {
      id: updatedMoment.id,
      sceneId: updatedMoment.sceneId,
      name: updatedMoment.name,
      location: updatedMoment.location,
      index: updatedMoment.index,
      summary: updatedMoment.summary,
      isFavorite: updatedMoment.isFavorite,
      extraNotes: updatedMoment.extraNotes,
      createdAt: updatedMoment.createdAt,
      updatedAt: updatedMoment.updatedAt,
    };
  }
}
