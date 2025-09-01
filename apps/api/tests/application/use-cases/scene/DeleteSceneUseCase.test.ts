import type { Scene } from '@domain/entities/Scene'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository'

import { DeleteSceneUseCase } from '@application/use-cases/scene/DeleteSceneUseCase'
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

describe('DeleteSceneUseCase', () => {
  let sceneRepository: MockSceneRepository
  let deleteSceneUseCase: DeleteSceneUseCase

  beforeEach(() => {
    sceneRepository = new MockSceneRepository()
    deleteSceneUseCase = new DeleteSceneUseCase(sceneRepository)

    // Pre-populate a scene for testing
    sceneRepository.save({
      id: 'scene123',
      chapterId: 'chapter123',
      name: 'Scene to Delete',
      index: 1,
      summary: null,
      gap: null,
      duration: null,
      isFavorite: false,
      extraNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  })

  it('should delete an existing scene successfully', async () => {
    const deleted = await deleteSceneUseCase.execute('scene123', 'chapter123')
    expect(deleted).toBe(true)

    const scene = await sceneRepository.findById('scene123')
    expect(scene).toBeNull()
  })

  it('should return false if scene not found', async () => {
    const deleted = await deleteSceneUseCase.execute('nonexistent_scene', 'chapter123')
    expect(deleted).toBe(false)
  })

  it('should return false if scene does not belong to the specified chapter', async () => {
    const deleted = await deleteSceneUseCase.execute('scene123', 'another_chapter')
    expect(deleted).toBe(false)

    // Ensure the scene was not deleted
    const scene = await sceneRepository.findById('scene123')
    expect(scene).toBeDefined()
  })
})
