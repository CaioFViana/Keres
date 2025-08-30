import { describe, it, expect, beforeEach } from 'vitest';
import { GetScenesByChapterIdUseCase } from '@application/use-cases/GetScenesByChapterIdUseCase';
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

describe('GetScenesByChapterIdUseCase', () => {
  let sceneRepository: MockSceneRepository;
  let getScenesByChapterIdUseCase: GetScenesByChapterIdUseCase;

  beforeEach(() => {
    sceneRepository = new MockSceneRepository();
    getScenesByChapterIdUseCase = new GetScenesByChapterIdUseCase(sceneRepository);

    // Pre-populate scenes for testing
    sceneRepository.save({
      id: 'scene1',
      chapterId: 'chapter123',
      name: 'Scene 1',
      index: 1,
      summary: null,
      gap: null,
      duration: null,
      isFavorite: false,
      extraNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    sceneRepository.save({
      id: 'scene2',
      chapterId: 'chapter123',
      name: 'Scene 2',
      index: 2,
      summary: null,
      gap: null,
      duration: null,
      isFavorite: false,
      extraNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    sceneRepository.save({
      id: 'scene3',
      chapterId: 'chapter456',
      name: 'Scene 3',
      index: 1,
      summary: null,
      gap: null,
      duration: null,
      isFavorite: false,
      extraNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it('should return all scenes for a given chapter ID', async () => {
    const scenes = await getScenesByChapterIdUseCase.execute('chapter123');

    expect(scenes).toBeDefined();
    expect(scenes.length).toBe(2);
    expect(scenes[0].name).toBe('Scene 1');
    expect(scenes[1].name).toBe('Scene 2');
  });

  it('should return an empty array if no scenes found for the chapter ID', async () => {
    const scenes = await getScenesByChapterIdUseCase.execute('nonexistent_chapter');

    expect(scenes).toBeDefined();
    expect(scenes.length).toBe(0);
  });
});
