import { CreateMomentDTO, MomentProfileDTO } from '@application/dtos/MomentDTOs';
import { IMomentRepository } from '@domain/repositories/IMomentRepository';
import { Moment } from '@domain/entities/Moment';
import { ulid } from 'ulid';

export class CreateMomentUseCase {
  constructor(private readonly momentRepository: IMomentRepository) {}

  async execute(data: CreateMomentDTO): Promise<MomentProfileDTO> {
    const newMoment: Moment = {
      id: ulid(),
      sceneId: data.sceneId,
      name: data.name,
      location: data.location || null,
      index: data.index,
      summary: data.summary || null,
      isFavorite: data.isFavorite || false,
      extraNotes: data.extraNotes || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.momentRepository.save(newMoment);

    return {
      id: newMoment.id,
      sceneId: newMoment.sceneId,
      name: newMoment.name,
      location: newMoment.location,
      index: newMoment.index,
      summary: newMoment.summary,
      isFavorite: newMoment.isFavorite,
      extraNotes: newMoment.extraNotes,
      createdAt: newMoment.createdAt,
      updatedAt: newMoment.updatedAt,
    };
  }
}
