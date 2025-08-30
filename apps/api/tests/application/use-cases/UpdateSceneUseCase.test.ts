import type { Scene } from '@domain/entities/Scene'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository'

import { UpdateSceneUseCase } from '@application/use-cases/UpdateSceneUseCase'
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

describe('UpdateSceneUseCase', () => {
  let sceneRepository: MockSceneRepository
  let updateSceneUseCase: UpdateSceneUseCase

  beforeEach(() => {
    sceneRepository = new MockSceneRepository()
    updateSceneUseCase = new UpdateSceneUseCase(sceneRepository)

    // Pre-populate a scene for testing
    sceneRepository.save({
      id: 'scene123',
      chapterId: 'chapter123',
      name: 'Original Scene Name',
      index: 1,
      summary: 'Original Summary',
      gap: '1 hour',
      duration: '30 minutes',
      isFavorite: false,
      extraNotes: 'Original Notes',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  })

  it('should update an existing scene successfully', async () => {
    const updateDTO = {
      id: 'scene123',
      chapterId: 'chapter123',
      name: 'Updated Scene Name',
      index: 2,
      isFavorite: true,
    }

    const updatedScene = await updateSceneUseCase.execute(updateDTO)

    expect(updatedScene).toBeDefined()
    expect(updatedScene?.name).toBe('Updated Scene Name')
    expect(updatedScene?.index).toBe(2)
    expect(updatedScene?.isFavorite).toBe(true)
    expect(updatedScene?.summary).toBe('Original Summary') // Should remain unchanged
  })

  it('should return null if scene not found', async () => {
    const updateDTO = {
      id: 'nonexistent_scene',
      chapterId: 'chapter123',
      name: 'New Name',
    }

    const updatedScene = await updateSceneUseCase.execute(updateDTO)

    expect(updatedScene).toBeNull()
  })

  it('should return null if scene does not belong to the specified chapter', async () => {
    const updateDTO = {
      id: 'scene123',
      chapterId: 'another_chapter',
      name: 'New Name',
    }

    const updatedScene = await updateSceneUseCase.execute(updateDTO)

    expect(updatedScene).toBeNull()

    // Ensure the scene was not updated
    const scene = await sceneRepository.findById('scene123')
    expect(scene?.name).toBe('Original Scene Name')
  })
})
