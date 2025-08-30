import { IMomentRepository } from '@domain/repositories/IMomentRepository';
import { MomentUpdatePayload, MomentResponse } from '@keres/shared';

export class UpdateMomentUseCase {
  constructor(private readonly momentRepository: IMomentRepository) {}

  async execute(data: MomentUpdatePayload): Promise<MomentResponse | null> {
    const existingMoment = await this.momentRepository.findById(data.id);
    if (!existingMoment) {
      return null; // Moment not found
    }
    // Add ownership check
    if (data.sceneId && existingMoment.sceneId !== data.sceneId) {
      return null; // Moment does not belong to this scene
    }

    const updatedMoment = {
      ...existingMoment,
      ...data,
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