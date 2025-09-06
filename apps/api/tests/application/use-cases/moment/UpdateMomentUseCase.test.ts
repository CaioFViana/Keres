import type { Moment } from '@domain/entities/Moment'
import type { IChapterRepository } from '@domain/repositories/IChapterRepository' // Added
import type { IMomentRepository } from '@domain/repositories/IMomentRepository'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository' // Added
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Added

import { UpdateMomentUseCase } from '@application/use-cases/moment/UpdateMomentUseCase'
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

describe('UpdateMomentUseCase', () => {
  let momentRepository: MockMomentRepository
  let updateMomentUseCase: UpdateMomentUseCase

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

    updateMomentUseCase = new UpdateMomentUseCase(
      momentRepository,
      mockSceneRepository, // Added
      mockChapterRepository, // Added
      mockStoryRepository, // Added
    )

    // Pre-populate a moment for testing
    momentRepository.save({
      id: 'moment123',
      sceneId: 'scene123',
      name: 'Original Moment Name',
      location: 'Original Location',
      index: 1,
      summary: 'Original Summary',
      isFavorite: false,
      extraNotes: 'Original Notes',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  })

  it('should update an existing moment successfully', async () => {
    const updateDTO = {
      id: 'moment123',
      name: 'Updated Moment Name',
      location: 'Updated Location',
      isFavorite: true,
    }

    const updatedMoment = await updateMomentUseCase.execute('user123', updateDTO) // Pass userId

    expect(updatedMoment).toBeDefined()
    expect(updatedMoment?.name).toBe('Updated Moment Name')
    expect(updatedMoment?.location).toBe('Updated Location')
    expect(updatedMoment?.isFavorite).toBe(true)
    expect(updatedMoment?.summary).toBe('Original Summary') // Should remain unchanged
  })

  it('should return null if moment not found', async () => {
    const updateDTO = {
      id: 'nonexistent_moment',
      name: 'New Name',
    }

    const updatedMoment = await updateMomentUseCase.execute('user123', updateDTO) // Pass userId

    expect(updatedMoment).toBeNull()
  })

  it('should throw an error if scene not found for moment', async () => {
    mockSceneRepository.findById.mockResolvedValue(null) // Mock scene not found

    const updateDTO = {
      id: 'moment123',
      name: 'New Name',
    }

    await expect(updateMomentUseCase.execute('user123', updateDTO)).rejects.toThrow(
      'Scene not found',
    )
  })

  it('should throw an error if chapter not found for scene', async () => {
    mockChapterRepository.findById.mockResolvedValue(null) // Mock chapter not found

    const updateDTO = {
      id: 'moment123',
      name: 'New Name',
    }

    await expect(updateMomentUseCase.execute('user123', updateDTO)).rejects.toThrow(
      'Chapter not found',
    )
  })

  it('should throw an error if story not found or not owned by user for moment', async () => {
    mockStoryRepository.findById.mockResolvedValue(null) // Mock story not found

    const updateDTO = {
      id: 'moment123',
      name: 'New Name',
    }

    await expect(updateMomentUseCase.execute('user123', updateDTO)).rejects.toThrow(
      'Story not found or not owned by user',
    )
  })
})
