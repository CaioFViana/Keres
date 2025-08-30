import { describe, it, expect, beforeEach } from 'vitest';
import { GetMomentUseCase } from '@application/use-cases/GetMomentUseCase';
import { IMomentRepository } from '@domain/repositories/IMomentRepository';
import { Moment } from '@domain/entities/Moment';

// Mock implementation
class MockMomentRepository implements IMomentRepository {
  private moments: Moment[] = [];

  async findById(id: string): Promise<Moment | null> {
    return this.moments.find(moment => moment.id === id) || null;
  }

  async findBySceneId(sceneId: string): Promise<Moment[]> {
    return this.moments.filter(moment => moment.sceneId === sceneId);
  }

  async save(moment: Moment): Promise<void> {
    this.moments.push(moment);
  }

  async update(moment: Moment): Promise<void> {
    const index = this.moments.findIndex(m => m.id === moment.id);
    if (index !== -1) {
      this.moments[index] = moment;
    }
  }

  async delete(id: string): Promise<void> {
    this.moments = this.moments.filter(moment => moment.id !== id);
  }
}

describe('GetMomentUseCase', () => {
  let momentRepository: MockMomentRepository;
  let getMomentUseCase: GetMomentUseCase;

  beforeEach(() => {
    momentRepository = new MockMomentRepository();
    getMomentUseCase = new GetMomentUseCase(momentRepository);

    // Pre-populate a moment for testing
    momentRepository.save({
      id: 'moment123',
      sceneId: 'scene123',
      name: 'Test Moment',
      location: 'Location A',
      index: 1,
      summary: 'A summary',
      isFavorite: false,
      extraNotes: 'Notes',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it('should return a moment profile for a valid ID', async () => {
    const momentProfile = await getMomentUseCase.execute('moment123');

    expect(momentProfile).toBeDefined();
    expect(momentProfile?.id).toBe('moment123');
    expect(momentProfile?.name).toBe('Test Moment');
  });

  it('should return null for an invalid moment ID', async () => {
    const momentProfile = await getMomentUseCase.execute('nonexistent');

    expect(momentProfile).toBeNull();
  });
});
