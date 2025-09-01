import type { Scene } from '@domain/entities/Scene'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository'

import { GetSceneUseCase } from '@application/use-cases/scene/GetSceneUseCase'
import { beforeEach, describe, expect, it } from 'vitest'

// Mock implementation
class MockSceneRepository implements ISceneRepository {
  private scenes: Scene[] = []

  async findById(id: string): Promise<Scene | null> {
    return this.scenes.find((scene) => scene.id === id) || null
  }

  async findByChapterId(chapterId: string): Promise<Scene[]> {
    return this.scenes.filter((scene) => scene.chapterId === chapterId)
  }

  async save(scene: Scene): Promise<void> {
    this.scenes.push(scene)
  }

  async update(scene: Scene): Promise<void> {
    const index = this.scenes.findIndex((s) => s.id === scene.id)
    if (index !== -1) {
      this.scenes[index] = scene
    }
  }

  async delete(id: string): Promise<void> {
    this.scenes = this.scenes.filter((scene) => scene.id !== id)
  }
}

describe('GetSceneUseCase', () => {
  let sceneRepository: MockSceneRepository
  let getSceneUseCase: GetSceneUseCase

  beforeEach(() => {
    sceneRepository = new MockSceneRepository()
    getSceneUseCase = new GetSceneUseCase(sceneRepository)

    // Pre-populate a scene for testing
    sceneRepository.save({
      id: 'scene123',
      chapterId: 'chapter123',
      name: 'Test Scene',
      index: 1,
      summary: 'A summary',
      gap: '1 hour',
      duration: '30 minutes',
      isFavorite: false,
      extraNotes: 'Notes',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  })

  it('should return a scene profile for a valid ID', async () => {
    const sceneProfile = await getSceneUseCase.execute('scene123')

    expect(sceneProfile).toBeDefined()
    expect(sceneProfile?.id).toBe('scene123')
    expect(sceneProfile?.name).toBe('Test Scene')
  })

  it('should return null for an invalid scene ID', async () => {
    const sceneProfile = await getSceneUseCase.execute('nonexistent')

    expect(sceneProfile).toBeNull()
  })
})
