import type { Scene } from '@domain/entities/Scene'
import type { IChapterRepository } from '@domain/repositories/IChapterRepository'
import type { IChoiceRepository } from '@domain/repositories/IChoiceRepository'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'

import { UpdateSceneUseCase } from '@application/use-cases/scene/UpdateSceneUseCase'
import { beforeEach, describe, expect, it } from 'vitest'

// Mock implementations
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

class MockChapterRepository implements IChapterRepository {
  async findById(id: string): Promise<any | null> {
    if (id === 'chapter123') {
      return {
        id: id,
        storyId: 'story123',
        name: 'Chapter 1',
        index: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    }
    return null
  }
  async findByStoryId(storyId: string): Promise<any[]> {
    return []
  }
  async save(chapter: any): Promise<void> {}
  async update(chapter: any): Promise<void> {}
  async delete(id: string): Promise<void> {}
}

class MockStoryRepository implements IStoryRepository {
  async findById(id: string): Promise<any | null> {
    if (id === 'story123') {
      return {
        id: id,
        userId: 'user123',
        name: 'Story 1',
        type: 'linear',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    }
    return null
  }
  async findByUserId(userId: string): Promise<any[]> {
    return []
  }
  async save(story: any): Promise<void> {}
  async update(story: any): Promise<void> {}
  async delete(id: string): Promise<void> {}
}

class MockChoiceRepository implements IChoiceRepository {
  async findById(id: string): Promise<any | null> {
    return null
  }
  async findBySceneId(sceneId: string): Promise<any[]> {
    return []
  }
  async create(choice: any): Promise<void> {}
  async update(choice: any): Promise<void> {}
  async delete(id: string): Promise<void> {}
}

describe('UpdateSceneUseCase', () => {
  let sceneRepository: MockSceneRepository
  let chapterRepository: MockChapterRepository
  let storyRepository: MockStoryRepository
  let choiceRepository: MockChoiceRepository
  let updateSceneUseCase: UpdateSceneUseCase

  beforeEach(() => {
    sceneRepository = new MockSceneRepository()
    chapterRepository = new MockChapterRepository()
    storyRepository = new MockStoryRepository()
    choiceRepository = new MockChoiceRepository()
    updateSceneUseCase = new UpdateSceneUseCase(
      sceneRepository,
      choiceRepository,
      storyRepository,
      chapterRepository,
    )

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
