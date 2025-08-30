import { describe, it, expect, beforeEach } from 'vitest';
import { CreateSceneUseCase } from '@application/use-cases/CreateSceneUseCase';
import { ISceneRepository } from '@domain/repositories/ISceneRepository';
import { Scene } from '@domain/entities/Scene';

// Mock implementation
class MockSceneRepository implements ISceneRepository {
  private scenes: Scene[] = [];

  async findById(id: string): Promise<Scene | null> {
    return this.scenes.find(scene => scene.id === id) || null;
  }

  async findByChapterId(chapterId: string): Promise<Scene[]> {
    return this.scenes.filter(scene => scene.chapterId === chapterId);
  }

  async save(scene: Scene): Promise<void> {
    this.scenes.push(scene);
  }

  async update(scene: Scene): Promise<void> {
    const index = this.scenes.findIndex(s => s.id === scene.id);
    if (index !== -1) {
      this.scenes[index] = scene;
    }
  }

  async delete(id: string): Promise<void> {
    this.scenes = this.scenes.filter(scene => scene.id !== id);
  }
}

describe('CreateSceneUseCase', () => {
  let sceneRepository: MockSceneRepository;
  let createSceneUseCase: CreateSceneUseCase;

  beforeEach(() => {
    sceneRepository = new MockSceneRepository();
    createSceneUseCase = new CreateSceneUseCase(sceneRepository);
  });

  it('should create a new scene successfully', async () => {
    const sceneDTO = {
      chapterId: 'chapter123',
      name: 'Scene 1',
      index: 1,
      summary: 'A summary.',
      gap: '1 day',
      duration: '2 hours',
      isFavorite: true,
      extraNotes: 'Some extra notes.',
    };

    const sceneProfile = await createSceneUseCase.execute(sceneDTO);

    expect(sceneProfile).toBeDefined();
    expect(sceneProfile.name).toBe('Scene 1');
    expect(sceneProfile.chapterId).toBe('chapter123');
    expect(sceneProfile.id).toBeDefined();
    expect(sceneProfile.isFavorite).toBe(true);

    const createdScene = await sceneRepository.findById(sceneProfile.id);
    expect(createdScene).toBeDefined();
    expect(createdScene?.name).toBe('Scene 1');
  });

  it('should create a new scene with default values for optional fields', async () => {
    const sceneDTO = {
      chapterId: 'chapter456',
      name: 'Scene 2',
      index: 2,
    };

    const sceneProfile = await createSceneUseCase.execute(sceneDTO);

    expect(sceneProfile).toBeDefined();
    expect(sceneProfile.name).toBe('Scene 2');
    expect(sceneProfile.summary).toBeNull();
    expect(sceneProfile.gap).toBeNull();
    expect(sceneProfile.duration).toBeNull();
    expect(sceneProfile.isFavorite).toBe(false);
    expect(sceneProfile.extraNotes).toBeNull();
  });
});
