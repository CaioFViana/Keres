import type { Relation } from '@domain/entities/Relation'
import type { IRelationRepository } from '@domain/repositories/IRelationRepository'
import type { RelationCreatePayload, RelationResponse } from '@keres/shared'

import { ulid } from 'ulid'

export class CreateRelationUseCase {
  constructor(private readonly relationRepository: IRelationRepository) {}

  async execute(data: RelationCreatePayload): Promise<RelationResponse> {
    const newRelation: Relation = {
      id: ulid(),
      charIdSource: data.charIdSource,
      charIdTarget: data.charIdTarget,
      sceneId: data.sceneId || null,
      momentId: data.momentId || null,
      summary: data.summary || null,
      isFavorite: data.isFavorite || false,
      extraNotes: data.extraNotes || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await this.relationRepository.save(newRelation)

    return {
      id: newRelation.id,
      charIdSource: newRelation.charIdSource,
      charIdTarget: newRelation.charIdTarget,
      sceneId: newRelation.sceneId,
      momentId: newRelation.momentId,
      summary: newRelation.summary,
      isFavorite: newRelation.isFavorite,
      extraNotes: newRelation.extraNotes,
      createdAt: newRelation.createdAt,
      updatedAt: newRelation.updatedAt,
    }
  }
}
