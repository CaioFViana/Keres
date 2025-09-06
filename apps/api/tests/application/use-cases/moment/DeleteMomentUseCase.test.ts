import type { Moment } from '@domain/entities/Moment'
import type { IChapterRepository } from '@domain/repositories/IChapterRepository' // Added
import type { IMomentRepository } from '@domain/repositories/IMomentRepository'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository' // Added
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Added

import { DeleteMomentUseCase } from '@application/use-cases/moment/DeleteMomentUseCase'
import { beforeEach, describe, expect, it, vi } from 'vitest' // Added vi

// Mock implementation
class MockMomentRepository implements IMomentRepository {
  private moments: Moment[] = []

  async findById(id: string): Promise<Moment | null> {
    return this.moments.find((moment) => moment.id === id) || null
  }

  async findBySceneId(sceneId: string): Promise<Moment[]> {
    return this.moments.filter((moment) => moment.sceneId === sceneId)
  }

  async save(moment: Moment): Promise<void> {
    this.moments.push(moment)
  }

  async update(moment: Moment): Promise<void> {
    const index = this.moments.findIndex((m) => m.id === moment.id)
    if (index !== -1) {
      this.moments[index] = moment
    }
  }

  async delete(id: string): Promise<void> {
    this.moments = this.moments.filter((moment) => moment.id !== id)
  }
}

// Mock for ISceneRepository
const mockSceneRepository = {
  findById: vi.fn(),
  findByChapterId: vi.fn(),
  save: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}

// Mock for IChapterRepository
const mockChapterRepository = {
  findById: vi.fn(),
  findByStoryId: vi.fn(),
  save: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}

// Mock for IStoryRepository
const mockStoryRepository = {
  findById: vi.fn(),
  findByUserId: vi.fn(),
  save: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}

describe('DeleteMomentUseCase', () => {
  let momentRepository: MockMomentRepository
  let deleteMomentUseCase: DeleteMomentUseCase

  beforeEach(() => {
    momentRepository = new MockMomentRepository()
    // Reset mocks before each test
    vi.clearAllMocks()

    // Setup mock return values for dependencies
    mockSceneRepository.findById.mockImplementation((id: string) => {
      if (id === 'scene123' || id === 'scene456') {
        return { id: id, chapterId: 'chapter123', name: 'Scene 1', index: 1 } // Added chapterId
      }
      return null
    })
    mockChapterRepository.findById.mockResolvedValue({
      id: 'chapter123',
      storyId: 'story123',
      name: 'Chapter 1',
    })
    mockStoryRepository.findById.mockResolvedValue({
      id: 'story123',
      userId: 'user123',
      type: 'linear',
    })

    deleteMomentUseCase = new DeleteMomentUseCase(
      momentRepository,
      mockSceneRepository, // Added
      mockChapterRepository, // Added
      mockStoryRepository, // Added
    )

    // Pre-populate a moment for testing
    momentRepository.save({
      id: 'moment123',
      sceneId: 'scene123',
      name: 'Moment to Delete',
      location: null,
      index: 1,
      summary: null,
      isFavorite: false,
      extraNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  })

  it('should delete an existing moment successfully', async () => {
    const deleted = await deleteMomentUseCase.execute('user123', 'moment123') // Pass userId
    expect(deleted).toBe(true)

    const moment = await momentRepository.findById('moment123')
    expect(moment).toBeNull()
  })

  it('should return false if moment not found', async () => {
    await expect(deleteMomentUseCase.execute('user123', 'nonexistent_moment')).rejects.toThrow(
      'Moment not found',
    )
  })

  it('should return false if moment does not belong to the specified scene', async () => {
    // Mock scene to return a scene not owned by the user
    mockSceneRepository.findById.mockResolvedValue({
      id: 'another_scene',
      chapterId: 'another_chapter',
      name: 'Scene X',
    })
    mockChapterRepository.findById.mockResolvedValue({
      id: 'another_chapter',
      storyId: 'another_story',
      name: 'Chapter X',
    })
    mockStoryRepository.findById.mockResolvedValue({
      id: 'another_story',
      userId: 'another_user',
      type: 'linear',
    })

    await expect(deleteMomentUseCase.execute('user123', 'moment123')).rejects.toThrow(
      'Story not found or not owned by user',
    )

    // Ensure the moment was not deleted
    const moment = await momentRepository.findById('moment123')
    expect(moment).toBeDefined()
  })
})
