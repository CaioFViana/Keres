import { describe, it, expect, beforeEach } from 'vitest';
import { CreateRelationUseCase } from '@application/use-cases/CreateRelationUseCase';
import { IRelationRepository } from '@domain/repositories/IRelationRepository';
import { Relation } from '@domain/entities/Relation';

// Mock implementation
class MockRelationRepository implements IRelationRepository {
  private relations: Relation[] = [];

  async findById(id: string): Promise<Relation | null> {
    return this.relations.find(relation => relation.id === id) || null;
  }

  async findByCharId(charId: string): Promise<Relation[]> {
    return this.relations.filter(relation => relation.charIdSource === charId);
  }

  async save(relation: Relation): Promise<void> {
    this.relations.push(relation);
  }

  async update(relation: Relation): Promise<void> {
    const index = this.relations.findIndex(r => r.id === relation.id);
    if (index !== -1) {
      this.relations[index] = relation;
    }
  }

  async delete(id: string): Promise<void> {
    this.relations = this.relations.filter(relation => relation.id !== id);
  }
}

describe('CreateRelationUseCase', () => {
  let relationRepository: MockRelationRepository;
  let createRelationUseCase: CreateRelationUseCase;

  beforeEach(() => {
    relationRepository = new MockRelationRepository();
    createRelationUseCase = new CreateRelationUseCase(relationRepository);
  });

  it('should create a new relation successfully', async () => {
    const relationDTO = {
      charIdSource: 'char1',
      charIdTarget: 'char2',
      sceneId: 'scene1',
      momentId: 'moment1',
      summary: 'Met at the market',
      isFavorite: true,
      extraNotes: 'Important meeting',
    };

    const relationProfile = await createRelationUseCase.execute(relationDTO);

    expect(relationProfile).toBeDefined();
    expect(relationProfile.charIdSource).toBe('char1');
    expect(relationProfile.charIdTarget).toBe('char2');
    expect(relationProfile.id).toBeDefined();
    expect(relationProfile.isFavorite).toBe(true);

    const createdRelation = await relationRepository.findById(relationProfile.id);
    expect(createdRelation).toBeDefined();
    expect(createdRelation?.summary).toBe('Met at the market');
  });

  it('should create a new relation with default values for optional fields', async () => {
    const relationDTO = {
      charIdSource: 'char3',
      charIdTarget: 'char4',
    };

    const relationProfile = await createRelationUseCase.execute(relationDTO);

    expect(relationProfile).toBeDefined();
    expect(relationProfile.charIdSource).toBe('char3');
    expect(relationProfile.charIdTarget).toBe('char4');
    expect(relationProfile.sceneId).toBeNull();
    expect(relationProfile.momentId).toBeNull();
    expect(relationProfile.summary).toBeNull();
    expect(relationProfile.isFavorite).toBe(false);
    expect(relationProfile.extraNotes).toBeNull();
  });
});