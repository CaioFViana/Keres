import type { Scene } from '@domain/entities/Scene'
import type { IChapterRepository } from '@domain/repositories/IChapterRepository'
import type { IChoiceRepository } from '@domain/repositories/IChoiceRepository'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'

import { CreateSceneUseCase } from '@application/use-cases/scene/CreateSceneUseCase'
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
    // Return a mock chapter object if needed for specific tests, otherwise null
    if (id === 'chapter123' || id === 'chapter456') {
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
    // Return a mock story object if needed for specific tests, otherwise null
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

describe('CreateSceneUseCase', () => {
  let sceneRepository: MockSceneRepository
  let chapterRepository: MockChapterRepository
  let storyRepository: MockStoryRepository
  let choiceRepository: MockChoiceRepository
  let createSceneUseCase: CreateSceneUseCase

  beforeEach(() => {
    sceneRepository = new MockSceneRepository()
    chapterRepository = new MockChapterRepository()
    storyRepository = new MockStoryRepository()
    choiceRepository = new MockChoiceRepository()
    createSceneUseCase = new CreateSceneUseCase(
      sceneRepository,
      choiceRepository,
      storyRepository,
      chapterRepository,
    )
  })

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
    }

    const sceneProfile = await createSceneUseCase.execute(sceneDTO)

    expect(sceneProfile).toBeDefined()
    expect(sceneProfile.name).toBe('Scene 1')
    expect(sceneProfile.chapterId).toBe('chapter123')
    expect(sceneProfile.id).toBeDefined()
    expect(sceneProfile.isFavorite).toBe(true)

    const createdScene = await sceneRepository.findById(sceneProfile.id)
    expect(createdScene).toBeDefined()
    expect(createdScene?.name).toBe('Scene 1')
  })

  it('should create a new scene with default values for optional fields', async () => {
    const sceneDTO = {
      chapterId: 'chapter456',
      name: 'Scene 2',
      index: 2,
    }

    const sceneProfile = await createSceneUseCase.execute(sceneDTO)

    expect(sceneProfile).toBeDefined()
    expect(sceneProfile.name).toBe('Scene 2')
    expect(sceneProfile.summary).toBeNull()
    expect(sceneProfile.gap).toBeNull()
    expect(sceneProfile.duration).toBeNull()
    expect(sceneProfile.isFavorite).toBe(false)
    expect(sceneProfile.extraNotes).toBeNull()
  })
})
