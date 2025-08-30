import type { Moment } from '@domain/entities/Moment'
import type { IMomentRepository } from '@domain/repositories/IMomentRepository'

import { UpdateMomentUseCase } from '@application/use-cases/UpdateMomentUseCase'
import { beforeEach, describe, expect, it } from 'vitest'

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

describe('UpdateMomentUseCase', () => {
  let momentRepository: MockMomentRepository
  let updateMomentUseCase: UpdateMomentUseCase

  beforeEach(() => {
    momentRepository = new MockMomentRepository()
    updateMomentUseCase = new UpdateMomentUseCase(momentRepository)

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
      sceneId: 'scene123',
      name: 'Updated Moment Name',
      location: 'Updated Location',
      isFavorite: true,
    }

    const updatedMoment = await updateMomentUseCase.execute(updateDTO)

    expect(updatedMoment).toBeDefined()
    expect(updatedMoment?.name).toBe('Updated Moment Name')
    expect(updatedMoment?.location).toBe('Updated Location')
    expect(updatedMoment?.isFavorite).toBe(true)
    expect(updatedMoment?.summary).toBe('Original Summary') // Should remain unchanged
  })

  it('should return null if moment not found', async () => {
    const updateDTO = {
      id: 'nonexistent_moment',
      sceneId: 'scene123',
      name: 'New Name',
    }

    const updatedMoment = await updateMomentUseCase.execute(updateDTO)

    expect(updatedMoment).toBeNull()
  })

  it('should return null if moment does not belong to the specified scene', async () => {
    const updateDTO = {
      id: 'moment123',
      sceneId: 'another_scene',
      name: 'New Name',
    }

    const updatedMoment = await updateMomentUseCase.execute(updateDTO)

    expect(updatedMoment).toBeNull()

    // Ensure the moment was not updated
    const moment = await momentRepository.findById('moment123')
    expect(moment?.name).toBe('Original Moment Name')
  })
})
